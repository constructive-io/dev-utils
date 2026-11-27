import { isEntity, list, name, text, urlFor } from './entities';
import { resolveEntity } from './facts';
import { http, linkKey } from './navigation';
import type { CollectionOptions, Entity, ParsedPage } from './types';

function durationText(value: string): string {
  const time = /^(?:(\d+):)?(\d+):(\d{2})$/.exec(value);
  const iso = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  const parts = time ?? iso;
  if (!parts) return value;
  return [[parts[1], 'hr'], [parts[2], 'min'], [parts[3], 'sec']]
    .filter(([number]) => Number(number) > 0)
    .map(([number, unit]) => `${Number(number)} ${unit}`).join(' ') || '0 sec';
}

export function renderCollection(
  page: ParsedPage, content: ReturnType<ParsedPage['$']>, subject: Entity | undefined,
  byId: ReadonlyMap<string, Entity>, options: CollectionOptions, allowed: (url: URL) => boolean,
) {
  const { $ } = page;
  const related = new Map<string, Entity>();
  for (const ref of list(subject?.[options.relation])) {
    const node = resolveEntity(ref, page, byId);
    const item = node?.item ?? (isEntity(ref) ? ref.item : undefined);
    const candidate = item ?? ref;
    const resolved = resolveEntity(candidate, page, byId) ?? (isEntity(candidate) ? candidate : undefined);
    const url = urlFor(resolved?.url || resolved?.['@id'], page.url);
    if (url && http(url) && resolved) related.set(linkKey(url), resolved);
  }

  content.find(options.selector).add(content.filter(options.selector)).toArray().reverse().forEach((region) => {
    const cards = $(region).find(options.cardSelector ?? 'a[href]');
    const items = $('<ul>');
    const seen = new Set<string>();
    cards.each((_, raw) => {
      const card = $(raw);
      const link = card.is('a[href]') ? card : card.find('a[href]').first();
      const url = urlFor(link.attr('href'), page.url);
      if (!url || !http(url) || !allowed(url) || seen.has(url.href)) return;
      const relatedNode = related.get(linkKey(url));
      const duration = text((options.durationSelector ? card.find(options.durationSelector).first().text() : '') ||
        text(relatedNode?.duration) || text(relatedNode?.timeRequired));
      const fallback = link.clone();
      fallback.find(['img', options.durationSelector, options.descriptionSelector].filter(Boolean).join(',')).remove();
      const title = text(card.find(options.titleSelector ?? '[data-title], h2, h3, h4').first().text()) ||
        name(relatedNode) || text(link.attr('aria-label')) || text(fallback.text());
      if (!title) return;
      const description = text(relatedNode?.description) ||
        (options.descriptionSelector ? text(card.find(options.descriptionSelector).first().text()) : '');
      const suffix = [duration && ` — ${durationText(duration)}`, description && `: ${description}`].join('');
      items.append($('<li>').append($('<a>').attr('href', url.href).text(title), $('<span>').text(suffix)));
      seen.add(url.href);
    });
    if (items.children().length) $(region).empty().append(items);
  });
}
