# confstash

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
  <br />
    <strong>standardized project configuration loading</strong>
  <br />
  <br />
  Config files, rc files, presets, and layered merge with provenance
  <br />
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

Standardized project configuration loading for CLI tools — the project-level complement to [`appstash`](../appstash) (user-level directories).

Give it a tool name and it discovers `mytool.config.{ts,js,mjs,cjs}`, `.mytoolrc{,.json,.yaml,.yml,.js}`, `mytool.json`, and `package.json` keys via walk-up search, resolves `extends`/preset chains, and merges layered configuration with per-key provenance:

```
defaults -> presets (extends) -> user stash -> project file -> env vars -> runtime overrides
```

## Installation

```bash
npm install confstash
```

## Features

- **Walk-up discovery**: finds config in the current directory or any parent
- **Every format**: `.config.ts/js/mjs/cjs` modules, rc files (JSON/YAML), JSON, `package.json` keys
- **Presets & extends**: named presets, relative paths, or npm packages — recursively, with cycle detection
- **Layered merge**: deterministic precedence with `replace` or `concat` array strategies
- **Provenance**: `explainSync()` tells you which layer supplied every value (`--print-config` UX)
- **Sync and async**: fully synchronous path for CLIs (ESM configs require `load()`)
- **User layer**: optional `~/.<tool>/config/config.json` layer via appstash
- **Typed**: `defineConfig<T>()` + generic loader for full type safety

## Usage

### Basic Usage

```typescript
import { createConfigLoader } from 'confstash';

interface MyConfig {
  level: string;
  rules: Record<string, string>;
}

const loader = createConfigLoader<MyConfig>({
  tool: 'mytool',
  defaults: { level: 'medium', rules: {} }
});

const { config, filepath, layers, isEmpty } = loader.loadSync();
// or: await loader.load()  — also supports .mjs / ESM configs
```

### Presets and extends

```typescript
const loader = createConfigLoader<MyConfig>({
  tool: 'mytool',
  presets: {
    'mytool:recommended': { level: 'medium', rules: { A1: 'error' } },
    'mytool:strict': { extends: 'mytool:recommended', level: 'high' }
  }
});
```

```jsonc
// .mytoolrc.json
{
  "extends": "mytool:strict",     // or "./team-preset.js", or "some-npm-pkg"
  "rules": { "A1": "off" }
}
```

### Typed config authoring

```typescript
// mytool.config.ts
import { defineConfig } from 'confstash';

export default defineConfig({
  extends: 'mytool:recommended',
  level: 'high'
});
```

### Environment and CLI layers

```typescript
const loader = createConfigLoader<MyConfig>({
  tool: 'mytool',
  envLayer: (env) => (env.MYTOOL_LEVEL ? { level: env.MYTOOL_LEVEL } : {}),
  userStash: true // include ~/.mytool/config/config.json (via appstash)
});

const { config } = loader.loadSync({
  overrides: parsedCliFlags // highest precedence
});
```

### Provenance / print-config

```typescript
for (const entry of loader.explainSync()) {
  console.log(`${entry.path} = ${JSON.stringify(entry.value)}  (${entry.source}: ${entry.origin})`);
}
// level = "high"        (file: /repo/mytool.config.ts)
// rules.A1 = "error"    (preset: mytool:recommended)
```

### Custom search places

```typescript
// pgpm-compatible discovery
const loader = createConfigLoader({
  tool: 'pgpm',
  searchPlaces: ['pgpm.config.js', 'pgpm.json'],
  arrayMerge: 'replace'
});
```

## API

### `createConfigLoader<T>(options)`

**Options:**
- `tool` (string): tool name; drives default search places and the user stash directory
- `searchPlaces` (SearchPlace[]): filenames or `{ packageJson: key }` entries, in precedence order
- `defaults` (Partial<T>): lowest-precedence layer
- `presets` (Record<string, Partial<T>>): named presets resolvable via `extends`
- `envLayer` ((env) => Partial<T>): map environment variables into a layer
- `userStash` (boolean): include `~/.<tool>/config/config.json` (default `false`)
- `arrayMerge` (`'replace' | 'concat'`): array strategy (default `'replace'`)
- `validate` ((config: T) => T | void): validate/normalize the merged result
- `walkUp` (boolean): search parent directories (default `true`)

**Returns:** `ConfigLoader<T>` with `load(params)`, `loadSync(params)`, `explainSync(params)`, `searchPlaces`.

**Load params:** `cwd`, `overrides`, `configFile` (skip discovery), `env`.

### Utilities

- `defineConfig<T>(config)` — identity helper for typed config files
- `defaultSearchPlaces(tool)` — the derived search place list
- `findConfigSync(startDir, searchPlaces, walkUp?)` / `findUpDir(startDir, filename)` — discovery primitives
- `loadFileSync(found)` / `loadFile(found)` — format-aware file loading
- `deepMerge(target, source, arrayMerge?)` / `mergeLayers(layers)` / `explainLayers(layers)` — merge primitives
- `ConfigLoadError` — thrown for unreadable/invalid config files

## Related

- [`appstash`](../appstash) — user-level directories (`~/.<tool>/{config,cache,data,logs}`) and the optional `userStash` layer
