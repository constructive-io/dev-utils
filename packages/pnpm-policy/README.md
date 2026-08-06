# pnpm-policy

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
  <a href="https://www.npmjs.com/package/pnpm-policy"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/dev-utils?filename=packages%2Fpnpm-policy%2Fpackage.json"></a>
</p>

**pnpm supply-chain policies for npm maintainers** — especially those running many pnpm workspaces and publishing many npm modules.

## The maintainer's problem

`minimumReleaseAge` is the single most effective supply-chain control pnpm ships: a package must have existed for N days before it can be installed, and most compromised releases are caught and yanked well inside that window. It is also the one control a package maintainer cannot turn on.

You publish `@acme/parser` at 2pm and consume it in three workspaces at 2:05pm. Even a two-day quarantine means your own release is unusable until Thursday, in every repo you own. So the cooldown gets set to `0`, and the protection that would have stopped a compromised transitive dependency is gone — not because you decided the risk was acceptable, but because the tool could not tell your packages from everyone else's.

`pnpm-policy` makes that distinction. It asks npm what your maintainer accounts publish, and writes the answer into `pnpm-workspace.yaml` as an exemption list:

```yaml
minimumReleaseAge: 2880           # 2 days, for everything third-party
minimumReleaseAgeExclude:
  - "@acme/*"                     # a scope you own
  - my-unscoped-package           # a package you publish
```

Your releases install immediately. Everything else waits.

At Constructive that is over 1100 published packages, fetched in 5 requests and under two seconds, compressing to 5 scope globs plus 85 individual names for a workspace with ~1800 resolved dependencies.

## Installation

```bash
npm install --save-dev pnpm-policy
```

## Quick start

```bash
npx pnpm-policy init            # write a starter pnpm-policy.yaml
# edit it: add your npm accounts under `maintainers`
npx pnpm-policy inventory       # ask npm what you publish → pnpm-policy.inventory.json
npx pnpm-policy generate        # patch the policy into pnpm-workspace.yaml
npx pnpm-policy check           # CI: fail if the file drifted or a waiver expired
```

Commit `pnpm-policy.yaml`, `pnpm-policy.inventory.json`, and the generated `pnpm-workspace.yaml`. Add `pnpm-policy check` to CI.

## Configuration

`pnpm-policy.yaml` (or `.yml`, or `.json`) at the workspace root:

