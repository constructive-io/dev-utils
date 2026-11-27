import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderCollection } from './collection';
import { list, name, sameRoute, sitePath, text, types, urlFor } from './entities';
import { entityId, pageEntities, pageSubject, renderFacts, schemaType } from './facts';
import { deriveGraphTree } from './graph-tree';
import { collapseAdjacentImages, ignoredContent, removePageChrome } from './html';
import type { Config, Pipeline } from './index';
import { http, linkKey, markdownHref, rewriteMarkdownLinks, routeKey, twinLink } from './navigation';
import { inline } from './render';
import { matches } from './source';
import type {
  Entity, PageContent, ParsedPage, Placement, RenderContext, Section, SiteIdentity, TreeOptions, Twin,
} from './types';

type HostPolicy = { allowed: (url: URL) => boolean; clean: (value: string) => string };
type Entry = Placement & {
  page?: ParsedPage;
  source?: URL;
  subject?: Entity;
  subjectBase?: URL;
  title: string;
  summary: string;
  native?: Twin;
  override?: PageContent;
  skip?: boolean;
};

const optionalKey = 'Optional';
const homeKey = Symbol('home');
type ParentKey = string | typeof homeKey;
const relativeRoute = /^\/(?!\/)[^?#\\]*$/;

function validatePlacement(row: Placement) {
  if (!row || typeof row.key !== 'string' || !row.key.trim() || !['page', 'child', 'optional', 'omit'].includes(row.tier)) {
    throw new Error('Each tree placement needs a unique key and a valid tier');
  }
  if (row.route !== undefined && (!relativeRoute.test(row.route) ||
      row.route.split('/').some((part) => part === '.' || part === '..'))) {
    throw new Error(`Invalid route for tree placement: ${row.key}`);
  }
  if (row.rank !== undefined && !Number.isFinite(row.rank)) throw new Error(`Invalid tree rank: ${row.key}`);
}

function pageCanonical(page: ParsedPage, siteUrl: string, allowed: HostPolicy['allowed'], local = false): URL {
  const exported = sitePath(siteUrl, page.route);
  const useExported = local && (!page.canonical || !matchesExportRoute(page.canonical, exported));
  const canonical = useExported ? exported : page.canonical ?? page.url;
  if (!http(canonical) || canonical.hash || canonical.search || !allowed(canonical) ||
      (!useExported && page.$('link[rel="canonical"]').attr('href') && !page.canonical)) {
    throw new Error(`Invalid HTML canonical for ${page.route}`);
  }
  return useExported ? exported : page.canonical ?? exported;
}

function matchesExportRoute(canonical: URL, route: URL): boolean {
  if (sameRoute(canonical, route)) return true;
  const normalized = new URL(canonical);
  normalized.pathname = routeKey(normalized.pathname).replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  return sameRoute(normalized, route);
}

function parentFor(
  row: Entry, entries: Iterable<Entry>, rules: NonNullable<TreeOptions['inferParents']>,
): string | undefined {
  const { subject: node, subjectBase: base } = row;
  if (!node || !base) return undefined;
  const id = entityId(node, base);
  const candidates = [...entries].filter((entry) => entry !== row && !entry.skip && entry.tier === 'page');
  for (const relation of rules) {
    const ids = list(node[relation]).map((ref) => entityId(ref, base)).filter(Boolean);
    const matches = candidates.filter((parent) => {
      const { subject: target, subjectBase: targetBase } = parent;
      const targetId = target && targetBase && entityId(target, targetBase);
      if (!target || !targetBase || !targetId) return false;
      const parentTypes = types(target).map(schemaType);
      if (parentTypes.some((type) => type === 'Person' || type === 'WebSite')) return false;
      if (relation === 'hasPart') return !!id && list(target.hasPart).some((ref) => entityId(ref, targetBase) === id);
      if ((relation === 'creator' || relation === 'publisher') &&
          !parentTypes.some((type) => type.endsWith('Organization') || type === 'Corporation')) return false;
      return ids.includes(targetId);
    });
    if (matches.length > 1) throw new Error(`Ambiguous tree parent for ${row.key}: ${matches.map(({ key }) => key).join(', ')}`);
    if (matches.length) return matches[0].key;
  }
}

const order = <T extends { key: string; title: string; rank?: number }>(a: T, b: T) =>
  (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
  a.title.localeCompare(b.title, 'en') || a.key.localeCompare(b.key, 'en');

function parentKey(entry: Entry): ParentKey {
  if (entry.tier === 'optional') return entry.parentKey ?? optionalKey;
  return entry.parentKey ?? homeKey;
}

function renderTreeIndex(
  site: SiteIdentity, sections: readonly Section[], entries: readonly Entry[], files: ReadonlyMap<string, URL>,
  siteUrl: URL, policy: HostPolicy, rewrite: boolean,
) {
  const children = new Map<ParentKey, Entry[]>();
  for (const row of entries) {
    const key = parentKey(row);
    children.set(key, [...(children.get(key) ?? []), row]);
  }
  const lines = [`# ${inline(site.title)}`];
  if (site.description) lines.push('', `> ${inline(site.description)}`);
  const render = (group: readonly Entry[], depth = 0) => {
    for (const entry of [...group].sort(order)) {
      const target = entry.page && files.get(linkKey(entry.page.url));
      const contextual = entry.href || entry.source?.href;
      const resolved = contextual && urlFor(rewrite ? twinLink(contextual, siteUrl, files) : contextual, siteUrl);
      const href = target ?? (resolved && http(resolved) && policy.allowed(resolved) ? resolved : undefined);
      const title = inline(entry.title);
      lines.push(`${'  '.repeat(depth)}- ${href ? `[${title}](${markdownHref(href)})` : title}${entry.summary ? `: ${inline(entry.summary)}` : ''}`);
      render(children.get(entry.key) ?? [], depth + 1);
    }
  };
  if (children.has(homeKey)) {
    lines.push('');
    render(children.get(homeKey) ?? []);
  }
  for (const section of [...sections].sort(order).concat({ key: optionalKey, title: optionalKey, rank: Infinity })) {
    const group = children.get(section.key);
    if (!group?.length) continue;
    lines.push('', `## ${inline(section.title)}`, '');
    if (section.description) lines.push(policy.clean(text(section.description)), '');
    render(group);
  }
  return `${lines.join('\n')}\n`;
}

export async function planTree(config: Config, tree: TreeOptions, pipeline: Pipeline, policy: HostPolicy) {
  const { siteUrl, outDir } = config;
  const origin = sitePath(siteUrl, '/');
  const excluded = new Set((config.exclude ?? []).map(routeKey));
  const suppressed = new Set<string>();
  const pages = new Map<string, ParsedPage>();
  const sections = new Set<string>([optionalKey]);
  for (const section of tree.sections) {
    if (!section.key || !text(section.title) || !Number.isFinite(section.rank) || sections.has(section.key)) {
      throw new Error(`Invalid or duplicate tree section: ${section.key}`);
    }
    sections.add(section.key);
  }
  for (const page of pipeline.discoverPages(outDir)) {
    const key = routeKey(page.route);
    if (excluded.has(key)) {
      suppressed.add(key);
      continue;
    }
    const parsed = pipeline.parsePage(page, readFileSync(join(outDir, page.htmlFile), 'utf8'), siteUrl);
    if (parsed.$('meta[http-equiv="refresh" i]').length || parsed.$('meta[name="robots" i]').toArray()
      .some((node) => /\b(noindex|none)\b/i.test(parsed.$(node).attr('content') ?? ''))) {
      suppressed.add(key);
      continue;
    }
    for (const transform of config.transforms ?? []) {
      if (matches(parsed, transform.match)) await transform.apply(parsed);
    }
    pages.set(key, parsed);
  }
  const home = pages.get('');
  const site: SiteIdentity = home ? pipeline.selectSiteIdentity(home) : { title: origin.hostname };
  site.title = policy.clean(site.title) || policy.clean(home?.$('h1').first().text() ?? '') || origin.hostname;
  site.description = policy.clean(site.description || home?.meta('description') || '');
  const siteDescriptions = [site.description, home?.meta('description'),
    ...(home?.jsonld.filter((node) => types(node).map(schemaType).some(
      type => type === 'Person' || type === 'WebSite')).map(node => text(node.description)) ?? [])];
  const commonSummary = new Set(siteDescriptions.map((summary) => policy.clean(text(summary)).toLowerCase()).filter(Boolean));
  const graphByPage = new Map<ParsedPage, Map<string, Entity>>();
  const graph = (page: ParsedPage) => {
    let result = graphByPage.get(page);
    if (!result) graphByPage.set(page, (result = pageEntities(page)));
    return result;
  };
  const lookup = (row: Placement) => {
    const id = entityId(row.entityId, origin);
    if (!id) return undefined;
    for (const page of pages.values()) {
      const node = graph(page).get(id);
      if (node) return { node, base: page.url };
    }
  };
  const native = new Map<string, Twin>();
  for (const twin of await (config.nativeMarkdown?.() ?? [])) {
    const key = routeKey(twin.route);
    if (native.has(key)) throw new Error(`Duplicate native Markdown twin for ${twin.route}`);
    native.set(key, twin);
  }

  const entries = new Map<string, Entry>();
  const routes = new Set<string>();
  const entities = new Set<string>();
  const derived = tree.graph && deriveGraphTree(pages, tree.sections, tree.graph);
  for (const row of derived?.placements ?? tree.placements ?? []) {
    validatePlacement(row);
    if (entries.has(row.key) || sections.has(row.key)) throw new Error(`Duplicate tree key: ${row.key}`);
    const entry: Entry = { ...row, title: '', summary: '' };
    entries.set(row.key, entry);
    if (row.tier === 'omit') {
      entry.skip = true;
      continue;
    }
    const hasTwin = row.tier === 'page' || (row.tier === 'optional' && row.route !== undefined);
    if (row.tier === 'page' && row.route === undefined) throw new Error(`Missing HTML route for ${row.key}`);
    const route = row.route === undefined ? undefined : routeKey(row.route);
    if (route !== undefined && suppressed.has(route)) {
      entry.skip = true;
      continue;
    }
    const page = route === undefined ? undefined : pages.get(route);
    if (!page && route !== undefined) throw new Error(`Unknown HTML route: ${row.route}`);
    if (page) {
      entry.source = pageCanonical(page, siteUrl, policy.allowed, !!derived);
      if (!matchesExportRoute(entry.source, sitePath(siteUrl, page.route))) {
        if (row.tier === 'page') entry.tier = 'child';
      } else if (hasTwin) {
        entry.page = page;
        if (routes.has(route!)) throw new Error(`Duplicate tree route: ${row.route}`);
        routes.add(route!);
        entry.native = native.get(route!);
        entry.override = entry.native ? undefined : await config.pageContent?.(page);
      }
    }
    const id = entityId(row.entityId, page?.url ?? origin);
    if (id && entities.has(id)) throw new Error(`Duplicate tree entity: ${row.entityId}`);
    if (id) entities.add(id);
    const located = id && !page ? lookup(row) : undefined;
    const subject = page ? (id ? graph(page).get(id) :
      derived?.subjects.get(route!) ?? pageSubject(page, graph(page))) : located?.node;
    if (row.entityId && !subject) throw new Error(`Unknown page entity for ${row.key}: ${row.entityId}`);
    if (!derived && entry.page && row.tier === 'page' && !row.collection && route && !subject) {
      throw new Error(`Missing page entity for ${row.key}; declare entityId or a collection`);
    }
    entry.subject = subject;
    entry.subjectBase = page?.url ?? located?.base;
    entry.title = policy.clean(text(row.title || entry.override?.title || entry.native?.title || name(subject) ||
      page?.$('h1').first().text() || page?.$('title').first().text()));
    if (!entry.title) {
      if (!derived || !page) throw new Error(`Missing title for tree placement: ${row.key}`);
      entry.title = policy.clean(route?.split('/').at(-1) ?? '') || site.title;
    }
    const summaries = [row.summary, entry.override?.description, entry.native?.description, text(subject?.description)];
    entry.summary = summaries.map((value) => policy.clean(text(value))).find((value) =>
      value && (route === '' || !commonSummary.has(value.toLowerCase()))) ?? '';
    if (!derived && entry.tier === 'page' && route && subject && !entry.summary) {
      throw new Error(`Missing page-specific description for ${row.key}`);
    }
  }

  for (const entry of entries.values()) {
    if (entry.skip) continue;
    if (!entry.parentKey && entry.tier !== 'optional' && entry.route !== '/') {
      entry.parentKey = parentFor(entry, entries.values(), tree.inferParents ?? []);
      if (!entry.parentKey) throw new Error(`Missing tree parent for ${entry.key}`);
    }
  }
  for (const entry of entries.values()) {
    if (entry.skip) continue;
    const parents = new Set([entry.key]);
    let key = entry.parentKey;
    let optional = entry.tier === 'optional';
    for (; key && !sections.has(key); key = entries.get(key)?.parentKey) {
      if (parents.has(key)) throw new Error(`Tree parent cycle at ${key}`);
      parents.add(key);
      if (!entries.has(key)) throw new Error(`Unknown tree parent: ${key}`);
      if (entries.get(key)?.skip) {
        entry.skip = true;
        break;
      }
      optional ||= entries.get(key)?.tier === 'optional';
      if (!entries.get(key)?.parentKey && entries.get(key)?.tier === 'optional') key = optionalKey;
      if (key === optionalKey) break;
    }
    if (!entry.skip && entry.tier === 'optional' && entry.parentKey && key !== optionalKey) {
      throw new Error(`Optional entry must be under Optional: ${entry.key}`);
    }
    if (!entry.skip && entry.tier === 'page' && (optional || key === optionalKey)) {
      throw new Error(`Core entry cannot be under Optional: ${entry.key}`);
    }
  }
  const retained = [...entries.values()].filter((entry) => !entry.skip);
  const fileMap = new Map<string, URL>();
  const canonicalMap: Record<string, string> = {};
  for (const { page, source, native } of retained) {
    if (!page || !source) continue;
    const twin = sitePath(siteUrl, native?.file ?? page.file);
    if (Object.hasOwn(canonicalMap, twin.pathname)) throw new Error(`Duplicate Markdown twin: ${twin.pathname}`);
    canonicalMap[twin.pathname] = source.href;
    for (const url of [page.url, source, sitePath(siteUrl, page.htmlFile)]) fileMap.set(linkKey(url), twin);
  }
  const rewrite = tree.rewriteInternalLinks !== false;
  const twins: Twin[] = [];
  for (const entry of retained) {
    if (!entry.page || !entry.source) continue;
    twins.push(await renderEntry(entry, entry.page, entry.source, graph(entry.page), origin,
      tree, pipeline, policy, fileMap, rewrite));
  }
  return { site, twins, index: renderTreeIndex(site, tree.sections, retained, fileMap, origin, policy, rewrite), canonicalMap };
}

async function renderEntry(
  entry: Entry, page: ParsedPage, source: URL, graph: ReadonlyMap<string, Entity>, origin: URL,
  tree: TreeOptions, pipeline: Pipeline, policy: HostPolicy, files: ReadonlyMap<string, URL>, rewrite: boolean,
): Promise<Twin> {
  const { title, summary: description, subject, native, override } = entry;
  const metadata = { route: page.route, file: native?.file ?? page.file, title, description, optional: entry.tier === 'optional' };
  if (native) return { ...native, ...metadata };
  const rule = tree.pages?.find(({ match }) => matches(page, match));
  const schemaTypes = subject ? types(subject).map(schemaType) : [];
  const renderer = rule?.renderer ?? (rule?.collection ? 'collection' : undefined) ??
    schemaTypes.map((type) => own(tree.renderers, type)).find(Boolean) ?? 'default';
  const { $ } = page;
  $('[data-llm-ignore]').remove();
  removePageChrome($, page.url, origin);
  const main = $('main, [role="main"]').first();
  const primary = main.length ? main : $('article').first();
  const content = primary.length ? primary : $('body').first();
  content.find(ignoredContent).remove();
  const headingNode = content.find('h1').first();
  const heading = text(headingNode.clone().find('br').replaceWith(' ').end().text());
  if (heading === title) headingNode.remove();
  content.find('h1').each((_, node) => { $(node).replaceWith($('<h2>').append($(node).contents())); });
  if (renderer === 'collection' && rule?.content !== 'omit') {
    if (!rule?.collection) throw new Error(`Missing collection options for ${page.route}`);
    renderCollection(page, content, subject, graph, rule.collection, policy.allowed);
  }
  content.find('a[href], img[src]').each((_, node) => {
    const element = $(node);
    const attr = node.tagName === 'a' ? 'href' : 'src';
    const url = urlFor(element.attr(attr), page.url);
    if (url && policy.allowed(url) && (http(url) || /^(mailto:|tel:)$/.test(url.protocol))) element.attr(attr, url.href);
    else element.removeAttr(attr);
  });
  collapseAdjacentImages($);
  const resolveLink = (href: string) => {
    const url = urlFor(href, source);
    if (url && !policy.allowed(url)) return '';
    if (!url || !http(url)) return href;
    return rewrite ? twinLink(markdownHref(url), source, files) : markdownHref(url);
  };
  let body = rule?.content === 'omit' ? '' : override?.body ?? pipeline.htmlToMarkdown(content.html() ?? '');
  const context: RenderContext = { page, subject, body, twinHref: resolveLink };
  if (typeof renderer === 'function' && rule?.content !== 'omit') body = await renderer(context);
  if (tree.hooks?.transformMarkdown && rule?.content !== 'omit') {
    body = await tree.hooks.transformMarkdown(body, { ...context, body });
  }
  body = policy.clean(await rewriteMarkdownLinks(body, resolveLink));
  if (!body && rule?.content !== 'omit' && entry.tier === 'page' && entry.route !== '/' && !entry.collection) {
    throw new Error(`Missing main content for ${entry.key}`);
  }
  const filter = (entity: Entity) => tree.hooks?.filterEntities?.(entity, { ...context, body }) !== false;
  const fields = schemaTypes.map((type) => own(tree.factFields, type)).find(Boolean);
  const facts = subject && (rule?.facts ?? tree.facts ?? true) && filter(subject)
    ? renderFacts({ subject, page, byId: graph, body, fields, ...policy, filter }) : [];
  const header = [`> Source: ${source.href}`, ...facts].join('\n');
  return { ...metadata, markdown: `# ${inline(title)}\n\n${header}${body ? `\n\n${body}` : ''}\n` };
}

function own<T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
  return record && Object.hasOwn(record, key) ? record[key] : undefined;
}
