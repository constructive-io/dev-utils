# @constructive-io/noble-hashes

> **NOTE:** This is a fork of [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) (v2.2.0) by Paul Miller.
> We dual-publish as both **CJS and ESM** to avoid downstream compatibility issues with tools and
> runtimes that don't yet fully support ESM-only packages (e.g., Jest, older bundlers, CJS-based
> Node.js tooling). The source code is unchanged from upstream — only the build tooling differs.

Audited & minimal 0-dependency JS implementation of SHA, RIPEMD, BLAKE, HMAC, HKDF, PBKDF & Scrypt.

## Installation

```
pnpm add @constructive-io/noble-hashes
```

## Usage

```typescript
import { sha256 } from '@constructive-io/noble-hashes/sha2';
import { bytesToHex } from '@constructive-io/noble-hashes/utils';

const hash = sha256(new Uint8Array([1, 2, 3]));
console.log(bytesToHex(hash));
```

Works with both `require()` (CJS) and `import` (ESM).

## Why fork?

`@noble/hashes` v2.x ships as ESM-only (`"type": "module"`). This causes `require()` calls to fail
with "Must use import to load ES Module" in CJS environments. Rather than patching every consumer,
we maintain this fork with dual CJS+ESM output via [makage](https://github.com/constructive-io/dev-utils).

## Syncing upstream

To update from a new `@noble/hashes` release:

1. Copy the `src/` files from the target version
2. Strip `.ts` extensions from import paths (this repo uses `moduleResolution: "node"`)
3. Build and run tests
4. Bump the version and publish

## License

MIT — Copyright (c) 2022 Paul Miller (https://paulmillr.com). See [LICENSE](./LICENSE).
