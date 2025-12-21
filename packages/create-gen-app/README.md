# create-gen-app

<p align="center" width="100%">
    <img height="90" src="https://raw.githubusercontent.com/hyperweb-io/dev-utils/refs/heads/main/docs/img/inquirerer.svg" />
</p>

<p align="center" width="100%">

  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
  <a href="https://www.npmjs.com/package/create-gen-app"><img height="20" src="https://img.shields.io/npm/dt/create-gen-app"></a>
  <a href="https://www.npmjs.com/package/create-gen-app"><img height="20" src="https://img.shields.io/github/package-json/v/hyperweb-io/dev-utils?filename=packages%2Fcreate-gen-app%2Fpackage.json"></a>
</p>

A TypeScript-first library for cloning template repositories, asking the user for variables, and generating a new project with sensible defaults.

## Features

- Clone any Git repo (or GitHub `org/repo` shorthand) and optionally select a branch + subdirectory
- Extract template variables from filenames and file contents using the safer `____variable____` convention
- Merge auto-discovered variables with `.questions.{json,js}` (questions win)
- Interactive prompts powered by `inquirerer`, with flexible override mapping (`argv` support) and non-TTY mode for CI
- License scaffolding: choose from MIT, Apache-2.0, ISC, GPL-3.0, BSD-3-Clause, Unlicense, or MPL-2.0 and generate a populated `LICENSE`
- Built-in template caching powered by `appstash`, so repeat runs skip `git clone` (configurable via `cache` options; TTL is opt-in)

## Installation

```bash
npm install create-gen-app
```

> **Note:** The published package is API-only. An internal CLI harness used for integration testing now lives in `packages/create-gen-app-test/`.

## Library Usage

`create-gen-app` provides a modular set of classes to handle template cloning, caching, and processing.

### Core Components

- **CacheManager**: Handles local caching of git repositories with TTL (Time-To-Live) support.
- **GitCloner**: Handles cloning git repositories.
- **Templatizer**: Handles variable extraction, user prompting, and template generation.

### Example: Orchestration

Here is how you can combine these components to create a full CLI pipeline (similar to `create-gen-app-test`):

```typescript
import * as path from "path";
import { CacheManager, GitCloner, Templatizer } from "create-gen-app";

async function main() {
  const repoUrl = "https://github.com/user/template-repo";
  const outputDir = "./my-new-project";

  // 1. Initialize components
  const cacheManager = new CacheManager({
    toolName: "my-cli", // ~/.my-cli/cache
    // ttl is optional; omit to keep cache forever, or set (e.g., 1 week) to enable expiration
    // ttl: 604800000,
  });
  const gitCloner = new GitCloner();
  const templatizer = new Templatizer();

  // 2. Resolve template path (Cache or Clone)
  const normalizedUrl = gitCloner.normalizeUrl(repoUrl);
  const cacheKey = cacheManager.createKey(normalizedUrl);
  
  // Check cache
  let templateDir = cacheManager.get(cacheKey);
  const isExpired = cacheManager.checkExpiration(cacheKey);

  if (!templateDir || isExpired) {
    console.log("Cloning template...");
    if (isExpired) cacheManager.clear(cacheKey);
    
    // Clone to a temporary location managed by CacheManager
    const tempDest = path.join(cacheManager.getReposDir(), cacheKey);
    await gitCloner.clone(normalizedUrl, tempDest, { depth: 1 });
    
    // Register and update cache
    cacheManager.set(cacheKey, tempDest);
    templateDir = tempDest;
  }

  // 3. Process Template
  await templatizer.process(templateDir, outputDir, {
    argv: {
      PROJECT_NAME: "my-app",
      LICENSE: "MIT"
    }
  });
}
```

### Template Variables

Variables should be wrapped in four underscores on each side:

```
____projectName____/
  src/____moduleName____.ts
```

```typescript
// ____moduleName____.ts
export const projectName = "____projectName____";
export const author = "____fullName____";
```

### Custom Questions

Create a `.boilerplate.json`:

```json
{
  "type": "module",
  "questions": [
    {
      "name": "____fullName____",
      "type": "text",
      "message": "Enter author full name",
      "required": true
    },
    {
      "name": "____license____",
      "type": "list",
      "message": "Choose a license",
      "options": ["MIT", "Apache-2.0", "ISC", "GPL-3.0"]
    }
  ]
}
```

Or `.boilerplate.js` for dynamic logic. Question names can use `____var____` or plain `VAR`; they'll be normalized automatically.

Note: `.boilerplate.json`, `.boilerplate.js`, and `.boilerplates.json` files are automatically excluded from the generated output.

### License Templates

`create-gen-app` ships text templates in `licenses-templates/`. To add another license, drop a `.txt` file matching the desired key (e.g., `BSD-2-CLAUSE.txt`) with placeholders:

- `{{YEAR}}`, `{{AUTHOR}}`, `{{EMAIL_LINE}}`

No code changes are needed; the generator discovers templates at runtime and will warn if a `.questions` option doesn’t have a matching template.

## API Overview

### CacheManager
- `new CacheManager(config)`: Initialize with `toolName` and optional `ttl`.
- `get(key)`: Get path to cached repo if exists.
- `set(key, path)`: Register a path in the cache.
- `checkExpiration(key)`: Check if a cache entry is expired.
- `clear(key)`: Remove a specific cache entry.
- `clearAll()`: Clear all cached repos.
- When `ttl` is `undefined`, cache entries never expire. Provide a TTL (ms) only when you want automatic invalidation.
- Advanced: if you already own an appstash instance, pass `dirs` to reuse it instead of letting CacheManager create its own.

### GitCloner
- `clone(url, dest, options)`: Clone a repo to a destination.
- `normalizeUrl(url)`: Normalize a git URL for consistency.

### Templatizer
- `process(templateDir, outputDir, options)`: Run the full template generation pipeline (extract -> prompt -> replace).

See `packages/create-gen-app-test` for a complete reference implementation.
