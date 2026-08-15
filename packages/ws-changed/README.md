# ws-changed

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
  <br />
    <strong>which workspace packages a changeset affects</strong>
  <br />
  <br />
  Pluggable workspace dependency graphs (pnpm, pgpm, glob) + affected-package selection for change-aware CI — <code>affected = changed ∪ dependents</code>, with a <code>--why</code> explainer, config via confstash, and changed files from git-changed
  <br />
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
  <a href="https://www.npmjs.com/package/ws-changed">
    <img height="20" src="https://img.shields.io/npm/v/ws-changed?color=blue"/>
  </a>
</p>

## Why

On a feature branch you don't need to run the whole test suite — only the packages your change can actually reach. Answering "which packages are affected?" is two problems the ecosystem usually couples to a specific tool (`pnpm --filter '...[origin/main]'`, `lerna`, `nx affected`):

1. **What is a "package" here, and what depends on what?** For a JavaScript monorepo it's the pnpm package graph. For a Postgres extension monorepo (pgpm) it's the module `requires` graph. Sometimes it's a plain directory of services. These are *different* dependency graphs over the *same* repo, and which one you want depends on the question you're asking.
2. **Which packages own the files that changed, and what transitively depends on them?**

`ws-changed` separates the two. Providers answer (1) — `pnpm`, `pgpm`, and `glob` are built in, and you can register your own — and the affected engine answers (2) on whatever graph the provider produced. Changed files come from [`git-changed`](../git-changed); configuration comes from [`confstash`](../confstash), so which provider(s) to run, the workspace root, and the "global trigger" paths (a lockfile, CI config) are all declarative and overridable per call and per CLI flag.

## Installation

```bash
npm install ws-changed
```

## CLI

```bash
# packages affected by this branch, vs origin/main
ws-changed --base origin/main

# use the pnpm graph AND the pgpm module graph together
ws-changed --provider pnpm,pgpm --base origin/main --json

# print affected package directories, and treat a lockfile/CI change as "everything"
ws-changed --provider pgpm --dirs --global 'pnpm-lock.yaml' '.github/**'

# explain why each package was selected
ws-changed --why --base origin/develop

# only count changed SQL — and print which extensions changed in each package
ws-changed --provider pgpm --ext .sql --exts

# a lint lane: TypeScript only, ignoring generated trees
ws-changed --ext ts,tsx --not-files '**/generated/**'

# just enumerate / inspect the graph (ignores changes)
ws-changed --list
ws-changed --graph
```

Exit code is always `0`. With `--json`, read `.result.global`: when `true`, a global-trigger path changed and you should treat every package as affected (skip the selection).

## Library

```ts
import { wsChanged } from 'ws-changed';

const { result } = wsChanged({ base: 'origin/main' });
result.packages;   // ['app', 'core', 'lib']  — changed ∪ transitive dependents
result.changed;    // ['core']                — packages that directly own a changed file
result.rootChanged;// ['README.md']           — changed paths owned by no package
result.global;     // false                   — did a global-trigger path change?
result.why;        // [{ package, kind: 'changed'|'dependent', via }]
result.extensions; // ['.sql', '.ts']         — extensions present in the changeset
result.extensionsByPackage; // { core: ['.sql'] } — what changed *in* each changed package
result.ignored;    // ['README.md']           — changed paths the file filter dropped
```

Lower-level pieces are exported too — `loadWorkspace`, the `WorkspaceGraph` (direct/transitive dependencies & dependents, topological sort, cycle detection), and `affected` for when you already hold the changed paths:

```ts
import { loadWorkspace, affected } from 'ws-changed';
import { changedPaths } from 'git-changed';

const { workspace, config } = loadWorkspace({ overrides: { provider: ['pnpm', 'pgpm'] } });
const result = affected(workspace, {
  changed: changedPaths({ base: 'origin/main' }),
  global: config.global
});
```

## Extensions: one changeset, several questions

A CI lane's real question is rarely "did anything change?" but "did anything *of this kind* change, and where?" — a SQL lint lane cares about `.sql`, an image build about its build inputs, a lint lane about `.ts`. `files` narrows the changed files **before** they are attributed to packages, so the same diff answers each question separately:

