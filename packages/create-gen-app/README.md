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

A TypeScript-first CLI/library for cloning template repositories, asking the user for variables, and generating a new project with sensible defaults.

## Features

- Clone any Git repo (or GitHub `org/repo` shorthand) and optionally select a branch + subdirectory
- Extract template variables from filenames and file contents using the safer `____variable____` convention
- Merge auto-discovered variables with `.questions.{json,js}` (questions win, including `ignore` patterns)
- Interactive prompts powered by `inquirerer`, with CLI flag overrides (`--VAR value`) and non-TTY mode for CI
- Built-in CLI (`create-gen-app` / `cga`) that discovers templates, prompts once, and writes output safely
- License scaffolding: choose from MIT, Apache-2.0, ISC, GPL-3.0, BSD-3-Clause, Unlicense, or MPL-2.0 and generate a populated `LICENSE`

## Installation

```bash
npm install create-gen-app
# or for CLI only
npm install -g create-gen-app
```

## CLI Usage

```bash
# interactively pick a template from launchql/pgpm-boilerplates
create-gen-app --output ./workspace

# short alias
cga --template module --branch main --output ./module \
    --USERFULLNAME "Jane Dev" --USEREMAIL jane@example.com

# point to a different repo/branch/path
cga --repo github:my-org/my-templates --branch release \
    --path ./templates --template api --output ./api
```

Key flags:

- `--repo`, `--branch`, `--path` – choose the Git repo, branch/tag, and subdirectory that contains templates
- `--template` – folder inside `--path` (auto-prompted if omitted)
- `--output` – destination directory (defaults to `./<template>`); use `--force` to overwrite
- `--no-tty` – disable interactive prompts (ideal for CI)
- `--version`, `--help` – standard metadata
- Any extra `--VAR value` pairs become variable overrides

## Library Usage

```typescript
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
});
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

No code changes are needed; the CLI discovers templates at runtime and will warn if a `.questions` option doesn’t have a matching template.

## API Overview

- `createGen(options)` – full pipeline (clone → extract → prompt → replace)
- `cloneRepo(url, { branch })` – clone to a temp dir
- `extractVariables(dir)` – parse file/folder names + content for variables, load `.questions`
- `promptUser(extracted, argv, noTty)` – run interactive questions with CLI overrides and alias deduping
- `replaceVariables(templateDir, outputDir, extracted, answers)` – copy files, rename paths, render licenses

See `dev/README.md` for the local development helper script (`pnpm dev`).
