import type { K8sManifest } from './types';

function indent(level: number): string {
  return '  '.repeat(level);
}

function serializeValue(val: unknown, level: number): string {
  if (val === null || val === undefined) {
    return 'null';
  }

  if (typeof val === 'boolean') {
    return String(val);
  }

  if (typeof val === 'number') {
    return String(val);
  }

  if (typeof val === 'string') {
    if (
      val === '' ||
      val === 'true' ||
      val === 'false' ||
      val === 'null' ||
      val === 'yes' ||
      val === 'no' ||
      /^[0-9]/.test(val) ||
      val.includes(':') ||
      val.includes('#') ||
      val.includes("'") ||
      val.includes('"') ||
      val.includes('\n') ||
      val.includes('{') ||
      val.includes('}') ||
      val.includes('[') ||
      val.includes(']') ||
      val.includes(',') ||
      val.includes('*') ||
      val.includes('&') ||
      val.includes('!') ||
      val.includes('|') ||
      val.includes('>') ||
      val.includes('%') ||
      val.includes('@') ||
      val.includes('`')
    ) {
      return JSON.stringify(val);
    }
    return val;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';

    const lines: string[] = [];
    for (const item of val) {
      if (isPlainObject(item)) {
        const objLines = serializeObject(item as Record<string, unknown>, level + 1);
        const firstLine = objLines[0];
        lines.push(`${indent(level)}- ${firstLine.trimStart()}`);
        for (let i = 1; i < objLines.length; i++) {
          lines.push(`${indent(level)}  ${objLines[i].trimStart()}`);
        }
      } else {
        lines.push(`${indent(level)}- ${serializeValue(item, level + 1)}`);
      }
    }
    return '\n' + lines.join('\n');
  }

  if (isPlainObject(val)) {
    const objLines = serializeObject(val as Record<string, unknown>, level);
    return '\n' + objLines.join('\n');
  }

  return String(val);
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function serializeObject(obj: Record<string, unknown>, level: number): string[] {
  const lines: string[] = [];

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined) continue;

    const serialized = serializeValue(val, level + 1);
    if (serialized.startsWith('\n')) {
      lines.push(`${indent(level)}${key}:${serialized}`);
    } else {
      lines.push(`${indent(level)}${key}: ${serialized}`);
    }
  }

  return lines;
}

export function toYaml(manifest: K8sManifest): string {
  const lines = serializeObject(manifest as unknown as Record<string, unknown>, 0);
  return lines.join('\n') + '\n';
}

export function toYamlMulti(manifests: K8sManifest[]): string {
  return manifests.map(toYaml).join('---\n');
}

export function fromYaml(yaml: string): K8sManifest {
  return parseYaml(yaml) as K8sManifest;
}

interface ParseContext {
  lines: string[];
  index: number;
}

function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function parseYaml(text: string): unknown {
  const lines = text.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
  if (lines.length === 0) return {};

  const ctx: ParseContext = { lines, index: 0 };
  return parseMapping(ctx, 0);
}

function parseMapping(ctx: ParseContext, baseIndent: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  while (ctx.index < ctx.lines.length) {
    const line = ctx.lines[ctx.index];
    const currentIndent = getIndentLevel(line);

    if (currentIndent < baseIndent) break;
    if (line.trim().startsWith('---')) {
      ctx.index++;
      break;
    }

    if (line.trim().startsWith('- ')) break;

    const keyMatch = line.trim().match(/^([^:]+?):\s*(.*)/);
    if (!keyMatch) {
      ctx.index++;
      continue;
    }

    const key = keyMatch[1].trim();
    const valueStr = keyMatch[2].trim();

    ctx.index++;

    if (valueStr === '' || valueStr === '|' || valueStr === '>') {
      if (ctx.index < ctx.lines.length) {
        const nextLine = ctx.lines[ctx.index];
        const nextIndent = getIndentLevel(nextLine);
        if (nextIndent > currentIndent) {
          if (nextLine.trim().startsWith('- ')) {
            result[key] = parseSequence(ctx, nextIndent);
          } else {
            result[key] = parseMapping(ctx, nextIndent);
          }
        } else {
          result[key] = null;
        }
      } else {
        result[key] = null;
      }
    } else {
      result[key] = parseScalar(valueStr);
    }
  }

  return result;
}

function parseSequence(ctx: ParseContext, baseIndent: number): unknown[] {
  const result: unknown[] = [];

  while (ctx.index < ctx.lines.length) {
    const line = ctx.lines[ctx.index];
    const currentIndent = getIndentLevel(line);

    if (currentIndent < baseIndent) break;
    if (!line.trim().startsWith('- ')) break;

    const content = line.trim().slice(2).trim();
    ctx.index++;

    if (content === '') {
      if (ctx.index < ctx.lines.length) {
        const nextIndent = getIndentLevel(ctx.lines[ctx.index]);
        if (nextIndent > currentIndent) {
          result.push(parseMapping(ctx, nextIndent));
        } else {
          result.push(null);
        }
      }
    } else if (content.includes(':')) {
      const obj = parseInlineMapping(content);
      if (ctx.index < ctx.lines.length) {
        const nextIndent = getIndentLevel(ctx.lines[ctx.index]);
        if (nextIndent > currentIndent) {
          const nested = parseMapping(ctx, nextIndent);
          Object.assign(obj, nested);
        }
      }
      result.push(obj);
    } else {
      result.push(parseScalar(content));
    }
  }

  return result;
}

function parseInlineMapping(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const match = content.match(/^([^:]+?):\s*(.*)/);
  if (match) {
    result[match[1].trim()] = parseScalar(match[2].trim());
  }
  return result;
}

function parseScalar(val: string): unknown {
  if (val === 'null' || val === '~') return null;
  if (val === 'true') return true;
  if (val === 'false') return false;

  if (val.startsWith('"') && val.endsWith('"')) {
    return val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1);
  }

  if (val === '[]') return [];
  if (val === '{}') return {};

  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);

  return val;
}