```ts
import { wsChanged } from 'ws-changed';

// which packages have changed SQL? (and their dependents)
const sql = wsChanged({ overrides: { provider: 'pgpm', files: { ext: '.sql' } } });
if (!sql.result.packages.length) skipSqlLint();

// what kind of change was it, per package?
wsChanged().result.extensionsByPackage; // { 'my-pkg': ['.md', '.ts'] }
```

`ext` takes the same shapes `git-changed` accepts — `'sql'`, `'.sql'`, `'ts,tsx'`, `['.ts','.tsx']` — normalized to a lowercased `.ext` list, so a filter moves between the two without translation. A dotfile or extensionless name (`.gitignore`, `Makefile`) has *no* extension and therefore matches no `ext` filter.

Two properties worth knowing:

- **A dropped file cannot trigger `global`.** The filter defines which files the question is about, so a SQL lane asking about `.sql` is not told "everything is affected" by a changed `pnpm-lock.yaml`. Ask the unfiltered question when you want the lockfile's blast radius.
- **`extensionsByPackage` covers changed packages only**, never dependents — they own no changed file, so "what changed in `pkg`" stays distinct from "what `pkg` is affected by".

On the CLI it's `--ext`, `--files`, `--not-files` (and `--exts` to print the per-package breakdown); in the environment, `WS_CHANGED_EXT` — enough for a CI lane to name its extensions without carrying its own config file.

## Configuration

Discovered by confstash (`ws-changed.config.{ts,js,json}`, `.ws-changedrc{,.json,.yaml}`, or a `ws-changed` key in `package.json`), walking up from the cwd:

```jsonc
// .ws-changedrc.json
{
  "provider": ["pnpm", "pgpm"],
  "global": ["pnpm-lock.yaml", ".github/**", "bin/shard-plan.cjs"],
  "exclude": ["**/fixtures/**"],
  "files": { "ext": [".sql"], "exclude": ["**/generated/**"] },
  "providers": {
    "pnpm": { "edgeKinds": ["prod", "dev", "peer"] }
  }
}
```

| Key | Meaning |
| --- | --- |
| `provider` | Provider name or list. Multiple providers compose: their package sets are unioned by name and their edges merged, so `['pnpm','pgpm']` gives JS *and* SQL edges on the same nodes. Default `pnpm`. |
| `root` | Workspace root. Default: the git repo root, else cwd. |
| `global` | Glob patterns whose change means "everything is affected" (`AffectedResult.global`). Also settable via `WS_CHANGED_GLOBAL` (comma-separated). |
| `include` / `exclude` | Restrict the **package** set by directory glob. |
| `files.ext` | Only count changed files with these extensions (`'.sql'`, `'ts,tsx'`, `['.ts','.tsx']`). Also settable via `WS_CHANGED_EXT`. |
| `files.include` / `files.exclude` | Restrict the changed **file** set by glob — a generated tree, `dist/`, fixtures. |
| `providers.pnpm.edgeKinds` | Which dependency kinds form edges: `prod`, `dev`, `peer`, `optional`. Default: all. |
| `providers.pgpm.globs` / `providers.glob.globs` | Directory globs to search (default: the workspace's own globs). |

## Providers

- **`pnpm`** — JavaScript workspace packages. Reads `pnpm-workspace.yaml` (or `package.json` `workspaces`), then each package's dependency maps. A dependency is an internal edge whenever its *name* is a workspace package — every `workspace:` protocol variant (`workspace:*`, `workspace:^`, `workspace:~`, `workspace:^1.2.3`, `workspace:1.2.3`) **and** a bare semver range when a workspace package publishes under that name (how dist-publishing monorepos reference each other).
- **`pgpm`** — Postgres package-manager modules. A module dir carries a `<name>.control` whose `requires` field lists its module dependencies and a `pgpm.plan` whose `%project` names it; edges to modules outside the workspace (`plpgsql`, extensions) are recorded as `external`.
- **`glob`** — plain directories, no edges. For anything that isn't pnpm or pgpm; `affected === changed`.

### Custom providers

```ts
import { registerProvider, type WorkspaceProvider } from 'ws-changed';

const myProvider: WorkspaceProvider = {
  name: 'my-graph',
  discover({ root, config }) {
    return [/* WorkspacePackage[] with name/dir/requires/external */];
  }
};
registerProvider(myProvider);
```

This is the extension point for teaching `ws-changed` a new notion of "package" and its edges without it needing to know anything about your domain.
