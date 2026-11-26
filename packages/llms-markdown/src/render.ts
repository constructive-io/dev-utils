import type { IndexPage, IndexSection, PageContent, ParsedPage, SiteIdentity, Twin } from './types';

export const inline = (value: string) => value.replace(/([\\`*_[\]<>])/g, '\\$1');

export function indexTitles<T extends { title: string; route: string }>(pages: readonly T[]) {
  const routesByTitle = new Map<string, string[]>();
  const key = (route: string) => route.replace(/\/$/, '');
  const parent = (route: string) => route.slice(0, route.lastIndexOf('/'));
  for (const page of pages) {
    const title = page.title.toLowerCase();
    routesByTitle.set(title, [...(routesByTitle.get(title) ?? []), key(page.route)]);
  }
  return (page: T) => {
    const routes = routesByTitle.get(page.title.toLowerCase()) ?? [];
    const route = key(page.route);
    if (routes.length <= 1 || routes.every((other) => other === route || route.startsWith(`${other}/`))) {
      return page.title;
    }
    const base = parent(route);
    const context = base.split('/').filter(Boolean).map((segment) =>
      segment.replace(/-/g, ' ').replace(/^./, (initial) => initial.toUpperCase())
    ).join(' / ');
    return `${page.title} (${context && routes.filter((other) => parent(other) === base).length === 1 ? context : page.route})`;
  };
}

export function renderTwin(
  page: ParsedPage,
  content: Required<PageContent>,
  schema?: { type: string; id?: URL }
): Twin {
  const { title, description, body } = content;
  const context = [
    description && `> ${inline(description)}`,
    `> Source: ${page.url.href}`,
    schema?.type && `> Schema.org: ${inline(schema.type)}${schema.id ? ` — ${schema.id.href}` : ''}`,
  ].filter(Boolean).join('\n');
  return {
    route: page.route, file: page.file, title, description, optional: page.route.startsWith('/legal/'),
    markdown: `# ${inline(title)}\n\n${context}${body ? `\n\n${body}` : ''}\n`,
  };
}

export function defaultSections(pages: readonly IndexPage[]): IndexSection[] {
  return [
    { title: 'Pages', pages: pages.filter((page) => !page.optional) },
    { title: 'Optional', pages: pages.filter((page) => page.optional) },
  ];
}

export function renderIndex(site: SiteIdentity, sections: readonly IndexSection[], siteUrl: string): string {
  const indexTitle = indexTitles(sections.flatMap((section) => section.pages));
  const lines = [`# ${inline(site.title)}`];
  if (site.description) lines.push('', `> ${inline(site.description)}`);
  for (const section of sections) {
    if (!section.pages.length) continue;
    lines.push('', `## ${inline(section.title)}`, '');
    for (const page of section.pages) {
      const href = new URL(`/${page.file}`, siteUrl).href;
      lines.push(`- [${inline(indexTitle(page))}](${href})${page.description ? `: ${inline(page.description)}` : ''}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
