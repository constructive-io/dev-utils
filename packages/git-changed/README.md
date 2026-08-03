# git-changed

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
  <br />
    <strong>the files you changed, correctly</strong>
  <br />
  <br />
  Merge-base-scoped changed-file detection for lint gates, incremental checks, and CI scripts — working tree and untracked files included, renames and deletions handled, zero dependencies
  <br />
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
  <a href="https://www.npmjs.com/package/git-changed">
    <img height="20" src="https://img.shields.io/npm/v/git-changed?color=blue"/>
  </a>
</p>

## Why

Every repo eventually grows a tool that should only look at what you changed — a linter, a formatter check, a "is this generated artifact stale?" test. The git plumbing for that is four commands long and easy to get subtly wrong, so it gets re-implemented per tool, slightly differently each time, and the differences are bugs:

- `git diff base...HEAD` vs `git merge-base` + `git diff` — get this wrong and commits that landed on `main` after you forked are attributed to your branch.
- `git status --porcelain` without `-uall` reports a **new directory** as one entry, so every file inside a brand-new module is invisible.
- Deleted paths come back from `git diff` and then get handed to a tool that stats them and crashes.
- A rename shows up as an add plus a delete unless you ask for `-M`.
- On a shallow clone or a detached CI checkout there is no base at all, and a tool that throws there checks nothing.

`git-changed` is that plumbing, once, with the sharp edges filed off — as a library for tools and as a CLI for shell and CI.

## Installation

```bash
npm install git-changed
```

## Usage

```typescript
import { changedFiles } from 'git-changed';

const { files, paths, base, source } = changedFiles({ ext: '.sql' });

console.log(`${files.length} changed .sql files vs ${base ?? '(no base)'} [${source}]`);
for (const file of files) {
  console.log(file.status, file.relative);
}
```

Only want the paths?

```typescript
import { changedPaths } from 'git-changed';

const paths = changedPaths({ ext: ['.ts', '.tsx'], exclude: ['**/*.d.ts'] });
```

Asking more than one question about the same repository? `GitChanged` resolves the repo root and base once and takes per-call overrides:

```typescript
import { GitChanged } from 'git-changed';

const changed = new GitChanged({ cwd: repoRoot, exclude: ['dist/', '**/generated/**'] });

const sql = changed.paths({ ext: '.sql' });
const ts = changed.paths({ ext: ['.ts', '.tsx'] });
const base = changed.base(); // e.g. 'origin/main'
```

## CLI

```bash
$ git-changed --ext .sql
pgpm-modules/app-scope/deploy/schemas/app_scope/procedures/membership_parent.sql
pgpm-modules/utils/deploy/schemas/utils/procedures/ensure_singleton.sql
```

```
git-changed [options]

  --base <ref>        Diff against <ref> (default: $GITHUB_BASE_REF, else the
                      repository default branch)
  --no-base           Working-tree changes only
  --ext <exts>        Keep only these extensions (repeatable, comma-separated)
  --include <globs>   Keep only paths matching these globs (repeatable)
  --exclude <globs>   Drop paths matching these globs (repeatable)
  --within <dirs>     Restrict to these directories (repeatable)
  --no-worktree       Committed changes only
  --no-untracked      Skip untracked files
  --deleted           Include paths that no longer exist
  --status            Prefix each path with its status
  --absolute          Print absolute paths (default: relative to cwd)
  --json              Print the full result as JSON
  -0, --null          NUL-separate output, for `xargs -0`
  --cwd <dir>         Run as if in <dir>
  -h, --help          Show this help
  -v, --version       Show the version
```

**Exit code is `0` whether or not anything changed.** An empty list is an answer, not an error — so `git-changed && ...` does not mean what you might hope. Test for empty output, or use `xargs -r`.

## API

### `changedFiles(options?): ChangedResult`

### `changedPaths(options?): string[]`

