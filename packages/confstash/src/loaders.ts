import * as fs from 'fs';
import yaml from 'js-yaml';
import * as path from 'path';

import type { FoundConfig } from './discover';

export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly filepath: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * Load a config file synchronously. Supports .json, .yaml/.yml, extensionless
 * rc files (JSON or YAML), .js/.cjs (require), and .ts (require — needs a TS
 * runtime like ts-node/tsx registered). `.mjs` requires the async loader.
 */
export function loadFileSync(found: FoundConfig): Record<string, unknown> {
  const { filepath, packageJsonKey } = found;

  if (packageJsonKey) {
    const pkg = parseJsonFile(filepath);
    return asObject(pkg[packageJsonKey], filepath, `package.json key "${packageJsonKey}"`);
  }

  const ext = path.extname(filepath);
  switch (ext) {
  case '.json':
    return asObject(parseJsonFile(filepath), filepath, 'JSON config');
  case '.yaml':
  case '.yml':
    return asObject(parseYamlFile(filepath), filepath, 'YAML config');
  case '.js':
  case '.cjs':
  case '.ts':
    return requireModule(filepath);
  case '.mjs':
    throw new ConfigLoadError(
      `Cannot load ESM config "${filepath}" synchronously — use the async loader (load()) instead.`,
      filepath
    );
  case '': {
    // extensionless rc file: try JSON first, then YAML
    const raw = fs.readFileSync(filepath, 'utf8');
    try {
      return asObject(JSON.parse(raw), filepath, 'rc config');
    } catch {
      return asObject(yaml.load(raw), filepath, 'rc config');
    }
  }
  default:
    throw new ConfigLoadError(`Unsupported config file type: ${ext}`, filepath);
  }
}

/** Async variant of {@link loadFileSync} that additionally supports `.mjs` and ESM `.js`. */
export async function loadFile(found: FoundConfig): Promise<Record<string, unknown>> {
  const { filepath } = found;
  const ext = path.extname(filepath);

  if (ext === '.mjs') {
    return importModule(filepath);
  }
  if (ext === '.js' || ext === '.ts') {
    try {
      return loadFileSync(found);
    } catch (err) {
      // ESM ".js" (package "type": "module") fails require() — fall back to import()
      if (isEsmRequireError(err)) {
        return importModule(filepath);
      }
      throw err;
    }
  }
  return loadFileSync(found);
}

function isEsmRequireError(err: unknown): boolean {
  const code = (err as { cause?: { code?: string }; code?: string })?.code
    ?? (err as { cause?: { code?: string } })?.cause?.code;
  return code === 'ERR_REQUIRE_ESM';
}

function requireModule(filepath: string): Record<string, unknown> {
  try {
    delete require.cache[require.resolve(filepath)];
     
    const mod = require(filepath);
    return asObject(mod?.default ?? mod, filepath, 'module config');
  } catch (err) {
    if (isEsmRequireError(err)) throw err;
    throw new ConfigLoadError(
      `Failed to load config module "${filepath}": ${(err as Error).message}`,
      filepath,
      err
    );
  }
}

async function importModule(filepath: string): Promise<Record<string, unknown>> {
  try {
    const { pathToFileURL } = require('url') as typeof import('url');
    // Indirect eval keeps bundlers/transpilers (tsc CJS output, jest) from
    // rewriting the dynamic import into a require(), which cannot load ESM.
    const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
    const mod = await dynamicImport(pathToFileURL(filepath).href);
    return asObject(mod?.default ?? mod, filepath, 'module config');
  } catch (err) {
    throw new ConfigLoadError(
      `Failed to import config module "${filepath}": ${(err as Error).message}`,
      filepath,
      err
    );
  }
}

function parseJsonFile(filepath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filepath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new ConfigLoadError(
      `Invalid JSON in "${filepath}": ${(err as Error).message}`,
      filepath,
      err
    );
  }
}

function parseYamlFile(filepath: string): unknown {
  const raw = fs.readFileSync(filepath, 'utf8');
  try {
    return yaml.load(raw);
  } catch (err) {
    throw new ConfigLoadError(
      `Invalid YAML in "${filepath}": ${(err as Error).message}`,
      filepath,
      err
    );
  }
}

function asObject(
  value: unknown,
  filepath: string,
  what: string
): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ConfigLoadError(
      `Expected ${what} in "${filepath}" to be an object, got ${Array.isArray(value) ? 'array' : typeof value}.`,
      filepath
    );
  }
  return value as Record<string, unknown>;
}
