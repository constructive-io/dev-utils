import type { K8sManifest } from './types';

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function deepMerge(base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(overrides)) {
    const overrideVal = overrides[key];

    if (overrideVal === undefined || overrideVal === null) {
      continue;
    }

    if (isPlainObject(overrideVal) && isPlainObject(base[key])) {
      result[key] = deepMerge(base[key] as Record<string, unknown>, overrideVal);
    } else {
      result[key] = overrideVal;
    }
  }

  return result;
}

export function merge(base: K8sManifest, overrides: Partial<K8sManifest>): K8sManifest {
  return deepMerge(
    base as unknown as Record<string, unknown>,
    overrides as unknown as Record<string, unknown>
  ) as unknown as K8sManifest;
}
