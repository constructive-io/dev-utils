# create-gen-app

<p align="center" width="100%">
    <img height="90" src="https://raw.githubusercontent.com/hyperweb-io/dev-utils/refs/heads/main/docs/img/inquirerer.svg" />
</p>

<p align="center" width="100%">

  <a href="https://github.com/hyperweb-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/hyperweb-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/hyperweb-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
  <a href="https://www.npmjs.com/package/create-gen-app"><img height="20" src="https://img.shields.io/npm/dt/create-gen-app"></a>
  <a href="https://www.npmjs.com/package/create-gen-app"><img height="20" src="https://img.shields.io/github/package-json/v/hyperweb-io/dev-utils?filename=packages%2Fcreate-gen-app%2Fpackage.json"></a>
</p>

A TypeScript-first library for cloning template repositories, asking the user for variables, and generating a new project with sensible defaults.

## Features

- Clone any Git repo (or GitHub `org/repo` shorthand) and optionally select a branch + subdirectory
- Extract template variables from filenames and file contents using the safer `____variable____` convention
- Merge auto-discovered variables with `.questions.{json,js}` (questions win, including `ignore` patterns)
- Interactive prompts powered by `inquirerer`, with flexible override mapping (`argv` support) and non-TTY mode for CI
- License scaffolding: choose from MIT, Apache-2.0, ISC, GPL-3.0, BSD-3-Clause, Unlicense, or MPL-2.0 and generate a populated `LICENSE`
- Built-in template caching powered by `appstash`, so repeat runs skip `git clone` (configurable via `cache` options)

## Installation

```bash
npm install create-gen-app
```

> **Note:** The published package is API-only. An internal CLI harness used for integration testing now lives in `packages/create-gen-app-test/`.

## Library Usage

```typescript
import * as os from "os";
import * as path from "path";

import { createGen } from "create-gen-app";

await createGen({
  templateUrl: "https://github.com/user/template-repo",
  fromBranch: "main",
  fromPath: "templates/module",
  outputDir: "./my-new-project",
  argv: {
    USERFULLNAME: "Jane Dev",
    USEREMAIL: "jane@example.com",
    MODULENAME: "awesome-module",
    LICENSE: "MIT",
  },
  noTty: true,
  cache: {
    // optional: override tool/baseDir (defaults to pgpm + ~/.pgpm)
    toolName: "pgpm",
    baseDir: path.join(os.tmpdir(), "create-gen-cache"),
  },
});
```

### Template Caching

`create-gen-app` caches repositories under `~/.pgpm/cache/repos/<hash>` by default (using [`appstash`](https://github.com/hyperweb-io/dev-utils/tree/main/packages/appstash)). The first run clones & stores the repo, subsequent runs re-use the cached directory.

- Disable caching with `cache: false` or `cache: { enabled: false }`
- Override the tool name or base directory with `cache: { toolName, baseDir }`
- For tests/CI, point `baseDir` to a temporary folder so the suite does not touch the developer’s real home directory:

```ts
const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), "create-gen-cache-"));

await createGen({
  ...options,
  cache: { baseDir: tempBase, toolName: "pgpm-test-suite" },
});
```

The cache directory never mutates the template, so reusing the same cached repo across many runs is safe.

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

### Custom Questions & Ignore Rules

Create a `.questions.json`:

```json
{
  "ignore": ["__tests__", "docs/drafts"],
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

Or `.questions.js` for dynamic logic. Question names can use `____var____` or plain `VAR`; they'll be normalized automatically.

### License Templates

`create-gen-app` ships text templates in `licenses-templates/`. To add another license, drop a `.txt` file matching the desired key (e.g., `BSD-2-CLAUSE.txt`) with placeholders:

- `{{YEAR}}`, `{{AUTHOR}}`, `{{EMAIL_LINE}}`

No code changes are needed; the generator discovers templates at runtime and will warn if a `.questions` option doesn’t have a matching template.

## API Overview

- `createGen(options)` – full pipeline (clone → extract → prompt → replace)
- `cloneRepo(url, { branch })` – clone to a temp dir
- `normalizeCacheOptions(cache)` / `prepareTemplateDirectory(...)` – inspect or reuse cached template repos
- `extractVariables(dir)` – parse file/folder names + content for variables, load `.questions`
- `promptUser(extracted, argv, noTty)` – run interactive questions with override alias deduping
- `replaceVariables(templateDir, outputDir, extracted, answers)` – copy files, rename paths, render licenses

See `packages/create-gen-app-test/dev/README.md` for the local development helper script (`pnpm --filter create-gen-app-test dev`).
