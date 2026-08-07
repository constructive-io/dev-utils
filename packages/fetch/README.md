# @constructive-io/fetch

Isomorphic fetch that resolves `*.localhost` subdomains and preserves `Host` headers across Node.js and browsers.

## Why

Node.js has three issues with `*.localhost` subdomains:

1. **DNS** — `fetch('http://auth.localhost:3000/')` throws `ENOTFOUND` because Node (undici) doesn't resolve `*.localhost` to loopback ([nodejs/node#50871](https://github.com/nodejs/node/issues/50871)).
2. **Host header** — Node's fetch treats `Host` as a forbidden header and silently drops it, breaking server-side subdomain routing.
3. **Loopback family** — `localhost` commonly resolves to IPv6 `::1` first, but many local dev ingresses (kind, Docker's port publishing) listen on IPv4 only, so a DNS-driven connect reaches `::1` and fails on setups without Node's Happy-Eyeballs fallback.

Browsers handle all three correctly. This package fixes them in Node by using `node:http`/`node:https` for `*.localhost` URLs — pinning the connect to the loopback interface (IPv4 by default) while preserving the original `Host` header — and passing everything else through to `globalThis.fetch`.

## Install

```bash
npm install @constructive-io/fetch
```

## Usage

```ts
import { createFetch } from '@constructive-io/fetch';

const fetch = createFetch();

// Works in Node.js — DNS resolves, Host header preserved
const res = await fetch('http://auth.localhost:3000/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '{ currentUser { id } }' }),
});
```

## API

### `createFetch(options?: CreateFetchOptions): typeof globalThis.fetch`

Returns a fetch function. In Node.js, `*.localhost` URLs are handled via `node:http`/`node:https`. Everything else delegates to `globalThis.fetch`. The default-configuration result is cached.

**`CreateFetchOptions`**

- `loopback?: '127.0.0.1' | '::1' | false` — how to reach the loopback interface for `*.localhost` URLs (Node only). The connect is pinned to this address, removing DNS from the loopback hop; the original `Host` header is preserved so subdomain routing still works.
  - `'127.0.0.1'` (default) — pin the IPv4 loopback.
  - `'::1'` — pin the IPv6 loopback.
  - `false` — no pin; rewrite the host to `localhost` and rely on system DNS (the pre-1.2 behavior).

  Ignored in browsers, which resolve `*.localhost` natively.

```ts
// IPv6-only loopback
const fetch = createFetch({ loopback: '::1' });
```

### `isLocalhostSubdomain(hostname: string): boolean`

Returns `true` for `*.localhost` subdomains (e.g. `auth.localhost`), `false` for bare `localhost` and everything else.
