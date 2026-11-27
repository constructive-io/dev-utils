import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { htmlText } from './html';
import { inline } from './render';
import type { Awaitable, PageContent, ParsedPage, Placement, RouteMatch } from './types';

export function matches(page: ParsedPage, match: RouteMatch): boolean {
  if (typeof match === 'function') return match(page);
  if (typeof match === 'string') return page.route.replace(/\/$/, '') === match.replace(/\/$/, '');
  return new RegExp(match.source, match.flags.replace(/[gy]/g, '')).test(page.route);
}

export function readPlacements(file: string | URL): Placement[] {
  const placements: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(placements)) throw new Error('Expected a JSON array of placements');
  return placements as Placement[];
}

export function splitLeadingH1(body: string): { h1?: string; rest: string } {
  const match = /^\s*#\s+([^\r\n]+)(?:\r?\n|$)/.exec(body);
  return match ? { h1: match[1].trim(), rest: body.slice(match[0].length).trim() } : { rest: body.trim() };
}

export type SourceIntro = {
  byline?: string;
  date?: string;
  image?: { alt: string; href: string };
  links?: readonly { label: string; href: string }[];
  context?: readonly string[];
};

export function formatMarkdownIntro(intro: SourceIntro): string {
  const href = (value: string) => value.replace(/[<>\r\n]/g, (char) => encodeURIComponent(char));
  const byline = [intro.byline, intro.date].filter(Boolean).map((value) => inline(value!)).join(' · ');
  return [
    byline,
    ...(intro.context ?? []).map(inline),
    intro.image && `![${inline(intro.image.alt)}](<${href(intro.image.href)}>)`,
    ...(intro.links ?? []).map((link) => `[${inline(link.label)}](<${href(link.href)}>)`),
  ].filter(Boolean).join('\n\n');
}

export type SourceRule = {
  match: RouteMatch;
  file: (page: ParsedPage) => string | undefined;
  parse?: (source: string, page: ParsedPage) => Awaitable<PageContent>;
  intro?: (page: ParsedPage, content: PageContent) => Awaitable<SourceIntro>;
};

export function markdownSource(
  rules: readonly SourceRule[],
  { root = process.cwd(), titleSelector }: { root?: string; titleSelector?: string } = {},
) {
  return async (page: ParsedPage): Promise<PageContent | undefined> => {
    const rule = rules.find(({ match }) => matches(page, match));
    const title = titleSelector ? htmlText(page.$(titleSelector).first()) || undefined : undefined;
    const file = rule?.file(page);
    if (!rule || !file) return title ? { title } : undefined;
    const path = resolve(root, file);
    const local = relative(root, path);
    if (!local || local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
      throw new Error(`Markdown source is outside its root: ${file}`);
    }
    let source: string;
    try {
      const real = realpathSync(path);
      const location = relative(realpathSync(root), real);
      if (location === '..' || location.startsWith(`..${sep}`) || isAbsolute(location)) {
        throw new Error(`Markdown source is outside its root: ${file}`);
      }
      source = readFileSync(real, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return title ? { title } : undefined;
      throw error;
    }
    const parsed = rule.parse ? await rule.parse(source, page) : { body: source };
    const { h1, rest } = splitLeadingH1(parsed.body ?? '');
    const intro = rule.intro && formatMarkdownIntro(await rule.intro(page, parsed));
    const body = intro ? [intro, rest].filter(Boolean).join('\n\n') : parsed.body === undefined ? undefined : rest;
    return { ...parsed, title: title || parsed.title || h1, body };
  };
}
