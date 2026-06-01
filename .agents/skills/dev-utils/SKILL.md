---
name: dev-utils
description: "Developer utilities monorepo — inquirerer (interactive CLI prompts), yanse (terminal colors), appStash (state persistence), inflekt (string inflection), strfy-js (JSON stringify), clean-ansi, and 25+ other packages. Use when building CLIs with inquirerer, working with terminal colors, string inflection, or any package in the dev-utils repo."
metadata:
  author: constructive-io
  version: "2.0.0"
---

# dev-utils

Developer utilities monorepo with 30+ packages for CLI tooling, parsing, and general-purpose TypeScript utilities.

## When to Apply

Use this skill when:
- Building interactive CLIs with `inquirerer`
- Working with terminal colors (`yanse`)
- Using string inflection (`inflekt`)
- Working with any package in the `constructive-io/dev-utils` repo

**For pnpm workspace management, publishing, and monorepo configuration**, see the `constructive-pnpm` skill.

## inquirerer CLI Framework

Build interactive CLI tools with prompts, appStash state persistence, and yanse terminal colors.

See [inquirerer-cli.md](./references/inquirerer-cli.md) for the CLI framework guide.

## README Formatting

Consistent documentation formatting conventions for Constructive projects.

See [readme-formatting.md](./references/readme-formatting.md) for formatting rules.

## Reference Guide

### CLI

| Reference | Topic | Consult When |
|-----------|-------|--------------|
| [inquirerer-cli.md](./references/inquirerer-cli.md) | inquirerer CLI framework | Building interactive CLI tools |
| [inquirerer-cli-building.md](./references/inquirerer-cli-building.md) | CLI building patterns | Command structure, argument parsing |
| [inquirerer-appstash.md](./references/inquirerer-appstash.md) | appStash state management | Persisting CLI state between runs |
| [inquirerer-yanse.md](./references/inquirerer-yanse.md) | yanse terminal colors | Colored output, styling |
| [inquirerer-anti-patterns.md](./references/inquirerer-anti-patterns.md) | Anti-patterns to avoid | Common mistakes in CLI building |

### Documentation

| Reference | Topic | Consult When |
|-----------|-------|--------------|
| [readme-formatting.md](./references/readme-formatting.md) | README conventions | Formatting standards, structure |

## Cross-References

- `constructive-pnpm` — PNPM workspace management, publishing, monorepo configuration
- `pgpm` — Uses pnpm workspaces for module management
- `constructive-starter-kits` — Boilerplate templates use these tools
