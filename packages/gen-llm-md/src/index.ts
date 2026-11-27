import { closeSync, constants, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { name, selectPageEntity, selectSiteIdentity, sitePath, text, types, urlFor } from './entities';
import { discoverPages, markdownArtifact, planManifest, type StaleOptions, writeArtifacts } from './files';
import { collapseAdjacentImages, htmlToMarkdown, ignoredContent, parsePage, removePageChrome } from './html';
import { defaultSections, renderIndex, renderTwin } from './render';
import { matches } from './source';
import { planTree } from './tree';
import type {
  Artifact, Awaitable, IndexPage, IndexSection, PageContent, ParsedPage, RouteMatch, SiteIdentity, TreeOptions, Twin,
} from './types';

export { selectPageEntity, selectSiteIdentity } from './entities';
export type { StaleOptions } from './files';
export { discoverPages, manifestFile, planManifest, writeArtifacts } from './files';
export { flattenLayoutTables, htmlToMarkdown, normalizeRoleTables, parsePage } from './html';
export { defaultSections, indexTitles, renderIndex, renderTwin } from './render';
export { retiredPageNotice } from './retired';
export type { SourceIntro, SourceRule } from './source';
export { formatMarkdownIntro, markdownSource, readPlacements, splitLeadingH1 } from './source';
export * from './types';

const defaults = {
  discoverPages, parsePage, selectPageEntity, selectSiteIdentity, htmlToMarkdown,
  renderTwin, renderIndex, planManifest, writeArtifacts,
};
export type Pipeline = typeof defaults;
export type RouteTransform = {
  match: RouteMatch;
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
  tree?: TreeOptions;
  stale?: StaleOptions;
  pipeline?: Partial<Pipeline>;
};
export type Generation = { site: SiteIdentity; twins: Twin[]; artifacts: Artifact[]; canonicalMap?: Record<string, string> };

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
  const homeUrl = sitePath(siteUrl, '/');
  const { allowed, clean } = hostPolicy(config.blockedHosts ?? []);
  if (!allowed(origin)) throw new Error('siteUrl must not be a blocked host');
  const pipeline = { ...defaults, ...config.pipeline };
  if (config.tree) {
    if (config.index?.sections) throw new Error('tree and index.sections cannot be used together');
    const { site, twins, index, canonicalMap } = await planTree(config, config.tree, pipeline, { allowed, clean });
    const artifacts = twins.map(({ file, markdown }) => markdownArtifact(file, markdown));
    artifacts.push({ file: 'llms.txt', contents: index });
    artifacts.push(...pipeline.planManifest(outDir, twins, config.stale, siteUrl));
    return { site, twins, artifacts, canonicalMap };
  }
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
    const entity = pipeline.selectPageEntity(page);
    $('[data-llm-ignore]').remove();
    removePageChrome($, page.url, homeUrl);
    const main = $('main, [role="main"]').first();
    const primary = main.length ? main : $('article').first();
    const content = primary.length ? primary : $('body').first();
    content.find(ignoredContent).remove();
    const headingNode = content.find('h1').first();
    const heading = text(headingNode.clone().find('br').replaceWith(' ').end().text());
    const title = clean(override?.title || name(entity) || heading || text($('title').first().text()) || route) || route;
    const description = clean(override?.description || text(entity?.description) || page.meta('description'));
    if (route === '/') {
      const identity = pipeline.selectSiteIdentity(page);
      site.title = clean(identity.title || title) || origin.hostname;
      site.description = clean(identity.description || page.meta('description') || description);
      if (files.has(file)) continue;
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
    collapseAdjacentImages($);
    const body = clean(override?.body ?? pipeline.htmlToMarkdown(content.html() ?? ''));
    if (!primary.length && override?.body === undefined && !heading && !body) continue;
    const id = entity && urlFor(entity['@id'], page.url);
    const schema = entity ? { type: types(entity).join(', '), id: id && allowed(id) ? id : undefined } : undefined;
    const twin = pipeline.renderTwin(page, { title, description, body }, schema);
    if (files.has(twin.file)) throw new Error(`Duplicate Markdown twin: ${twin.file}`);
    files.add(twin.file);
    twins.push(twin);
  }
  const sections = (config.index?.sections ?? defaultSections)(twins);
  const artifacts = twins.map(({ file, markdown }) => markdownArtifact(file, markdown));
  artifacts.push({ file: 'llms.txt', contents: pipeline.renderIndex(site, sections, siteUrl) });
  artifacts.push(...pipeline.planManifest(outDir, twins, config.stale, siteUrl));
  return { site, twins, artifacts };
}

export async function generate(config: Config): Promise<Generation> {
  const configuredMap = config.tree?.canonicalMapFile;
  const mapFile = configuredMap && join(realpathSync(dirname(resolve(configuredMap))), basename(configuredMap));
  if (mapFile) {
    const path = relative(realpathSync(config.outDir), mapFile);
    if (!path || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path))) {
      throw new Error('canonicalMapFile must be outside outDir');
    }
  }
  const result = await planGeneration(config);
  (config.pipeline?.writeArtifacts ?? writeArtifacts)(config.outDir, result.artifacts, config.stale);
  if (mapFile) {
    const handle = openSync(mapFile, constants.O_CREAT | constants.O_TRUNC | constants.O_WRONLY | constants.O_NOFOLLOW);
    try {
      writeFileSync(handle, `${JSON.stringify(result.canonicalMap, null, 2)}\n`);
    } finally {
      closeSync(handle);
    }
  }
  return result;
}
