/**
 * YAML template parser — resolves import-yaml directives and
 * substitutes ${{yamlize.VAR}} template variables from context.
 */

import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { dirname, join } from 'path';

// nested-obj uses `export default` which requires runtime resolution
// eslint-disable-next-line @typescript-eslint/no-require-imports
const objectPath = require('nested-obj').default ?? require('nested-obj');

import type { YamlizeContext, YamlNode } from './types';

function replaceTemplates(str: string, context: YamlizeContext): string {
  const templateRegex = /\${{\s*([^.\s]+)\.([^}\s]+)\s*}}/g;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;

  while ((match = templateRegex.exec(str)) !== null) {
    matches.push(match);
  }

  // Replace from end to start to preserve indices
  for (let i = matches.length - 1; i >= 0; i--) {
    match = matches[i];
    const fullMatch = match[0];
    const type = match[1];
    const key = match[2];

    if (type !== 'yamlize') continue;

    if (!objectPath.has(context as Record<string, unknown>, key)) {
      throw new Error(`Template var missing: ${key}`);
    }

    const replacement = String(
      objectPath.get(context as Record<string, unknown>, key)
    );
    str =
      str.substring(0, match.index) +
      replacement +
      str.substring(match.index + fullMatch.length);
  }

  return str;
}

/**
 * Recursively parse a YAML structure, resolving import-yaml
 * directives and substituting template variables.
 */
export function parse(obj: YamlNode, dir: string, context: YamlizeContext): YamlNode {
  if (typeof obj === 'string') {
    return replaceTemplates(obj, context);
  }

  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj as unknown as YamlNode;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => parse(item, dir, context));
  }

  const record = obj as Record<string, YamlNode>;
  const result: Record<string, YamlNode> = {};
  let importedYaml: Record<string, YamlNode> = {};

  if (record['import-yaml']) {
    const importPath = record['import-yaml'] as string;
    const yamlFile = join(dir, importPath);
    const content = readFileSync(yamlFile, 'utf8');
    const parsed = yaml.load(content) as YamlNode;
    importedYaml = parse(parsed, dirname(yamlFile), context) as Record<string, YamlNode>;
  }

  for (const attr of Object.keys(record)) {
    if (attr === 'import-yaml') continue;
    result[attr] = parse(record[attr], dir, context);
  }

  return { ...result, ...importedYaml };
}
