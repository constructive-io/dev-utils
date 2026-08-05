/**
 * Comment attachment for generated YAML.
 *
 * Generated config files are read by people who then have to change them, and
 * a file that cannot say *why* a value is what it is loses the reasoning that
 * produced it. `yaml` (unlike js-yaml) can carry comments, so a generator can
 * hand its rationale to the artifact it writes.
 */

import { Document, isMap, isNode, isPair, isScalar, isSeq } from 'yaml';

import type { CommentMap, CommentOptions, YamlPath } from './types';

/**
 * Normalize a user comment into the form the `yaml` package expects: it writes
 * the `#` itself, so each line is passed without one, and a leading space keeps
 * the output as `# text` rather than `#text`.
 */
function commentText(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.length ? ` ${line}` : ''))
    .join('\n');
}

/** Read either comment map form as a list of path/text pairs. */
function commentEntries(map: CommentMap | undefined): Array<[YamlPath, string]> {
  if (!map) return [];
  return Array.isArray(map) ? map : Object.entries(map);
}

/** Split a dotted path into segments: `a.b.0.c` → `['a', 'b', 0, 'c']`. */
export function splitPath(path: YamlPath): Array<string | number> {
  const parts = Array.isArray(path) ? path : path.split('.');
  return parts.map((part) => {
    if (typeof part === 'number') return part;
    return /^\d+$/.test(part) ? Number(part) : part;
  });
}

/**
 * Find the node a comment should attach to.
 *
 * Which half of a map entry depends on the direction. A comment *above* the
 * entry hangs off the key, because YAML renders it above `key: value`; a
 * trailing comment hangs off the value, because anything on the key would land
 * between the key and its colon. A sequence item has no key either way.
 */
function commentTarget(doc: Document, path: YamlPath, trailing: boolean): unknown {
  const segments = splitPath(path);
  const last = segments[segments.length - 1];
  const parent = walk(doc, segments.slice(0, -1));

  if (isMap(parent)) {
    const pair = parent.items.find(
      (item) => isPair(item) && String(keyOf(item.key)) === String(last)
    );
    if (!isPair(pair)) return undefined;
    if (trailing) {
      pair.value = asNode(doc, pair.value);
      return pair.value;
    }
    pair.key = asNode(doc, pair.key);
    return pair.key;
  }

  if (isSeq(parent)) {
    const index = Number(last);
    parent.items[index] = asNode(doc, parent.items[index]);
    return parent.items[index];
  }

  return undefined;
}

/**
 * Descend to the collection holding the addressed entry.
 *
 * Plain values are replaced by nodes on the way down: `Document.set` stores
 * whatever it is handed, so `set('allowBuilds', { esbuild: true })` leaves a
 * bare object in the tree, and a comment cannot hang off one of its entries
 * until it has been turned into a real map.
 */
function walk(doc: Document, segments: Array<string | number>): unknown {
  let node: unknown = doc.contents;

  for (const segment of segments) {
    if (isMap(node)) {
      const pair = node.items.find(
        (item) => isPair(item) && String(keyOf(item.key)) === String(segment)
      );
      if (!isPair(pair)) return undefined;
      pair.value = asNode(doc, pair.value);
      node = pair.value;
    } else if (isSeq(node)) {
      const index = Number(segment);
      node = node.items[index] = asNode(doc, node.items[index]);
    } else {
      return undefined;
    }
  }

  return node;
}

/** A pair's key as a plain value, whether it is wrapped in a node or not. */
function keyOf(key: unknown): unknown {
  return isScalar(key) ? key.value : key;
}

/**
 * A comment can only hang off a node, and `Document.set` accepts plain values
 * and stores them as-is — so a key or value written that way has to be wrapped
 * before it can be annotated.
 */
function asNode(doc: Document, value: unknown): unknown {
  return isNode(value) ? value : doc.createNode(value);
}

/**
 * Attach comments to a document in place.
 *
 * A path that does not resolve is ignored rather than fatal: comment maps are
 * written once and the shape they annotate is often conditional, so a policy
 * that omits an optional section should not fail to serialize because of it.
 */
export function applyComments(doc: Document, comments: CommentOptions): void {
  if (comments.header) {
    doc.commentBefore = commentText(comments.header);
  }
  if (comments.footer) {
    doc.comment = commentText(comments.footer);
  }

  for (const [path, text] of commentEntries(comments.before)) {
    const node = commentTarget(doc, path, false) as { commentBefore?: string } | undefined;
    if (node) node.commentBefore = commentText(text);
  }

  for (const [path, text] of commentEntries(comments.inline)) {
    const node = commentTarget(doc, path, true) as { comment?: string } | undefined;
    if (node) node.comment = commentText(text);
  }
}
