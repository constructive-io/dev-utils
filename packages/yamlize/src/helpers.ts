import type { EnvFromSource } from './types';

/**
 * Returns the standard envFrom array that all workloads in a namespace should have.
 * This ensures every Deployment/StatefulSet/Job gets config_secrets_module secrets.
 */
export function namespaceEnvFrom(namespaceName: string): EnvFromSource[] {
  return [
    { secretRef: { name: `${namespaceName}-secrets`, optional: true } },
    { configMapRef: { name: `${namespaceName}-config`, optional: true } },
  ];
}

/**
 * Merge a base config with nullable overrides.
 * Any key with value `null` or `undefined` in overrides is SKIPPED (inherit from base).
 * Only non-null override values replace the base.
 *
 * This implements the server_definitions → server_deployments inheritance:
 * deployment.image ?? definition.image
 * deployment.replicas ?? definition.replicas
 * etc.
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
