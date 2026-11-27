import type { CheerioAPI } from 'cheerio';

export type Entity = Record<string, unknown>;
export type ExportPage = { route: string; htmlFile: string; file: string };
export type ParsedPage = ExportPage & {
  html: string;
  $: CheerioAPI;
  jsonld: Entity[];
  meta: (name: string) => string;
  url: URL;
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
export type Artifact = { file: string; contents: string | Uint8Array; markdown?: true };
export type Awaitable<T> = T | Promise<T>;
