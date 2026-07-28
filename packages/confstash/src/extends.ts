import * as path from 'path';

import { loadFileSync } from './loaders';
import type { ConfigLayer } from './types';

export interface ExtendsContext<T> {
  presets: Record<string, Partial<T>>;
  /** Directory used to resolve relative / npm `extends` entries. */
  baseDir: string;
}

interface ExtendableConfig {
  extends?: string | string[];
  [key: string]: unknown;
}

/**
 * Expand a config object's `extends` chain into an ordered list of layers
 * (lowest precedence first, the config itself last with `extends` stripped).
 *
 * Entries resolve as:
 *  - a name present in `presets` (e.g. `safegres:recommended`)
 *  - a relative path (`./preset.js`, `../shared/preset.json`)
 *  - an npm package name (resolved from `baseDir`)
 */
export function expandExtends<T>(
  config: Partial<T>,
  ctx: ExtendsContext<T>,
  origin: string,
  seen: Set<string> = new Set()
): ConfigLayer<T>[] {
  const { extends: extendsField, ...rest } = config as ExtendableConfig;
  const layers: ConfigLayer<T>[] = [];

  const entries =
    extendsField == null ? [] : Array.isArray(extendsField) ? extendsField : [extendsField];

  for (const entry of entries) {
    if (seen.has(entry)) {
      throw new Error(`Circular "extends" detected: "${entry}" (chain: ${[...seen].join(' -> ')})`);
    }

    const resolved = resolveEntry(entry, ctx);
    const nextSeen = new Set(seen).add(entry);
    layers.push(
      ...expandExtends<T>(resolved.config, { ...ctx, baseDir: resolved.baseDir }, resolved.origin, nextSeen)
    );
  }

  layers.push({
    source: origin.startsWith('preset:') ? 'preset' : 'file',
    origin,
    config: rest as Partial<T>
  });

  return layers;
}

function resolveEntry<T>(
  entry: string,
  ctx: ExtendsContext<T>
): { config: Partial<T>; origin: string; baseDir: string } {
  // 1. Named preset
  if (entry in ctx.presets) {
    return { config: ctx.presets[entry], origin: `preset:${entry}`, baseDir: ctx.baseDir };
  }

  // 2. Relative or absolute path
  if (entry.startsWith('.') || path.isAbsolute(entry)) {
    const filepath = path.resolve(ctx.baseDir, entry);
    return {
      config: loadFileSync({ filepath }) as Partial<T>,
      origin: filepath,
      baseDir: path.dirname(filepath)
    };
  }

  // 3. npm package
  try {
    const resolved = require.resolve(entry, { paths: [ctx.baseDir] });
    return {
      config: loadFileSync({ filepath: resolved }) as Partial<T>,
      origin: resolved,
      baseDir: path.dirname(resolved)
    };
  } catch (err) {
    throw new Error(
      `Cannot resolve "extends": "${entry}" — not a known preset (${
        Object.keys(ctx.presets).join(', ') || 'none registered'
      }), file path, or installed package. ${(err as Error).message}`
    );
  }
}
