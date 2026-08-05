/**
 * Main yamlize entry point — file-based and programmatic APIs.
 */

import fs from 'fs';
import { sync as mkdirp } from 'mkdirp';
import { dirname } from 'path';
import { Document, parse as parseYaml } from 'yaml';

import { applyComments } from './comments';
import { parse } from './parse';
import type {
  ToYamlOptions,
  YamlizeContext,
  YamlizeOptions,
  YamlNode,
} from './types';

/**
 * Read a YAML template file, resolve imports and variables,
 * and write the result to an output file.
 */
export function yamlize(
  metaYamlFile: string,
  outFile: string,
  context: YamlizeContext,
  options?: ToYamlOptions
): void {
  const metaYamlContent = fs.readFileSync(metaYamlFile, 'utf-8');
  const metaYamlDir = dirname(metaYamlFile);
  const metaYaml = parseYaml(metaYamlContent) as YamlNode;

  const out = parse(metaYaml, metaYamlDir, context);

  mkdirp(dirname(outFile));
  fs.writeFileSync(outFile, toYaml(out, options));
}

/**
 * Programmatic API — resolve a YAML template string (or parsed object)
 * against a context, returning the resolved object.
 */
export function yamlizeString(
  yamlContent: string,
  context: YamlizeContext,
  options?: YamlizeOptions
): YamlNode {
  const parsed = parseYaml(yamlContent) as YamlNode;
  const dir = options?.baseDir ?? process.cwd();
  return parse(parsed, dir, context);
}

/**
 * Programmatic API — resolve a parsed YAML object against a context.
 */
export function yamlizeObject(
  obj: YamlNode,
  context: YamlizeContext,
  options?: YamlizeOptions
): YamlNode {
  const dir = options?.baseDir ?? process.cwd();
  return parse(obj, dir, context);
}

/**
 * Serialize a value to a YAML string, optionally attaching comments.
 *
 * Wrapping is off by default: a generated file is diffed on every change, and
 * re-wrapped long values turn a one-word edit into a multi-line diff.
 */
export function toYaml(obj: unknown, options?: ToYamlOptions): string {
  const doc = new Document(obj);
  if (options?.comments) {
    applyComments(doc, options.comments);
  }
  return doc.toString({ lineWidth: options?.lineWidth ?? 0 });
}

/**
 * Parse a YAML string into a JavaScript value.
 */
export function fromYaml(str: string): unknown {
  return parseYaml(str);
}
