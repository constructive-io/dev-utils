# genomic

<p align="center" width="100%">
    <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
  <a href="https://www.npmjs.com/package/genomic"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/dev-utils?filename=packages%2Fgenomic%2Fpackage.json"></a>
</p>

A TypeScript-first library for cloning template repositories, asking the user for variables, and generating a new project with sensible defaults.

## Features

- Clone any Git repo (or GitHub `org/repo` shorthand) and optionally select a branch + subdirectory
- Extract template variables from filenames and file contents using the safer `____variable____` convention
- Merge auto-discovered variables with `.questions.{json,js}` (questions win)
- Interactive prompts powered by `genomic`, with flexible override mapping (`argv` support) and non-TTY mode for CI
- License scaffolding: choose from MIT, Apache-2.0, ISC, GPL-3.0, BSD-3-Clause, Unlicense, or MPL-2.0 and generate a populated `LICENSE`
- Built-in template caching powered by `appstash`, so repeat runs skip `git clone` (configurable via `cache` options; TTL is opt-in)

## Installation

```bash
npm install genomic
```

> **Note:** The published package is API-only. An internal CLI harness used for integration testing now lives in `packages/genomic-test/`.

## Library Usage

`genomic` provides both a high-level orchestrator and modular building blocks for template scaffolding.

### Quick Start with TemplateScaffolder

The easiest way to use `genomic` is with the `TemplateScaffolder` class, which combines caching, cloning, and template processing into a single API:

```typescript
import { TemplateScaffolder } from 'genomic';

const scaffolder = new TemplateScaffolder({
  toolName: 'my-cli',                    // Cache directory: ~/.my-cli/cache
  defaultRepo: 'org/my-templates',       // Default template repository
  ttlMs: 7 * 24 * 60 * 60 * 1000,       // Cache TTL: 1 week
});

// Scaffold a project from the default repo
await scaffolder.scaffold({
  outputDir: './my-project',
  fromPath: 'starter',                   // Use the "starter" template variant
  answers: { projectName: 'my-app' },    // Pre-populate answers
});

// Or scaffold from a specific repo
await scaffolder.scaffold({
  template: 'https://github.com/other/templates.git',
  outputDir: './another-project',
  branch: 'v2',
});
```

### Template Repository Conventions

`TemplateScaffolder` supports the `.boilerplates.json` convention for organizing multiple templates in a single repository:

```
my-templates/
├── .boilerplates.json    # { "dir": "templates" }
└── templates/
    ├── starter/
    │   ├── .boilerplate.json
    │   └── ...template files...
    └── advanced/
        ├── .boilerplate.json
        └── ...template files...
```

When you call `scaffold({ fromPath: 'starter' })`, the scaffolder will:
1. Check if `starter/` exists directly in the repo root
2. If not, read `.boilerplates.json` and look for `templates/starter/`

### Core Components (Building Blocks)

For more control, you can use the individual components directly:

- **CacheManager**: Handles local caching of git repositories with TTL support
- **GitCloner**: Handles cloning git repositories
- **Templatizer**: Handles variable extraction, user prompting, and template generation

### Example: Manual Orchestration

Here is how you can combine these components to create a full CLI pipeline (similar to `genomic-test`):

```typescript
import * as path from "path";
import { CacheManager, GitCloner, Templatizer } from "genomic";

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

`genomic` ships text templates in `licenses-templates/`. To add another license, drop a `.txt` file matching the desired key (e.g., `BSD-2-CLAUSE.txt`) with placeholders:

- `{{YEAR}}`, `{{AUTHOR}}`, `{{EMAIL_LINE}}`

No code changes are needed; the generator discovers templates at runtime and will warn if a `.questions` option doesn’t have a matching template.

## API Overview

### TemplateScaffolder (Recommended)

The high-level orchestrator that combines caching, cloning, and template processing:

- `new TemplateScaffolder(config)`: Initialize with configuration:
  - `toolName` (required): Name for cache directory (e.g., `'my-cli'` → `~/.my-cli/cache`)
  - `defaultRepo`: Default template repository URL or `org/repo` shorthand
  - `defaultBranch`: Default branch to clone
  - `ttlMs`: Cache time-to-live in milliseconds
  - `cacheBaseDir`: Override cache location (useful for tests)
- `scaffold(options)`: Scaffold a project from a template:
  - `template`: Repository URL, local path, or `org/repo` shorthand (uses `defaultRepo` if not provided)
  - `outputDir` (required): Output directory for generated project
  - `fromPath`: Subdirectory within template to use
  - `branch`: Branch to clone
  - `answers`: Pre-populated answers to skip prompting
  - `noTty`: Disable interactive prompts
  - `prompter`: Reuse an existing Genomic instance
- `readBoilerplatesConfig(dir)`: Read `.boilerplates.json` from a template repo
- `readBoilerplateConfig(dir)`: Read `.boilerplate.json` from a template directory
- `getCacheManager()`, `getGitCloner()`, `getTemplatizer()`: Access underlying components

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

See `packages/genomic-test` for a complete reference implementation.
