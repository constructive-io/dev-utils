import { isEntity, list, name, sameRoute, text, types, urlFor } from './entities';
import { http, markdownHref } from './navigation';
import { inline } from './render';
import type { Entity, ParsedPage } from './types';

export const schemaType = (value: string) => value.replace(/^https?:\/\/schema\.org\//, '').replace(/^schema:/, '');

export function entityId(value: unknown, base: URL): string | undefined {
  return urlFor(value, base)?.href;
}

export function pageEntities(page: ParsedPage): Map<string, Entity> {
  const result = new Map<string, Entity>();
  const add = (node: Entity) => {
    const id = entityId(node, page.url);
    if (node['@id'] && node['@type'] && id && !result.has(id)) result.set(id, node);
  };
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (isEntity(value)) {
      add(value);
      Object.values(value).forEach(visit);
    }
  };
  page.jsonld.forEach(add);
  page.jsonld.forEach(visit);
  return result;
}

export function resolveEntity(value: unknown, page: ParsedPage, byId: ReadonlyMap<string, Entity>): Entity | undefined {
  return byId.get(entityId(value, page.url) ?? '') ?? (isEntity(value) && value['@type'] ? value : undefined);
}

export function pageSubject(page: ParsedPage, byId: ReadonlyMap<string, Entity>): Entity | undefined {
  const nodes = page.jsonld.filter((node) => {
    if (!types(node).some((type) => /Page$/.test(schemaType(type)))) return false;
    const url = urlFor(node.url || node['@id'], page.url);
    return url && sameRoute(url, page.url);
  });
  if (nodes.length !== 1) return undefined;
  const refs = list(nodes[0].mainEntity);
  return refs.length === 1 ? resolveEntity(refs[0], page, byId) : undefined;
}

const defaults = ['creator', 'author', 'founder', 'datePublished', 'startDate', 'endDate', 'codeRepository', 'isPartOf', 'subjectOf'];
const fieldLabels: Readonly<Record<string, string>> = {
  codeRepository: 'Repository',
  isPartOf: 'Part of',
  hasPart: 'Includes',
  subjectOf: 'Related coverage',
  sameAs: 'Related link',
  url: 'Website',
  datePublished: 'Published',
};

const linkFields = new Set(['url', 'sameAs', 'codeRepository', 'downloadUrl', 'installUrl']);
const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function renderFacts({
  subject, page, byId, body, fields, allowed, clean, filter,
}: {
  subject: Entity;
  page: ParsedPage;
  byId: ReadonlyMap<string, Entity>;
  body: string;
  fields?: readonly string[];
  allowed: (url: URL) => boolean;
  clean: (value: string) => string;
  filter: (entity: Entity) => boolean;
}): string[] {
  const normalizedBody = ` ${normalized(body)} `;
  const output: string[] = [];
  const seen = new Set<string>();
  const type = types(subject).map(schemaType).join(', ');
  const add = (label: string, value: string, key = value) => {
    const needle = normalized(key);
    if (!needle || normalizedBody.includes(` ${needle} `) || seen.has(needle)) return;
    seen.add(needle);
    output.push(`> ${inline(label)}: ${value}`);
  };
  if (type) add('Type', inline(clean(type)), type);
  for (const field of new Set(fields ?? defaults)) {
    if (output.length >= 5) break;
    const label = fieldLabels[field] ?? field.replace(/^[a-z]|[A-Z]/g, (letter, offset: number) => offset ? ` ${letter.toLowerCase()}` : letter.toUpperCase());
    if (!/^[a-z][a-zA-Z]*$/.test(field) || ['description', 'name', 'headline'].includes(field)) continue;
    const entries = list(subject[field]).slice(0, 5);
    for (const value of entries) {
      if (output.length >= 5) break;
      const related = resolveEntity(value, page, byId);
      if (related && !filter(related)) continue;
      if (linkFields.has(field)) {
        const url = urlFor(value, page.url);
        if (!url || !http(url) || !allowed(url) || sameRoute(url, page.url)) continue;
        add(label, `[${inline(clean(name(related) || label))}](${markdownHref(url)})`, url.href);
        continue;
      }
      const valueText = clean(name(related) || text(related?.roleName) ||
        (typeof value === 'number' ? String(value) : text(value)));
      if (valueText && valueText.length <= 180) add(label, inline(valueText), valueText);
    }
  }
  return output;
}
