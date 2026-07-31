# @constructive-io/eslint-config

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250"><br />
    @constructive-io/eslint-config
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

Shared [ESLint 9 flat config](https://eslint.org/docs/latest/use/configure/configuration-files) for Constructive repos. It is the flat-config translation of the `.eslintrc.json` that every repo used to carry, published once so the rules can't drift per repo.

## install

```sh
npm install --save-dev @constructive-io/eslint-config eslint
```

## usage

```js
// eslint.config.mjs
import base from '@constructive-io/eslint-config';

export default [...base, { ignores: ['**/generated/**'] }];
```

That's it — three lines. Anything you append wins, since flat config is last-match-wins.

## what's in it

- `@typescript-eslint` parser + `recommended`, on top of `eslint:recommended`
- `eslint-config-prettier` applied last, so formatting rules never fight prettier
- `simple-import-sort` for imports and exports (warn)
- `unused-imports/no-unused-imports` (warn)
- `indent: 2`, single quotes (escape/template-literal friendly), `quote-props: as-needed`, `semi: always`
- `@typescript-eslint/no-unused-vars` as a warning, ignoring `React`, `res`, `next` and `_`-prefixed args
- off: `no-explicit-any`, `no-var-requires` / `no-require-imports`, `ban-ts-comment`, `no-unsafe-declaration-merging`, `no-console`, `prefer-const`, `no-case-declarations`, `no-implicit-globals`
- browser + node + es2021 + jest globals (via [`globals`](https://www.npmjs.com/package/globals))
- default ignores: `**/node_modules/**`, `**/dist/**`, `**/esm/**`, `**/coverage/**`, `**/build/**`, `**/generated/**`, `**/*.d.ts`

## api

### `default` — `Linter.Config[]`

The config array. Spread it; this is what nearly every repo wants.

### `createConfig(options?)`

For repos that need to change the config rather than append to it. All options are optional and replace (not merge with) the defaults, except `rules`, which is merged last.

```js
import { createConfig } from '@constructive-io/eslint-config';

export default createConfig({
  ignores: ['**/node_modules/**', '**/out/**'],
  rules: { 'simple-import-sort/imports': 'error' }
});
```

### `defaultIgnores`, `files`, `rules`

The individual pieces, exported so you can build your own array without re-typing them.

## no build step

This package ships hand-written `.mjs` and `.d.ts` — it is intentionally a leaf with no build tooling of its own, so build tools (`makage`) can depend on it without creating a publish cycle.
