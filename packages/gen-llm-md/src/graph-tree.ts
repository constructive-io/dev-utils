import { isEntity, list, name, text, types, urlFor } from './entities';
import { entityId, pageEntities, schemaType } from './facts';
import { http, routeKey } from './navigation';
import { matches } from './source';
import type { Entity, GraphSection, GraphTreeRules, ParsedPage, Placement } from './types';

type Node = { entity: Entity; page: ParsedPage };
type Row = { placement: Placement; node?: Node; document?: Node; page: ParsedPage };
const schemaTypes = (entity: Entity) => types(entity).map(schemaType);
const pageType = (entity: Entity) => schemaTypes(entity).some((type) => type.endsWith('Page'));
const id = ({ entity, page }: Node) => entityId(entity, page.url);
const identities = ({ node, document }: Row) => [node && id(node), document && id(document)]
  .filter((key): key is string => key !== undefined);

function refs(node: Node, relation: string): string[] {
  return list(node.entity[relation]).flatMap((ref) => {
    if (isEntity(ref) && 'itemListElement' in ref) return refs({ ...node, entity: ref }, 'itemListElement');
    const target = entityId(isEntity(ref) && ref.item ? ref.item : ref, node.page.url);
    return target ? [target] : [];
  });
}

function rank(entity: Entity | undefined, property = 'rank') {
  if (!entity) return;
  for (const key of [property, 'position']) {
    const value = entity[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  for (const key of ['datePublished', 'startDate', 'dateCreated']) {
    const value = Date.parse(text(entity[key]));
    if (Number.isFinite(value)) return -value;
  }
}

export function deriveGraphTree(
  pages: ReadonlyMap<string, ParsedPage>, sections: readonly GraphSection[], rules: GraphTreeRules,
) {
  const nodes = new Map<string, Node>();
  const rows = new Map<string, Row>();
  for (const [route, page] of pages) {
    const local = pageEntities(page);
    for (const [key, entity] of local) if (!nodes.has(key)) nodes.set(key, { entity, page });
    const matchesRoute = (value: unknown, allowFragment = true) => {
      const url = urlFor(value, page.url);
      return url?.origin === page.url.origin && routeKey(url.pathname) === route &&
        (allowFragment || ['', '#page', '#webpage', '#home', '#profilepage'].includes(url.hash.toLowerCase()));
    };
    const matched = page.jsonld.filter((entity) =>
      list(entity.url).some((url) => matchesRoute(url)) ||
      list(entity.mainEntityOfPage).some((url) => matchesRoute(url)) ||
      matchesRoute(entity['@id'], !!route || pageType(entity)));
    const document = matched.find(pageType);
    const primaryIds = document ? refs({ entity: document, page }, 'mainEntity') : [];
    const primary = primaryIds.length === 1 ? local.get(primaryIds[0]) : undefined;
    const entity = [primary, document, ...matched].find((node) =>
      node && name(node) && !schemaTypes(node).includes('WebSite'));
    const section = sections.find((section) =>
      (!section.match || matches(page, section.match)) &&
      (!section.types || entity && schemaTypes(entity).some((type) => section.types?.includes(type))));
    if (!section) throw new Error(`No graph tree section matches ${page.route}`);
    rows.set(route, {
      page, node: entity && { page, entity }, document: document && { page, entity: document },
      placement: {
        key: `page:${page.route}`, route: page.route, tier: 'page', parentKey: section.key,
        rank: rank(entity, rules.rankProperty),
        title: name(entity) || undefined,
        summary: text(entity?.description) || text(document?.description) || page.meta('description'),
      },
    });
  }

  const pageIds = new Map<string, Row[]>();
  for (const row of rows.values()) {
    for (const key of new Set(identities(row))) pageIds.set(key, [...(pageIds.get(key) ?? []), row]);
  }
  function wouldCycle(child: Row, parent: Row): boolean {
    let key: string | undefined = parent.placement.key;
    while (key?.startsWith('page:')) {
      if (key === child.placement.key) return true;
      key = rows.get(routeKey(key.slice(5)))?.placement.parentKey;
    }
    return false;
  }

  const relations = rules.parents ?? ['isPartOf', 'parentOrganization', 'hasPart', 'creator', 'subjectOf'];
  for (const [route, row] of rows) {
    if (!route) continue;
    const section = row.placement.parentKey;
    for (const relation of relations) {
      if (!row.node) break;
      const keys = identities(row);
      const related = relation === 'hasPart'
        ? [...rows.values()].filter(({ node, document }) =>
          [node, document].some((target) => target && refs(target, relation).some((ref) => keys.includes(ref))))
        : [row.node, row.document].flatMap((node) =>
          node ? refs(node, relation).flatMap((ref) => pageIds.get(ref) ?? []) : []);
      const parent = related.find((candidate) => routeKey(candidate.page.route) !== '' && !wouldCycle(row, candidate));
      if (parent) {
        row.placement.parentKey = parent.placement.key;
        break;
      }
    }
    if (row.placement.parentKey !== section) continue;
    const routeParts = route.split('/');
    while (routeParts.length > 2) {
      routeParts.pop();
      const parent = rows.get(routeParts.join('/'));
      if (parent && !wouldCycle(row, parent)) {
        row.placement.parentKey = parent.placement.key;
        break;
      }
    }
  }

  const placements = [...rows.values()].map(({ placement }) => placement);
  const subjects = new Map([...rows].flatMap(([route, { node }]) => node ? [[route, node.entity] as const] : []));
  if (!rules.context) return { placements, subjects };
  const contextual = new Set<string>();
  for (const { node, document, page, placement } of rows.values()) {
    for (const relation of rules.context.relations) {
      for (const ref of [node, document].flatMap((target) => target ? refs(target, relation) : [])) {
        if (pageIds.has(ref) || contextual.has(ref)) continue;
        const target = nodes.get(ref);
        if (!target || !name(target.entity) ||
            !schemaTypes(target.entity).some((type) => rules.context?.types.includes(type))) continue;
        const url = urlFor(target.entity.url, target.page.url);
        if (url?.origin === page.url.origin && rows.has(routeKey(url.pathname))) continue;
        const external = url && http(url) && url.origin !== page.url.origin;
        const tier = external ? rules.context.external ?? 'optional' : 'child';
        if (tier === 'omit') continue;
        contextual.add(ref);
        placements.push({
          key: `ref:${ref}`, tier, parentKey: tier === 'child' ? placement.key : undefined,
          title: name(target.entity), summary: text(target.entity.description), href: tier === 'optional' ? url?.href : undefined,
          rank: rank(target.entity, rules.rankProperty),
        });
      }
    }
  }
  return { placements, subjects };
}
