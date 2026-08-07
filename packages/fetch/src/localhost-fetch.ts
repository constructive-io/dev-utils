import type { CreateFetchOptions, FetchFunction, LoopbackAddress } from './types';

const DEFAULT_LOOPBACK: LoopbackAddress = '127.0.0.1';

/**
 * Returns true for *.localhost subdomains (e.g. auth.localhost)
 * but not for bare "localhost".
 */
export function isLocalhostSubdomain(hostname: string): boolean {
  return hostname.endsWith('.localhost') && hostname !== 'localhost';
}

/**
 * Build a fetch that uses node:http/node:https to bypass three Node.js
 * limitations with *.localhost subdomains:
 *
 * 1. DNS — Node cannot resolve *.localhost (ENOTFOUND on many OSes).
 * 2. Host header — Node's fetch (undici) treats Host as forbidden and
 *    silently drops it, breaking server-side subdomain routing.
 * 3. Loopback family — `localhost` commonly resolves to IPv6 `::1` first,
 *    but many local dev ingresses (kind, Docker port publishing) listen on
 *    IPv4 only, so a DNS-driven connect hits `::1` and fails without
 *    Happy-Eyeballs fallback. The connect is pinned to `loopback` (default
 *    IPv4 `127.0.0.1`) to take DNS out of the loopback hop entirely.
 *
 * For non-localhost URLs this delegates to globalThis.fetch.
 */
function buildNodeFetch(
  http: typeof import('node:http'),
  https: typeof import('node:https'),
  loopback: LoopbackAddress | false,
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
    // Pin the connect target to the loopback interface, keeping the original
    // Host header so subdomain routing still works. `false` falls back to
    // DNS resolution of bare `localhost`.
    const connectHost = loopback === false ? 'localhost' : loopback;

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

      const req = protocol.request({
        protocol: url.protocol,
        hostname: connectHost,
        port: url.port === '' ? undefined : Number(url.port),
        path: `${url.pathname}${url.search}`,
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
 * Cached default fetch implementation — resolved once, reused for all calls
 * that use the default loopback. Non-default options build a fresh instance.
 */
let _defaultFetch: FetchFunction | undefined;

/**
 * Create an isomorphic fetch function.
 *
 * - In **browsers** (and Deno/Bun/edge): returns `globalThis.fetch` as-is.
 * - In **Node.js**: returns a wrapper that uses `node:http`/`node:https`
 *   for `*.localhost` URLs (fixing DNS, the dropped Host header, and the
 *   IPv6-first loopback trap) and delegates everything else to
 *   `globalThis.fetch`.
 *
 * The default-configuration result is cached — calling `createFetch()` (or
 * `createFetch({})`) repeatedly returns the same function instance.
 *
 * @param options.loopback Loopback address to pin `*.localhost` connects to
 *   (Node only). Defaults to `'127.0.0.1'`; pass `'::1'` for IPv6 or `false`
 *   to fall back to DNS resolution of bare `localhost`.
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
export function createFetch(options: CreateFetchOptions = {}): FetchFunction {
  const loopback = options.loopback ?? DEFAULT_LOOPBACK;
  const isDefault = loopback === DEFAULT_LOOPBACK;

  if (isDefault && _defaultFetch) return _defaultFetch;

  let fetchImpl: FetchFunction = globalThis.fetch;

  // In Node.js, build a fetch that handles *.localhost via node:http
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
       
      const http = require('node:http');
       
      const https = require('node:https');
      fetchImpl = buildNodeFetch(http, https, loopback);
    } catch {
      // node:http unavailable — fall through to globalThis.fetch
    }
  }

  if (isDefault) _defaultFetch = fetchImpl;
  return fetchImpl;
}