```yaml
# How old a third-party release must be before it may be installed.
# Accepts 14d / 2w / 36h / 90m, or a bare number of minutes (what pnpm stores).
minimumReleaseAge: 2d

# Transitive dependencies must resolve from the registry, not from git or a URL.
blockExoticSubdeps: true

# The npm accounts YOU publish under.
maintainers:
  - your-npm-username
  - your-ci-account

# Scopes you own outright — emitted as `@scope/*`.
scopes:
  - "@acme"

# Written by `pnpm-policy inventory`. Commit it; review its diffs.
# May also name an installed package that ships one, or a list of either.
inventory: ./pnpm-policy.inventory.json

# Dependencies allowed to run install scripts. The value is the reason.
allowBuilds:
  esbuild: native binary, downloaded at install time
  sharp: libvips bindings
  "@swc/core": native binary

# Third-party escape hatches — see below.
exceptions:
  - package: some-lib
    versions: ['4.17.21']
    reason: CVE-2026-1234 fix, published hours ago
    until: 2026-10-01

# Anything else you want in the managed block, passed through verbatim.
settings:
  strictDepBuilds: true
```

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `minimumReleaseAge` | duration | `2d` | Quarantine applied to everything not exempted. |
| `blockExoticSubdeps` | boolean | `false` | Refuse transitive deps from git/URL sources. |
| `maintainers` | string[] | `[]` | **Your own** npm accounts. See the warning below. |
| `scopes` | string[] | `[]` | Scopes you own, emitted as globs. |
| `inventory` | path, package, or list | – | Where the inventory comes from. A list is merged. |
| `intersect` | boolean | `true` | Only emit names this workspace actually resolves. |
| `allowBuilds` | map or list | `{}` | Dependencies permitted to run install scripts. |
| `exceptions` | list | `[]` | Third-party bypasses, each with a reason. |
| `settings` | map | `{}` | Extra pnpm settings to include in the managed block. |

### `inventory` can name more than one source

`inventory` takes a path, an installed package that ships one, or a list of either. A list is merged into a single inventory before the policy is resolved.

```yaml
inventory:
  - "@acme/pnpm-policy"          # your accounts, published and pinned
  - "@acme/pnpm-policy-upstream" # an upstream you have chosen to trust
```

This exists so inventories that are deliberately kept apart can stay apart. Trusting an upstream account is a decision one workspace may have made and others have not, and folding that account into the inventory everyone installs would extend the exemption to every workspace by default. Keeping them as separate published packages lets each workspace opt in by listing what it actually trusts — instead of checking a flattened copy of both into the repo, where it goes stale and has to be reviewed by hand.

Merging is a union: an inventory only ever says what is *exempt*, so combining two can widen the set and never narrow it. `generatedAt` reports the **oldest** of the inputs, because the merged view is only as fresh as its stalest source.

`pnpm-policy inventory` writes one file. With several configured there is no single default to overwrite, so it asks for `--out`.

### `maintainers` is your own identity, not a trust list

Every package published by a listed account bypasses the release-age quarantine. That is the point — waiting on your own release protects nothing — but it means the entry is a delegation of trust as wide as the account itself.

**List only accounts you control.** Adding a colleague's or a vendor's account exempts everything they will ever publish, including a release made by whoever compromises their credentials. If you want to trust a specific third-party package, that is what `exceptions` is for.

The same reasoning applies to a shared publishing account: if five people can publish under it, the exemption covers all five.

### `exceptions`: the urgent-fix escape hatch

A security fix published an hour ago is exactly the case where a 14-day cooldown is wrong. `exceptions` lets you take one package out of quarantine without lowering it for everything:

```yaml
exceptions:
  - package: some-lib
    versions: ['4.17.21']         # optional: exempt only these versions
    reason: CVE-2026-1234, no backport available
    until: 2026-10-01             # optional: waiver expires
```

- `reason` is **required**. A bypass whose justification is not written down cannot be reviewed later.
- `versions` pins the waiver to exact versions (pnpm matches `name@1.0.0||1.0.1`), so a *later* release of the same package still waits. A name pattern like `@acme/*` cannot be version-pinned, and `pnpm-policy` rejects the combination rather than emitting something pnpm will not match.
- `until` makes the waiver expire: after that date `pnpm-policy check` fails, so the exception has to be renewed or removed instead of quietly becoming permanent.

The reason travels into the generated file, beside the line it explains:

```yaml
minimumReleaseAgeExclude:
  - "@acme/*"
  - some-lib@4.17.21 # CVE-2026-1234, no backport available (expires 2026-10-01)
```

### `allowBuilds`

Install scripts are arbitrary code execution at install time, so pnpm blocks them by default and needs an explicit list. Give each entry a reason:

```yaml
allowBuilds:
  esbuild: native binary, downloaded at install time
  core-js: polyfill postinstall
```

That becomes pnpm's `allowBuilds` map (pnpm ≥ 10.16), with the reasons as inline comments. For older pnpm, `--builds-key onlyBuiltDependencies` emits the array form instead.

Unlike the release-age exemptions, this list is **not** derived from anything: a package that runs install scripts is a deliberate trust decision, whoever published it.

## Understanding what you depend on

Deciding what to exempt means deciding which *projects* you trust, but npm only offers accounts — and an account is as wide as everything its owner will ever publish. The person maintaining a library you want may also co-maintain something enormous you did not mean to exempt.

`origins` answers the question npm does not: group the packages a workspace resolves by the repository they publish from.

```bash
pnpm-policy origins                      # every resolved package, grouped by repo owner
pnpm-policy origins --from postgraphile  # only the subtree that one dependency dragged in
pnpm-policy origins --owner acme         # just that owner's packages
pnpm-policy origins --owner acme --out acme.inventory.json   # written as an inventory
```

```
$ pnpm-policy origins --from postgraphile
radix-ui  (29)
<no repository metadata>  (20)
graphile  (15)
graphql  (8)
```

`--from` reads the lockfile's dependency graph and walks it, so you see what a single decision actually pulled in rather than surveying everything at once. Transitive dependencies are included, because those are the ones an exemption list forgets.

`--owner ... --out ...` writes the result as an inventory, ready to pass to `inventory:`. It emits **names only** — no `maintainers`, no scope globs — because the point is a reviewed list, and a glob would re-widen it to whatever gets published into that scope next.

The repository field is self-reported, so this is a proxy for provenance, not proof of it. It answers "which project is this package from", not "is this package safe".

## The inventory

`pnpm-policy inventory` queries `registry.npmjs.org` for `maintainer:<account>`, paginates, and writes:

```json
{
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "maintainers": ["your-npm-username"],
  "scopes": ["@acme"],
  "packages": ["my-unscoped-package", "another-one"]
}
```

Two rules govern how it compresses:

**Scope globs are opt-in.** `@acme/*` also exempts a package published into `@acme` by somebody else — so a scope is only globbed when you claim it in `scopes:`. npm has no "list a scope" API, and its search index is incomplete enough to report zero packages for a scope that plainly has some, so the registry cannot prove exclusivity for you. `--verify-scopes` will consult the index anyway and glob scopes it finds no foreign packages in; finding one *is* proof a scope is shared, but finding none is not proof that it is yours.

**Unscoped names are listed individually**, which is exact: they come from your own maintainer query.

**Intersection.** By default only names this workspace actually resolves (read from `pnpm-lock.yaml`) are written out — over 1100 published packages becomes the ~85 that appear in this repo. Scope globs are never intersected: nobody else can publish into a scope you own, so the glob stays correct when a new package lands there tomorrow. Pass `--no-intersect` to emit everything. A config with no `inventory:` has no individual names to narrow, so it needs no lockfile at all — which is what lets a freshly scaffolded workspace generate its policy before its first install.

Commit the inventory and review its diffs. It is an exemption list, so a name appearing in it is a name that stops being quarantined — worth one human glance, which is also why refreshing it should open a pull request rather than run silently in an install hook.

### Sharing an inventory across repos

If you run many workspaces, publish the config and inventory as a small data-only package and point `inventory:` at it:

```yaml
inventory: "@acme/pnpm-policy/inventory.json"
```

Pin it exactly (a pnpm `configDependency` gives you version + integrity), so the exemption list cannot change under a repo without a visible bump.

## Generated output

`generate` **patches** `pnpm-workspace.yaml` rather than rewriting it: your `packages:`, `catalog:`, and hand-written comments survive untouched, and only the policy keys are managed. Output is deterministic, so a second run produces no diff.

```yaml
packages:
  - packages/*

# Managed by pnpm-policy — run `pnpm-policy generate` after editing pnpm-policy.yaml.

# A third-party release must be 2d old before it can be installed.
# Most malicious releases are found and yanked well inside that window.
minimumReleaseAge: 2880
# Exempt from the wait: 1 scope glob(s), 2 first-party package(s).
# First-party membership comes from what your-npm-username publishes on npm — waiting on your own release protects nothing.
minimumReleaseAgeExclude:
  - "@acme/*"
  - my-unscoped-package
# The only dependencies permitted to run install scripts.
allowBuilds:
  esbuild: true # native binary, downloaded at install time
```

Managed keys are `minimumReleaseAge`, `minimumReleaseAgeExclude`, the builds key, and `blockExoticSubdeps`, plus anything under `settings`. A managed key the policy no longer sets is removed, so dropping `blockExoticSubdeps` from the config stops enforcing it rather than leaving a stale rule behind.

## Drift checking in CI

```yaml
- run: npx pnpm-policy check
```

`check` fails when the workspace file no longer matches what the config would generate — someone hand-edited `minimumReleaseAge: 0`, or the inventory was refreshed without regenerating — and when a waiver's `until` date has passed. The error says which, and how to fix it.

## CLI

```
pnpm-policy <command> [options]

Commands:
  init                Write a starter pnpm-policy.yaml
  inventory           Query npm for what your maintainers publish, and write the export
  generate            Patch the policy into pnpm-workspace.yaml
  check               Fail if the workspace file drifted or a waiver expired

Options:
  --cwd <dir>         Workspace root (default: current directory)
  --config <path>     Config file, or a directory holding one
  --out <path>        inventory: where to write the export
  --builds-key <key>  allowBuilds (default) or onlyBuiltDependencies, for pnpm < 10.16
  --no-intersect      Emit every first-party name, not just the ones this workspace resolves
  --verify-scopes     inventory: also glob a scope the registry shows nobody else publishing into
  --registry <url>    inventory: registry to query (default: https://registry.npmjs.org)
  --throttle <ms>     inventory: pause between registry requests (default: 1000)
  --json              Print machine-readable output
  -q, --quiet         Only print errors
```

## Library

The CLI is a thin wrapper; everything is available programmatically.

```ts
import { buildInventory, check, generate, loadConfig, resolvePolicy } from 'pnpm-policy';

const { report, changed } = generate({ cwd: process.cwd() });
console.log(`${report.scopes.length} scopes, ${report.firstPartyPackages.length} packages exempt`);

const result = check({ cwd: process.cwd() });
if (!result.ok) process.exit(1);
```

| Export | Purpose |
| --- | --- |
| `loadConfig(pathOrDir)` | Find, read, and validate a policy config. |
| `buildInventory(maintainers, options)` | Query npm and compress the result. |
| `readInventory` / `writeInventory` | Inventory JSON I/O. |
| `resolvePolicy({ config, inventory, resolved })` | Config + inventory → pnpm settings, with rationale. |
| `applyPolicy(source, policy)` | Patch a policy into a `pnpm-workspace.yaml` string. |
| `writeWorkspacePolicy` / `workspaceDrift` | Write, or diff without writing. |
| `generate` / `check` | The two CLI commands, end to end. |
| `readLockfilePackages(path)` | Every package name a lockfile resolves. |
| `packagesByMaintainer(name, options)` | Paginated, throttled maintainer search. |
| `parseDuration` / `formatDuration` | `14d` ⇄ `20160`. |

Registry calls throttle (1s between requests by default) and retry on 429 and 5xx, honouring `Retry-After` — npm's search endpoint rate-limits bursts. Pass `fetchImpl` to supply your own client.

## What this does not do

- It does not verify package *contents* — no signature checking, no provenance attestation. It decides who waits, not who is trustworthy.
- It cannot prove you own a scope. See the inventory section.
- It does not make `allowBuilds` decisions for you.
- Exempting your own packages means a compromise of *your* npm account is not slowed down by the quarantine. Protect the account: 2FA, granular tokens, trusted publishing.

## Related

- [pnpm `minimumReleaseAge`](https://pnpm.io/settings#minimumreleaseage)
- [pnpm `allowBuilds`](https://pnpm.io/settings#allowbuilds)
- [`yamlize`](https://github.com/constructive-io/dev-utils/tree/main/packages/yamlize) — the comment-preserving YAML layer this uses
