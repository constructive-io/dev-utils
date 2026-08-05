/**
 * npm registry queries.
 *
 * Two questions only: what does a maintainer publish, and what else lives in a
 * scope. Both go through the public search endpoint, which pages at 250 and
 * rate-limits bursts hard enough that a naive loop gets a 429 within a second —
 * hence the throttle and the Retry-After-aware backoff.
 */

import { PolicyError } from './errors';

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

/** npm's maximum, and the reason a 1100-package maintainer costs five requests. */
const PAGE_SIZE = 250;

export interface RegistryOptions {
  registry?: string;
  /** Pause between requests. The search endpoint 429s on unthrottled paging. */
  throttleMs?: number;
  /** Attempts per request before giving up. */
  retries?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Called before each request, for CLI progress output. */
  onRequest?: (query: string, from: number) => void;
}

interface SearchResponse {
  total: number;
  objects: Array<{ package: { name: string } }>;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

async function searchPage(
  query: string,
  from: number,
  options: RegistryOptions
): Promise<SearchResponse> {
  const registry = (options.registry ?? DEFAULT_REGISTRY).replace(/\/$/, '');
  const url = `${registry}/-/v1/search?text=${encodeURIComponent(query)}&size=${PAGE_SIZE}&from=${from}`;
  const doFetch = options.fetchImpl ?? fetch;
  const retries = options.retries ?? 5;
  const throttleMs = options.throttleMs ?? 1000;

  options.onRequest?.(query, from);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await doFetch(url);
      if (response.status === 429 || response.status >= 500) {
        // Honour Retry-After when the registry sends one; it knows better than
        // our backoff curve does.
        const retryAfter = Number(response.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : throttleMs * 2 ** attempt;
        lastError = new PolicyError(`${response.status} from ${url}`);
        await sleep(wait);
        continue;
      }
      if (!response.ok) {
        throw new PolicyError(`Registry returned ${response.status} for ${url}`);
      }
      const body = (await response.json()) as SearchResponse;
      await sleep(throttleMs);
      return body;
    } catch (err) {
      if (err instanceof PolicyError && !String(err.message).match(/^\d{3} from /)) {
        throw err;
      }
      lastError = err;
      await sleep(throttleMs * 2 ** attempt);
    }
  }

  throw new PolicyError(
    `Registry query failed after ${retries + 1} attempts: ${query} (${String(lastError)})`
  );
}

/** Every package name a search query matches, following pagination. */
export async function searchAll(
  query: string,
  options: RegistryOptions = {}
): Promise<string[]> {
  const names = new Set<string>();
  let from = 0;

  for (;;) {
    const page = await searchPage(query, from, options);
    for (const object of page.objects) {
      names.add(object.package.name);
    }
    from += PAGE_SIZE;
    if (from >= page.total || page.objects.length === 0) break;
  }

  return [...names].sort();
}

/** Everything published by an npm account. */
export function packagesByMaintainer(
  maintainer: string,
  options: RegistryOptions = {}
): Promise<string[]> {
  return searchAll(`maintainer:${maintainer}`, options);
}

/**
 * Everything in a scope, from anyone.
 *
 * The search endpoint matches loosely, so results are filtered back down to
 * exact scope membership — otherwise `scope:pgsql` drags in near-misses and a
 * scope looks shared when it is not.
 */
export async function packagesInScope(
  scope: string,
  options: RegistryOptions = {}
): Promise<string[]> {
  const bare = scope.replace(/^@/, '');
  const names = await searchAll(`scope:${bare}`, options);
  return names.filter((name) => name.startsWith(`@${bare}/`));
}
