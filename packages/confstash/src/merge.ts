import type { ArrayMergeStrategy, ConfigLayer, ExplainedValue } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Deep-merge two values. Plain objects merge recursively; arrays follow the
 * given strategy ('replace' by default — matching @pgpmjs/env semantics);
 * everything else: source wins.
 */
export function deepMerge(
  target: unknown,
  source: unknown,
  arrayMerge: ArrayMergeStrategy = 'replace'
): unknown {
  if (Array.isArray(target) && Array.isArray(source)) {
    return arrayMerge === 'concat' ? [...target, ...source] : [...source];
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    const out: Record<string, unknown> = { ...target };
    for (const key of Object.keys(source)) {
      const sv = source[key];
      if (sv === undefined) continue;
      out[key] = key in out ? deepMerge(out[key], sv, arrayMerge) : cloneValue(sv);
    }
    return out;
  }
  return cloneValue(source);
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) out[key] = cloneValue(value[key]);
    return out;
  }
  return value;
}

/** Merge layers in order (lowest precedence first). */
export function mergeLayers<T>(
  layers: ConfigLayer<T>[],
  arrayMerge: ArrayMergeStrategy = 'replace'
): T {
  let acc: unknown = {};
  for (const layer of layers) {
    acc = deepMerge(acc, layer.config, arrayMerge);
  }
  return acc as T;
}

/**
 * Explain the provenance of every leaf value in the merged config: for each
 * dotted path, which layer supplied the winning value.
 */
export function explainLayers<T>(
  layers: ConfigLayer<T>[],
  arrayMerge: ArrayMergeStrategy = 'replace'
): ExplainedValue[] {
  const merged = mergeLayers(layers, arrayMerge) as Record<string, unknown>;
  const out: ExplainedValue[] = [];

  const walk = (value: unknown, pathParts: string[]) => {
    if (isPlainObject(value)) {
      for (const key of Object.keys(value)) walk(value[key], [...pathParts, key]);
      return;
    }
    const dotted = pathParts.join('.');
    const winner = findWinner(layers, pathParts, value);
    out.push({
      path: dotted,
      value,
      source: winner?.source ?? 'defaults',
      origin: winner?.origin ?? 'unknown'
    });
  };

  walk(merged, []);
  return out;
}

function findWinner<T>(
  layers: ConfigLayer<T>[],
  pathParts: string[],
  finalValue: unknown
): ConfigLayer<T> | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const candidate = getPath(layers[i].config as Record<string, unknown>, pathParts);
    if (candidate === undefined) continue;
    // Arrays with 'concat' can be composites of multiple layers; attribute to
    // the last contributing layer regardless.
    if (deepEqual(candidate, finalValue) || Array.isArray(finalValue)) {
      return layers[i];
    }
    // The last layer that defines the path wins under deepMerge for scalars.
    return layers[i];
  }
  return null;
}

function getPath(obj: Record<string, unknown>, pathParts: string[]): unknown {
  let cur: unknown = obj;
  for (const part of pathParts) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[part];
    if (cur === undefined) return undefined;
  }
  return cur;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}
