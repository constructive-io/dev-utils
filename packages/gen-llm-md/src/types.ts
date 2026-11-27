import type { CheerioAPI } from 'cheerio';

export type Entity = Record<string, unknown>;
export type ExportPage = { route: string; htmlFile: string; file: string };
export type ParsedPage = ExportPage & {
  html: string;
  $: CheerioAPI;
  jsonld: Entity[];
  /** Parsed scripts before flattening or applying JSON-LD transforms. */
  readonly jsonldDocuments?: readonly unknown[];
  meta: (name: string) => string;
  url: URL;
  canonical?: URL;
};
export type SiteIdentity = { title: string; description?: string };
export type IndexPage = {
  route: string;
  title: string;
  description?: string;
  file: string;
  optional?: boolean;
  section?: string;
  group?: string;
};
export type Twin = IndexPage & { markdown: string | Uint8Array };
export type PageContent = { title?: string; description?: string; body?: string };
export type IndexSection = { title: string; pages: readonly IndexPage[] };
export type Artifact =
  | { file: string; contents: string | Uint8Array; markdown?: true; remove?: false }
  | { file: string; remove: true; sha256: string };
export type Awaitable<T> = T | Promise<T>;

export type RouteMatch = string | RegExp | ((page: ParsedPage) => boolean);
export type Tier = 'page' | 'child' | 'optional' | 'omit';
export type Section = { key: string; title: string; rank: number; description?: string };
export type Placement = {
  key: string;
  parentKey?: string;
  tier: Tier;
  rank?: number;
  route?: string;
  entityId?: string;
  title?: string;
  summary?: string;
  href?: string;
  collection?: true;
};
export type CollectionOptions = {
  selector: string;
  relation: 'hasPart' | 'itemListElement';
  cardSelector?: string;
  titleSelector?: string;
  durationSelector?: string;
  descriptionSelector?: string;
};
export type RenderContext = {
  page: ParsedPage;
  subject?: Entity;
  body: string;
  twinHref: (href: string) => string;
};
export type PageRule = {
  match: RouteMatch;
  facts?: boolean;
  content?: 'main' | 'omit';
  renderer?: PageRenderer;
  collection?: CollectionOptions;
};
export type PageRenderer = 'default' | 'entity' | 'collection' |
  ((ctx: RenderContext) => Awaitable<string>);
export type TreeOptions = {
  sections: readonly Section[];
  placements: readonly Placement[];
  inferParents?: readonly ('isPartOf' | 'hasPart' | 'creator' | 'publisher')[];
  rewriteInternalLinks?: boolean;
  facts?: boolean;
  factFields?: Readonly<Record<string, readonly string[]>>;
  renderers?: Readonly<Record<string, PageRenderer>>;
  pages?: readonly PageRule[];
  hooks?: {
    filterEntities?: (entity: Entity, ctx: RenderContext) => boolean;
    transformMarkdown?: (markdown: string, ctx: RenderContext) => Awaitable<string>;
  };
  canonicalMapFile?: string;
};
