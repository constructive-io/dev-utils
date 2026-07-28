import * as fs from 'fs';
import * as path from 'path';
import { appstash, resolve as stashResolve } from 'appstash';

import { defaultSearchPlaces, findConfigSync, type FoundConfig } from './discover';
import { expandExtends } from './extends';
import { loadFile, loadFileSync } from './loaders';
import { explainLayers, mergeLayers } from './merge';
import type {
  ConfigLayer,
  ConfigLoaderOptions,
  ExplainedValue,
  LoadParams,
  LoadResult
} from './types';

export interface ConfigLoader<T = Record<string, unknown>> {
  /** Discover, load, and merge all config layers (async — supports ESM configs). */
  load(params?: LoadParams<T>): Promise<LoadResult<T>>;
  /** Synchronous variant (no `.mjs` / ESM support). */
  loadSync(params?: LoadParams<T>): LoadResult<T>;
  /** Per-key provenance of the resolved config (for `print-config` UX). */
  explainSync(params?: LoadParams<T>): ExplainedValue[];
  /** The search places this loader uses. */
  searchPlaces: ReturnType<typeof defaultSearchPlaces>;
}

export function createConfigLoader<T = Record<string, unknown>>(
  options: ConfigLoaderOptions<T>
): ConfigLoader<T> {
  const searchPlaces = options.searchPlaces ?? defaultSearchPlaces(options.tool);
  const presets = options.presets ?? {};
  const arrayMerge = options.arrayMerge ?? 'replace';
  const walkUp = options.walkUp ?? true;

  function discover(params: LoadParams<T>): FoundConfig | null {
    if (params.configFile) {
      const filepath = path.resolve(params.cwd ?? process.cwd(), params.configFile);
      if (!fs.existsSync(filepath)) {
        throw new Error(`Config file not found: ${filepath}`);
      }
      return { filepath };
    }
    return findConfigSync(params.cwd ?? process.cwd(), searchPlaces, walkUp);
  }

  function buildLayers(
    params: LoadParams<T>,
    found: FoundConfig | null,
    fileConfig: Partial<T> | null
  ): ConfigLayer<T>[] {
    const layers: ConfigLayer<T>[] = [];

    if (options.defaults) {
      layers.push({ source: 'defaults', origin: 'built-in defaults', config: options.defaults });
    }

    if (options.userStash) {
      const user = readUserStash<T>(options.tool);
      if (user) layers.push(user);
    }

    if (found && fileConfig) {
      const baseDir = path.dirname(found.filepath);
      const expanded = expandExtends<T>(fileConfig, { presets, baseDir }, found.filepath);
      layers.push(...expanded);
    }

    if (options.envLayer) {
      const env = params.env ?? process.env;
      const envConfig = options.envLayer(env);
      if (envConfig && Object.keys(envConfig).length > 0) {
        layers.push({ source: 'env', origin: 'environment variables', config: envConfig });
      }
    }

    if (params.overrides && Object.keys(params.overrides).length > 0) {
      layers.push({ source: 'overrides', origin: 'runtime overrides', config: params.overrides });
    }

    return layers;
  }

  function finalize(params: LoadParams<T>, found: FoundConfig | null, fileConfig: Partial<T> | null): LoadResult<T> {
    const layers = buildLayers(params, found, fileConfig);
    let config = mergeLayers(layers, arrayMerge);
    if (options.validate) {
      const validated = options.validate(config);
      if (validated !== undefined) config = validated as T;
    }
    return {
      config,
      filepath: found?.filepath,
      layers,
      isEmpty: found == null
    };
  }

  return {
    searchPlaces,

    async load(params: LoadParams<T> = {}): Promise<LoadResult<T>> {
      const found = discover(params);
      const fileConfig = found ? ((await loadFile(found)) as Partial<T>) : null;
      return finalize(params, found, fileConfig);
    },

    loadSync(params: LoadParams<T> = {}): LoadResult<T> {
      const found = discover(params);
      const fileConfig = found ? (loadFileSync(found) as Partial<T>) : null;
      return finalize(params, found, fileConfig);
    },

    explainSync(params: LoadParams<T> = {}): ExplainedValue[] {
      const found = discover(params);
      const fileConfig = found ? (loadFileSync(found) as Partial<T>) : null;
      const layers = buildLayers(params, found, fileConfig);
      return explainLayers(layers, arrayMerge);
    }
  };
}

function readUserStash<T>(tool: string): ConfigLayer<T> | null {
  try {
    const dirs = appstash(tool);
    const filepath = stashResolve(dirs, 'config', 'config.json');
    if (!fs.existsSync(filepath)) return null;
    const config = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    if (config == null || typeof config !== 'object' || Array.isArray(config)) return null;
    return { source: 'user', origin: filepath, config: config as Partial<T> };
  } catch {
    return null;
  }
}

/** Identity helper for typed config authoring in `<tool>.config.ts/js`. */
export function defineConfig<T>(config: T & { extends?: string | string[] }): T & { extends?: string | string[] } {
  return config;
}
