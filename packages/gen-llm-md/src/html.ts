import { type CheerioAPI, load } from 'cheerio';
import { NodeHtmlMarkdown } from 'node-html-markdown';

import { entities, sameRoute, sitePath, text, urlFor } from './entities';
import type { ExportPage, ParsedPage } from './types';

const converter = new NodeHtmlMarkdown({ codeFence: '```' }, {
  'h1,h2,h3,h4,h5,h6': ({ node }) => ({
    postprocess: ({ content }) =>
      content.trim() ? `${'#'.repeat(Number(node.tagName[1]))} ${content.trim()}` : '',
  }),
});

export function parsePage(page: ExportPage, html: string, siteUrl: string): ParsedPage {
  const $ = load(html);
  const url = sitePath(siteUrl, page.route);
  const canonical = urlFor($('link[rel="canonical"]').attr('href'), url);
  const readJsonld = () => $('script[type="application/ld+json"]').toArray().flatMap((script) => {
    try {
      return entities(JSON.parse($(script).text()));
    } catch (error) {
      throw new Error(`Invalid JSON-LD in ${page.htmlFile}`, { cause: error });
    }
  });
  const meta = (name: string) => text($('meta[name]').filter((_, node) =>
    $(node).attr('name')?.toLowerCase() === name.toLowerCase()).first().attr('content'));
  let jsonld: ParsedPage['jsonld'] | undefined;
  return {
    ...page, html, $, meta,
    url: canonical && sameRoute(canonical, url) ? canonical : url,
    get jsonld() {
      return (jsonld ??= readJsonld());
    },
    set jsonld(value: ParsedPage['jsonld']) {
      jsonld = value;
    },
  };
}

export function flattenLayoutTables($: CheerioAPI, selector = 'table[role="presentation"], table[role="none"]') {
  for (const node of $(selector).toArray().reverse()) {
    const table = $(node);
    const rows = table.find('tr').toArray()
      .filter((row) => $(row).closest('table')[0] === node)
      .map((row) => $(row).children('td, th').toArray());
    const bulletColumn = rows.length > 0 && rows.every((cells) =>
      cells.length === 2 && /^[•·●▪–—]$/.test($(cells[0]).text().trim()));
    const presentation = /^(presentation|none)$/.test(table.attr('role') ?? '') || rows.length <= 1 ||
      rows.every((cells) => cells.length <= 1) || table.find('img').length > 0;
    if (bulletColumn) {
      const items = $('<ul>');
      for (const cells of rows) items.append($('<li>').append($(cells[1]).contents()));
      table.replaceWith(items);
    } else if (presentation && !table.find('th, caption').length) {
      const content = $('<div>');
      for (const cell of rows.flat()) {
        const value = $(cell);
        if (value.text().trim() || value.find('img, hr').length) {
          content.append($('<div>').append(value.contents()));
        }
      }
      table.replaceWith(content);
    }
  }
}

export function normalizeRoleTables($: CheerioAPI) {
  const tableRole = '[role="table"], [role="grid"], [role="treegrid"]';
  const rowRole = 'tr, [role="row"]';
  const cellRole = 'td, th, [role="cell"], [role="gridcell"], [role="columnheader"], [role="rowheader"]';
  for (const node of $(tableRole).not('table').toArray().reverse()) {
    const source = $(node);
    const table = $('<table>');
    const rows = source.find(rowRole).filter((_, row) => $(row).closest(tableRole)[0] === node);
    for (const row of rows.toArray()) {
      const result = $('<tr>');
      const cells = $(row).find(cellRole).filter((_, cell) => $(cell).closest(rowRole)[0] === row);
      for (const cell of cells.toArray()) {
        const current = $(cell);
        const header = current.is('th, [role="columnheader"], [role="rowheader"]');
        const target = $(header ? '<th>' : '<td>');
        const label = current.attr('aria-label');
        if (label && !current.text().trim() && !current.find('img').length) target.text(label);
        else target.append(current.contents());
        result.append(target);
      }
      if (result.children().length) table.append(result);
    }
    if (table.children().length) source.replaceWith(table);
  }
}

export const ignoredContent = 'nav, script, style, template, noscript, iframe, svg, form, dialog, [hidden], [aria-hidden="true"], [data-llm-ignore]';

export function removePageChrome($: CheerioAPI) {
  $('nav, [role="navigation" i], [role="banner" i], [role="contentinfo" i], header, footer')
    .filter((_, element) => {
      const node = $(element);
      return !node.is('header, footer') ||
        node.is('nav, [role="navigation" i], [role="banner" i], [role="contentinfo" i]') ||
        (!node.parents('article, section, aside, [role="article" i]').length &&
          !(node.is('main > header, [role="main" i] > header') && node.find('h1').length));
    }).remove();
}

export function collapseAdjacentImages($: CheerioAPI) {
  const image = (element: Parameters<CheerioAPI>[0]) => {
    const node = $(element);
    return node.is('picture') ? node.children('img').first() : node.filter('img');
  };
  $('img, picture').not('picture img').each((_, element) => {
    const src = image(element).attr('src');
    if (!src) return;
    let previous = element.prev;
    while (previous && (previous.type === 'comment' || (previous.type === 'text' && !previous.data.trim()))) {
      previous = previous.prev;
    }
    if (previous && image(previous).attr('src') === src) $(element).remove();
  });
}

export function htmlToMarkdown(html: string): string {
  const $ = load(html, {}, false);
  $(ignoredContent).remove();
  collapseAdjacentImages($);
  $('button').each((_, button) => {
    const node = $(button);
    const label = node.attr('aria-label');
    node.replaceWith(label && !node.text().trim() && !node.find('img').length
      ? $('<span>').text(label)
      : $('<div>').append(node.contents()));
  });
  flattenLayoutTables($);
  normalizeRoleTables($);
  return converter.translate($.root().html() ?? '').trim();
}