Same options; returns `result.paths`.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `cwd` | `string` | `process.cwd()` | Directory to run in. May be a subdirectory of the repo; results are reported relative to it. |
| `base` | `string \| false` | resolved (see below) | Ref to diff against. `false` means working tree only. |
| `ext` | `string \| string[]` | — | Extension filter. `'sql'`, `'.sql'`, `'.ts,.tsx'` and `['.ts', '.tsx']` all work; matching is case-insensitive. |
| `include` | `string[]` | — | Keep only paths matching these globs. |
| `exclude` | `string[]` | — | Drop paths matching these globs. Applied after `include`. |
| `within` | `string[]` | — | Restrict to these directories (cheaper and clearer than a glob when you mean "under here"). |
| `existingOnly` | `boolean` | `true` | Drop paths that no longer exist on disk. |
| `worktree` | `boolean` | `true` | Include uncommitted changes. |
| `untracked` | `boolean` | `true` | Include untracked files (uses `-uall`). |

### `ChangedResult`

| Field | Type | Description |
|---|---|---|
| `files` | `ChangedFile[]` | The changed files, sorted by path. |
| `paths` | `string[]` | Absolute paths, same order. |
| `base` | `string \| undefined` | The ref actually used, after resolution. |
| `mergeBase` | `string \| undefined` | The resolved merge-base commit, if one was found. |
| `source` | `'merge-base' \| 'base' \| 'worktree'` | How the answer was produced — see [Degradation](#degradation). |
| `repoRoot` | `string` | Absolute path to the repository root. |

### `ChangedFile`

| Field | Type | Description |
|---|---|---|
| `path` | `string` | Absolute path. |
| `relative` | `string` | Path relative to `cwd`, always `/`-separated. |
| `status` | `ChangeStatus` | `added`, `modified`, `deleted`, `renamed`, `untracked`, `unknown`. |
| `from` | `string \| undefined` | For a rename, the previous path. |
| `committed` | `boolean` | Changed in a commit since the merge base. |
| `worktree` | `boolean` | Changed in the working tree. Both can be true. |
| `exists` | `boolean` | Whether the path is on disk (only ever `false` with `existingOnly: false`). |

### Helpers

| Export | Description |
|---|---|
| `resolveBase(base?, cwd?)` | The base resolution below, on its own. |
| `defaultBranch(cwd)` | `origin/HEAD`, else the first of `origin/main`, `origin/master`, `main`, `master` that exists. |
| `repoRoot(cwd)` / `isRepo(cwd)` / `isShallow(cwd)` | Thin git queries. `isShallow` is useful for warning that a diff may be incomplete. |
| `makeMatcher(patterns, cwd)` | The glob matcher, if you want to filter something else the same way. |
| `GitChangedError` | Thrown when git is unusable or `cwd` is not a repository. |

## Behavior

### Base resolution

In order, first hit wins:

1. `options.base` / `--base <ref>` — explicit always wins.
2. `$GITHUB_BASE_REF` — the PR's target branch — as `origin/<ref>`, else the bare `<ref>`, **whichever exists locally**. `origin/` comes first because Actions fetches only the remote ref and a stale local branch of the same name would diff against the wrong commit; the bare branch covers running the same tool outside CI. Checking existence matters: without it you hand back a ref that every subsequent git call rejects.
3. The repository default branch — `origin/HEAD` if set, else the first of `origin/main`, `origin/master`, `main`, `master` that resolves.

Then the diff is taken from `git merge-base HEAD <base>`, not from the base tip, so work that landed on the base after you forked is not attributed to you.

### What counts as changed

The union of:

- committed changes since the merge base (`git diff --name-status -M`), and
- working-tree changes, staged or not, plus untracked files (`git status --porcelain -uall`).

A file in both is one entry with both `committed` and `worktree` true. This union is what makes the same call correct locally (where your work is uncommitted) and in CI (where it is committed) — no branching on environment.

### Degradation

`source` reports how the answer was produced, so a caller can decide whether to trust it:

| `source` | Meaning |
|---|---|
| `merge-base` | Normal: diffed from the merge base of `HEAD` and `base`. |
| `base` | A base was resolved but no merge base exists — unrelated histories, or a shallow clone that does not reach the fork point. Diffed against the base directly. |
| `worktree` | No base at all: no `--base`, no `$GITHUB_BASE_REF`, no default branch. Working tree only. |

Nothing here throws — a gate that fails open on a detached checkout checks nothing, which is worse than checking a little. Only an unusable git or a non-repository `cwd` raises `GitChangedError`.

### Globs

Small deliberate subset, matched against the path relative to `cwd`:

| Pattern | Matches |
|---|---|
| `dist/` | The `dist` directory and everything under it, at any depth |
| `/sql/` | Leading slash anchors to `cwd` — root `sql/` only |
| `*.sql` | Any `.sql` file, at any depth |
| `pkg/*/deploy` | Exactly one segment for `*` |
| `**/generated/**` | Any depth |
| `**/sql/*--*.sql` | e.g. the pgpm bundle artifacts |

## Recipes

### SQL lint gate

```json
{
  "scripts": {
    "lint:sql:changed": "git-changed --ext .sql --null | xargs -0 -r pgsql-lint"
  }
}
```

Or from inside the tool, which is better — it can report *which* base it used:

```typescript
const { paths, base, source } = changedFiles({ ext: '.sql' });
if (!paths.length) {
  console.log('no changed SQL');
  process.exit(0);
}
if (source === 'worktree') {
  console.warn('no base ref; linting working-tree changes only');
}
lint(paths);
```

### Is a generated artifact stale?

```typescript
const changed = new GitChanged({ cwd: moduleDir });
const deployChanged = changed.paths({ within: ['deploy'], ext: '.sql' }).length > 0;
const bundleChanged = changed.paths({ within: ['sql'] }).length > 0;

if (deployChanged && !bundleChanged) {
  throw new Error(`${moduleName}: deploy/ changed but sql/ was not rebuilt`);
}
```

### Shell

```bash
# Format only what changed. -r keeps xargs quiet when nothing did.
git-changed --ext .ts,.tsx --null | xargs -0 -r prettier --check

# Review the diff, one file at a time, filenames with spaces and all.
git-changed --null | xargs -0 -r -n1 git diff --

# Branch on emptiness — remember the exit code is always 0.
if [ -z "$(git-changed --ext .sql)" ]; then echo "no SQL touched"; fi

# What kind of change was each one?
git-changed --status
```

### In CI

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0   # without this there is no merge base to find
- run: npx git-changed --ext .sql --status
```

`fetch-depth: 0` is the one thing worth remembering. `actions/checkout` defaults to a depth-1 clone, which has no merge base with the target branch; `git-changed` then degrades to `source: 'worktree'` and — in CI, where your work is already committed — finds **nothing**. It won't fail; it will just quietly pass. Prefer failing loudly if that matters to you:

```typescript
const { source } = changedFiles({ ext: '.sql' });
if (process.env.CI && source === 'worktree') {
  throw new Error('No base ref in CI — is fetch-depth: 0 set?');
}
```

## Troubleshooting

| Symptom | Cause |
|---|---|
| Empty result in CI, works locally | Shallow clone — set `fetch-depth: 0`. Check `source`. |
| Files from someone else's merge included | You diffed the base tip somewhere else in your pipeline; this package uses the merge base. Verify with `--json` and look at `mergeBase`. |
| A new module's files are missing | You're not using this package, or not `-uall`. Untracked files inside a new directory need it. |
| Tool crashes on a missing path | Something passed `existingOnly: false`. The default drops deleted paths. |
| `origin/main` not found | `$GITHUB_BASE_REF` was set but unfetched. This package falls back to the local branch of that name, then to the default branch, rather than returning a broken ref. |

## License

MIT
