/**
 * The provider registry. Built-ins (`pnpm`, `pgpm`, `glob`) are registered on
 * import; add your own with {@link registerProvider} to teach ws-changed a new
 * notion of "package" and its edges.
 */
import { globProvider } from './providers/glob';
import { pgpmProvider } from './providers/pgpm';
import { pnpmProvider } from './providers/pnpm';
import type { WorkspaceProvider } from './types';

const registry = new Map<string, WorkspaceProvider>();

/** Register (or replace) a provider under its `name`. */
export function registerProvider(provider: WorkspaceProvider): void {
  registry.set(provider.name, provider);
}

/** Look up a provider by name, or `undefined` if none is registered. */
export function getProvider(name: string): WorkspaceProvider | undefined {
  return registry.get(name);
}

/** The names of all registered providers, sorted. */
export function providerNames(): string[] {
  return [...registry.keys()].sort();
}

registerProvider(pnpmProvider);
registerProvider(pgpmProvider);
registerProvider(globProvider);
