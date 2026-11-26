import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { name, selectPageEntity, selectSiteIdentity, text, types, urlFor } from './entities';
import { discoverPages, planManifest, type StaleOptions, writeArtifacts } from './files';
import { htmlToMarkdown, parsePage } from './html';
import { defaultSections, renderIndex, renderTwin } from './render';
import type {
  Artifact, Awaitable, IndexPage, IndexSection, PageContent, ParsedPage, SiteIdentity, Twin,
} from './types';

export { selectPageEntity, selectSiteIdentity } from './entities';
export type { StaleOptions } from './files';
export { discoverPages, manifestFile, planManifest, writeArtifacts } from './files';
export { flattenLayoutTables, htmlToMarkdown, normalizeRoleTables, parsePage } from './html';
export { defaultSections, indexTitles, renderIndex, renderTwin } from './render';
export * from './types';

const defaults = {
  discoverPages, parsePage, selectPageEntity, selectSiteIdentity, htmlToMarkdown,
  renderTwin, renderIndex, planManifest, writeArtifacts,
};
export type Pipeline = typeof defaults;
export type RouteTransform = {
  match: string | RegExp | ((page: ParsedPage) => boolean);
  apply: (page: ParsedPage) => Awaitable<void>;
};
export type Config = {
  outDir: string;
  siteUrl: string;
  exclude?: readonly string[];
  blockedHosts?: readonly string[];
  nativeMarkdown?: () => Awaitable<readonly Twin[]>;
  pageContent?: (page: ParsedPage) => Awaitable<PageContent | undefined>;
  transforms?: readonly RouteTransform[];
  index?: { sections?: (pages: readonly IndexPage[]) => readonly IndexSection[] };
  stale?: StaleOptions;
  pipeline?: Partial<Pipeline>;
};
export type Generation = { site: SiteIdentity; twins: Twin[]; artifacts: Artifact[] };

function matches(page: ParsedPage, match: RouteTransform['match']) {
  if (typeof match === 'function') return match(page);
  if (typeof match === 'string') return page.route.replace(/\/$/, '') === match.replace(/\/$/, '');
  return new RegExp(match.source, match.flags.replace(/[gy]/g, '')).test(page.route);
}

function hostPolicy(hosts: readonly string[]) {
  const keys = hosts.map((host) => host.toLowerCase());
  const pattern = keys.length ? new RegExp(
    String.raw`(?<![\w.-])(?:https?://|//)?(?:[\w-]+\.)*(?:` +
      keys.map((host) => host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
      String.raw`)(?![\w.-])(?::\d+)?(?:[/?#][^\s<>)\]"'` + '`' + ']*)?', 'gi'
  ) : undefined;
  return {
    allowed: (url: URL) => !keys.some((host) => {
      const domain = url.hostname.toLowerCase().replace(/\.$/, '');
      return domain === host || domain.endsWith(`.${host}`);
    }),
    clean: (value: string) => (pattern ? value.replace(pattern, '') : value).trim(),
  };
}

export async function planGeneration(config: Config): Promise<Generation> {
  const { outDir, siteUrl, exclude = [], transforms = [] } = config;
  const origin = new URL(siteUrl);
  if (!['https:', 'http:'].includes(origin.protocol)) throw new Error('siteUrl must be an HTTP(S) URL');
  const { allowed, clean } = hostPolicy(config.blockedHosts ?? []);
  if (!allowed(origin)) throw new Error('siteUrl must not be a blocked host');
  const pipeline = { ...defaults, ...config.pipeline };
  const twins: Twin[] = [...await (config.nativeMarkdown?.() ?? [])];
  const files = new Set(twins.map((twin) => twin.file));
  if (files.size !== twins.length) throw new Error('Duplicate native Markdown twin');
  const site: SiteIdentity = { title: origin.hostname };
  const excluded = new Set(exclude.map((route) => route.replace(/\/$/, '')));

  for (const visible of pipeline.discoverPages(outDir)) {
    const { route, file, htmlFile } = visible;
    if (excluded.has(route.replace(/\/$/, ''))) continue;
    if (files.has(file) && route !== '/') continue;
    const page = pipeline.parsePage(visible, readFileSync(join(outDir, htmlFile), 'utf8'), siteUrl);
    const { $ } = page;
    if ($('meta[http-equiv="refresh" i]').length ||
      (!route.startsWith('/legal/') && $('meta[name="robots" i]').toArray().some((node) =>
        /\b(noindex|none)\b/i.test($(node).attr('content') ?? '')))) continue;
    for (const transform of transforms) if (matches(page, transform.match)) await transform.apply(page);
    const override = await config.pageContent?.(page);
    const main = $('main, [role="main"]').first();
    const content = main.length ? main : $('article').first();
    if (!content.length && override?.body === undefined && route !== '/') continue;
    const entity = pipeline.selectPageEntity(page);
    content.find('nav, script, style, template, noscript, iframe, svg, form, dialog, [hidden], [aria-hidden="true"], [data-llm-ignore]').remove();
    const headingNode = content.find('h1').first();
    const heading = text(headingNode.clone().find('br').replaceWith(' ').end().text());
    const title = clean(override?.title || name(entity) || heading || text($('title').first().text()) || route) || route;
    const description = clean(override?.description || text(entity?.description) || page.meta('description'));
    if (route === '/') {
      const identity = pipeline.selectSiteIdentity(page);
      site.title = clean(identity.title || title) || origin.hostname;
      site.description = clean(identity.description || page.meta('description') || description);
      if (files.has(file) || (!content.length && override?.body === undefined)) continue;
    }
    if (heading === title) headingNode.remove();
    content.find('h1').each((_, element) => {
      $(element).replaceWith($('<h2>').append($(element).contents()));
    });
    content.find('a[href], img[src]').each((_, element) => {
      const node = $(element);
      const attr = element.tagName === 'a' ? 'href' : 'src';
      const url = urlFor(node.attr(attr), page.url);
      if (url && allowed(url) && /^(https?:|mailto:|tel:)$/.test(url.protocol)) node.attr(attr, url.href);
      else node.removeAttr(attr);
    });
    const body = clean(override?.body ?? pipeline.htmlToMarkdown(content.html() ?? ''));
    const id = entity && urlFor(entity['@id'], page.url);
    const schema = entity ? { type: types(entity).join(', '), id: id && allowed(id) ? id : undefined } : undefined;
    const twin = pipeline.renderTwin(page, { title, description, body }, schema);
    if (files.has(twin.file)) throw new Error(`Duplicate Markdown twin: ${twin.file}`);
    files.add(twin.file);
    twins.push(twin);
  }
  const sections = (config.index?.sections ?? defaultSections)(twins);
  const artifacts: Artifact[] = twins.map(({ file, markdown }) => ({ file, contents: markdown }));
  artifacts.push({ file: 'llms.txt', contents: pipeline.renderIndex(site, sections, siteUrl) });
  artifacts.push(...pipeline.planManifest(outDir, twins, config.stale));
  return { site, twins, artifacts };
}

export async function generate(config: Config): Promise<Generation> {
  const result = await planGeneration(config);
  (config.pipeline?.writeArtifacts ?? writeArtifacts)(config.outDir, result.artifacts);
  return result;
}
