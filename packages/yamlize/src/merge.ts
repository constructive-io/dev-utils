/**
 * Deep merge for YAML/JSON objects with configurable null semantics.
 *
 * Default behavior: null/undefined values in overrides are skipped
 * (the base value is inherited). Set `nullRemoves: true` to delete
 * keys when overrides set them to null.
 */

import type { MergeOptions, YamlNode } from './types';

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Deep-merge `base` with `overrides`. Arrays are replaced, not concatenated.
 */
export function merge(
  base: Record<string, YamlNode>,
  overrides: Record<string, YamlNode>,
  options?: MergeOptions
): Record<string, YamlNode> {
  const result: Record<string, YamlNode> = { ...base };
  const nullRemoves = options?.nullRemoves ?? false;

  for (const key of Object.keys(overrides)) {
    const overrideVal = overrides[key];

    if (overrideVal === undefined) continue;

    if (overrideVal === null) {
      if (nullRemoves) {
        delete result[key];
      }
      // default: skip null → inherit from base
      continue;
    }

    const baseVal = result[key];

    if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
      result[key] = merge(
        baseVal as Record<string, YamlNode>,
        overrideVal as Record<string, YamlNode>,
        options
      );
    } else {
      result[key] = overrideVal;
    }
  }

  return result;
}

/**
 * Shallow merge where null/undefined values in overrides are skipped.
 * Useful for config override patterns (e.g. server_definitions → server_deployments).
 */
export function mergeNullable<T extends Record<string, unknown>>(
  base: T,
  overrides: Partial<T>
): T {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== null && value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}
