# @constructive-io/fetch

Isomorphic fetch that resolves `*.localhost` subdomains and preserves `Host` headers across Node.js and browsers.

## Why

Node.js has two issues with `*.localhost` subdomains:

1. **DNS** — `fetch('http://auth.localhost:3000/')` throws `ENOTFOUND` because Node (undici) doesn't resolve `*.localhost` to loopback ([nodejs/node#50871](https://github.com/nodejs/node/issues/50871)).
2. **Host header** — Node's fetch treats `Host` as a forbidden header and silently drops it, breaking server-side subdomain routing.

Browsers handle both correctly. This package fixes both in Node by using `node:http`/`node:https` for `*.localhost` URLs and passing everything else through to `globalThis.fetch`.

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

### `createFetch(): typeof globalThis.fetch`

Returns a fetch function. In Node.js, `*.localhost` URLs are handled via `node:http`/`node:https`. Everything else delegates to `globalThis.fetch`. The result is cached.

### `isLocalhostSubdomain(hostname: string): boolean`

Returns `true` for `*.localhost` subdomains (e.g. `auth.localhost`), `false` for bare `localhost` and everything else.
