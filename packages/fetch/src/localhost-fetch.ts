import type { FetchFunction } from './types';

/**
 * Returns true for *.localhost subdomains (e.g. auth.localhost)
 * but not for bare "localhost".
 */
export function isLocalhostSubdomain(hostname: string): boolean {
  return hostname.endsWith('.localhost') && hostname !== 'localhost';
}

/**
 * Build a fetch that uses node:http/node:https to bypass two Node.js
 * limitations with *.localhost subdomains:
 *
 * 1. DNS — Node cannot resolve *.localhost (ENOTFOUND on many OSes).
 * 2. Host header — Node's fetch (undici) treats Host as forbidden and
 *    silently drops it, breaking server-side subdomain routing.
 *
 * For non-localhost URLs this delegates to globalThis.fetch.
 */
function buildNodeFetch(
  http: typeof import('node:http'),
  https: typeof import('node:https'),
): FetchFunction {
  return (input, init) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );

    if (!isLocalhostSubdomain(url.hostname)) {
      return globalThis.fetch(input, init);
    }

    const originalHost = url.host;
    url.hostname = 'localhost';

    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        Host: originalHost,
      };

      // Copy headers from init
      if (init?.headers) {
        const entries =
          init.headers instanceof Headers
            ? Array.from(init.headers.entries())
            : Array.isArray(init.headers)
              ? init.headers
              : Object.entries(init.headers);
        for (const [key, value] of entries) {
          headers[key] = value;
        }
      }

      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(url, {
        method: init?.method ?? 'GET',
        headers,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve(new Response(body, {
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? '',
            headers: res.headers as Record<string, string>,
          }));
        });
      });

      req.on('error', reject);

      if (init?.signal) {
        const onAbort = () => {
          req.destroy(new Error('The operation was aborted'));
        };
        init.signal.addEventListener('abort', onAbort, { once: true });
        req.on('close', () => {
          init.signal!.removeEventListener('abort', onAbort);
        });
      }

      if (init?.body != null) {
        req.write(
          typeof init.body === 'string' || init.body instanceof Uint8Array
            ? init.body
            : String(init.body),
        );
      }

      req.end();
    });
  };
}

/**
 * Cached fetch implementation — resolved once, reused for all calls.
 */
let _fetch: FetchFunction | undefined;

/**
 * Create an isomorphic fetch function.
 *
 * - In **browsers** (and Deno/Bun/edge): returns `globalThis.fetch` as-is.
 * - In **Node.js**: returns a wrapper that uses `node:http`/`node:https`
 *   for `*.localhost` URLs (fixing DNS + Host header) and delegates
 *   everything else to `globalThis.fetch`.
 *
 * The result is cached — calling `createFetch()` multiple times returns
 * the same function instance.
 *
 * @example
 * ```ts
 * import { createFetch } from '@constructive-io/fetch';
 *
 * const fetch = createFetch();
 * const res = await fetch('http://auth.localhost:3000/graphql', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ query: '{ currentUser { id } }' }),
 * });
 * ```
 */
export function createFetch(): FetchFunction {
  if (_fetch) return _fetch;

  // In Node.js, build a fetch that handles *.localhost via node:http
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
       
      const http = require('node:http');
       
      const https = require('node:https');
      _fetch = buildNodeFetch(http, https);
      return _fetch;
    } catch {
      // node:http unavailable — fall through to globalThis.fetch
    }
  }

  _fetch = globalThis.fetch;
  return _fetch;
}
