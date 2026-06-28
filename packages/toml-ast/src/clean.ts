import type { AstNode } from './types';

export function cleanTree<T extends AstNode>(node: T): T {
  if (Array.isArray(node)) {
    return node.map((item) => cleanTree(item)) as unknown as T;
  }

  if (node === null || typeof node !== 'object') {
    return node;
  }

  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node)) {
    if (key === 'range' || key === 'location' || key === 'loc') {
      continue;
    }

    if (Array.isArray(value)) {
      cleaned[key] = value.map((item) => {
        if (item && typeof item === 'object') {
          return cleanTree(item as AstNode);
        }
        return item;
      });
    } else if (value && typeof value === 'object') {
      cleaned[key] = cleanTree(value as AstNode);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned as T;
}

export function astEqual(a: AstNode, b: AstNode): boolean {
  const cleanA = cleanTree(a);
  const cleanB = cleanTree(b);
  return JSON.stringify(cleanA) === JSON.stringify(cleanB);
}

export function printAst(node: AstNode, indent: number = 0): string {
  const spaces = '  '.repeat(indent);

  if (Array.isArray(node)) {
    if (node.length === 0) return '[]';
    const items = node.map((item) => printAst(item, indent + 1));
    return `[\n${items.map((i) => `${spaces}  ${i}`).join(',\n')}\n${spaces}]`;
  }

  if (node === null) return 'null';
  if (typeof node !== 'object') return JSON.stringify(node);

  const entries: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'range') continue;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        entries.push(`${key}: []`);
      } else if (typeof value[0] === 'object') {
        entries.push(`${key}: ${printAst(value as unknown as AstNode, indent + 1)}`);
      } else {
        entries.push(`${key}: ${JSON.stringify(value)}`);
      }
    } else if (value && typeof value === 'object') {
      entries.push(`${key}: ${printAst(value as AstNode, indent + 1)}`);
    } else {
      entries.push(`${key}: ${JSON.stringify(value)}`);
    }
  }

  if (entries.length === 0) return '{}';
  return `{\n${entries.map((e) => `${spaces}  ${e}`).join(',\n')}\n${spaces}}`;
}
