import type { Entity, ParsedPage } from './types';

export const isEntity = (value: unknown): value is Entity =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [value];
export const text = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
export const types = (entity: Entity): string[] =>
  list(entity['@type']).map(text).filter(Boolean);
export const name = (entity?: Entity): string =>
  entity ? text(entity.headline) || text(entity.name) : '';

export function entities(value: unknown): Entity[] {
  return list(value).filter(isEntity).flatMap((entity) => [
    ...(entity['@type'] ? [entity] : []),
    ...('@graph' in entity ? entities(entity['@graph']) : []),
  ]);
}

export function urlFor(value: unknown, base: URL): URL | undefined {
  const address = text(isEntity(value) ? value['@id'] || value.url : value);
  if (!address) return;
  try {
    return new URL(address, base);
  } catch {
    return;
  }
}

const pathKey = (url: URL) => url.pathname.replace(/\/$/, '');
export const sameRoute = (a: URL, b: URL) => a.origin === b.origin && pathKey(a) === pathKey(b);

function matches(value: unknown, url: URL): boolean {
  const candidate = urlFor(value, url);
  return !!candidate && sameRoute(candidate, url);
}

function references(page: ParsedPage, value: unknown): Entity[] {
  return list(value).flatMap((ref) => {
    const id = urlFor(ref, page.url)?.href;
    const resolved = id && page.jsonld.find((entity) => urlFor(entity['@id'], page.url)?.href === id);
    return resolved ? [resolved] : isEntity(ref) && ref['@type'] ? [ref] : [];
  });
}

export function selectPageEntity(page: ParsedPage): Entity | undefined {
  const { jsonld, url } = page;
  const matchesPage = (entity: Entity) => {
    const addresses = [...list(entity.url), ...list(entity.mainEntityOfPage)].filter(Boolean);
    if (addresses.length) return addresses.some((value) => matches(value, url));
    const id = urlFor(entity['@id'], url);
    return !!id && sameRoute(id, url) &&
      (!!pathKey(url) || ['', '#page', '#webpage', '#home', '#profilepage'].includes(id.hash.toLowerCase()));
  };
  const candidates = jsonld.filter(matchesPage);
  const pageEntity = candidates.find((entity) => types(entity).some((type) => /Page$/.test(type)));
  if (pageEntity) {
    const primary = references(page, pageEntity.mainEntity).filter((entity) => name(entity));
    if (primary.length === 1) return primary[0];
    if (!name(pageEntity) && types(pageEntity).includes('WebPage')) {
      const subjects = references(page, pageEntity.about).filter((entity) => name(entity));
      if (subjects.length === 1) return subjects[0];
    }
    return pageEntity;
  }
  return candidates.find((entity) => !types(entity).includes('WebSite') && name(entity));
}

export function selectSiteIdentity(page: ParsedPage) {
  const { jsonld, url } = page;
  const websites = jsonld.filter((node) => types(node).includes('WebSite'));
  const canonical = new URL('#website', url).href;
  const website = websites.find((node) => urlFor(node['@id'], url)?.href === canonical &&
    (!node.url || list(node.url).some((value) => matches(value, url))))
    ?? websites.find((node) => list(node.url).some((value) => matches(value, url)));
  const person = references(page, website?.mainEntity).find((node) => types(node).includes('Person'))
    ?? (!website ? jsonld.find((node) => types(node).includes('Person') &&
      (list(node.url).some((value) => matches(value, url)) ||
      urlFor(node['@id'], url)?.href === new URL('#person', url).href)) : undefined);
  return {
    title: name(person) || name(website),
    description: text(website?.description) || text(person?.description),
  };
}
