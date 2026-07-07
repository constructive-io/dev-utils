/**
 * Main yamlize entry point — file-based and programmatic APIs.
 */

import fs from 'fs';
import yaml from 'js-yaml';
import { sync as mkdirp } from 'mkdirp';
import { dirname } from 'path';

import type { YamlizeContext, YamlizeOptions, YamlNode } from './types';
import { parse } from './parse';

/**
 * Read a YAML template file, resolve imports and variables,
 * and write the result to an output file.
 */
export function yamlize(
  metaYamlFile: string,
  outFile: string,
  context: YamlizeContext
): void {
  const metaYamlContent = fs.readFileSync(metaYamlFile, 'utf-8');
  const metaYamlDir = dirname(metaYamlFile);
  const metaYaml = yaml.load(metaYamlContent) as YamlNode;

  const out = parse(metaYaml, metaYamlDir, context);

  const yamlOutput = yaml.dump(out, { lineWidth: -1 });

  mkdirp(dirname(outFile));
  fs.writeFileSync(outFile, yamlOutput);
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
  const parsed = yaml.load(yamlContent) as YamlNode;
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
 * Serialize a value to a YAML string.
 */
export function toYaml(obj: unknown): string {
  return yaml.dump(obj, { lineWidth: -1 });
}

/**
 * Parse a YAML string into a JavaScript value.
 */
export function fromYaml(str: string): unknown {
  return yaml.load(str);
}
