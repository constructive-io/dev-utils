import type { AstNode } from './types';

/**
 * Remove range/location information from an AST for structural comparison.
 */
export function cleanTree<T>(node: T): T {
  if (Array.isArray(node)) {
    return node.map((item) => cleanTree(item)) as unknown as T;
  }

  if (node === null || typeof node !== 'object') {
    return node;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'loc' || key === 'location') continue;
    cleaned[key] = cleanTree(value);
  }
  return cleaned as unknown as T;
}

/** Deep structural equality for AST nodes (ignoring ranges). */
export function astEqual(a: AstNode, b: AstNode): boolean {
  return JSON.stringify(cleanTree(a)) === JSON.stringify(cleanTree(b));
}

/** Pretty-print an AST node as indented JSON (for debugging). */
export function printAst(node: AstNode): string {
  return JSON.stringify(cleanTree(node), null, 2);
}
