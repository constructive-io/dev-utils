import type { FetchFunction } from './types';

/**
 * Returns true for *.localhost subdomains (e.g. auth.localhost)
 * but not for bare "localhost".
 */
export function isLocalhostSubdomain(hostname: string): boolean {
  return hostname.endsWith('.localhost') && hostname !== 'localhost';
}

/**
 * Cached fetch implementation — resolved once, reused for all calls.
 */
let _fetch: FetchFunction | undefined;

/**
 * Create a fetch function for browser environments.
 *
 * Browsers resolve *.localhost subdomains natively and do not have the
 * Host-header restriction that Node.js undici has, so no workaround
 * is needed — just return `globalThis.fetch`.
 *
 * The result is cached — calling `createFetch()` multiple times returns
 * the same function instance.
 */
export function createFetch(): FetchFunction {
  if (_fetch) return _fetch;
  _fetch = globalThis.fetch.bind(globalThis);
  return _fetch;
}
