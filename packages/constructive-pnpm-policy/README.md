# @constructive-io/pnpm-policy

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
  <a href="https://www.npmjs.com/package/@constructive-io/pnpm-policy"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/dev-utils?filename=packages%2Fconstructive-pnpm-policy%2Fpackage.json"></a>
</p>

Constructive's supply-chain policy **data** for [`pnpm-policy`](https://www.npmjs.com/package/pnpm-policy): our config plus the generated inventory of everything we publish on npm. No code, no bin, no install scripts — it is inert by construction, because a package whose whole job is to say "these names skip the quarantine" should not also be able to run anything.

The tool lives in [`pnpm-policy`](../pnpm-policy). This package is the answer to "who is Constructive?" so our repos do not each maintain their own copy.

## Use it in a workspace

```bash
pnpm add -D pnpm-policy @constructive-io/pnpm-policy
```

`pnpm-policy.yaml` at the workspace root:

```yaml
minimumReleaseAge: 14d
blockExoticSubdeps: true
maintainers:
  - pyramation
scopes:
  - "@constructive-io"
  - "@constructive-db"
  - "@launchql"
  - "@pgpm"
  - "@pgpmjs"
  - "@pgsql"
inventory: "@constructive-io/pnpm-policy/inventory.json"
allowBuilds:
  esbuild: native binary, downloaded at install time
```

Then:

```bash
pnpm pnpm-policy generate    # patch pnpm-workspace.yaml
pnpm pnpm-policy check       # CI: fail on drift or an expired waiver
```

**Pin it exactly.** A floating range on an exemption list re-introduces exactly the trust hole the quarantine closes — the list could widen under a repo with no visible change. A pnpm `configDependency` gives you version *and* integrity:

```yaml
# pnpm-workspace.yaml
configDependencies:
  "@constructive-io/pnpm-policy": "0.1.0+sha512-..."
```

## What is in here

| File | Contents |
| --- | --- |
| `pnpm-policy.yaml` | Our policy: release age, claimed scopes, `allowBuilds`, exceptions. |
| `inventory.json` | Generated: every package `maintainer:pyramation` publishes, compressed. |

```json
{
  "generatedAt": "…",
  "maintainers": ["pyramation"],
  "scopes": ["@constructive-io", "@constructive-db", "@launchql", "@pgpm", "@pgpmjs", "@pgsql"],
  "packages": ["pgsql-parser", "libpg-query", "inquirerer", "…"]
}
```

Scopes become `@scope/*` globs, so a package published into one tomorrow is exempt without a refresh. They are claimed by hand in `pnpm-policy.yaml` rather than inferred: npm has no "list a scope" API, so nothing can prove a scope is exclusively ours. Everything else — the ~890 unscoped and other-scoped names — is listed individually, which is exact, and `pnpm-policy generate` intersects that list against the consuming workspace's lockfile so only the names a repo actually resolves are written out.

## Refreshing

```bash
pnpm --filter 'pnpm-policy...' run build    # the sibling tool, if you have not built it
pnpm run refresh                            # pnpm-policy inventory --cwd .
```

Five throttled requests, a couple of seconds. In CI this runs weekly and **opens a pull request** rather than committing ([`pnpm-policy-inventory.yml`](../../.github/workflows/pnpm-policy-inventory.yml)): a name appearing in the diff is a name that stops being quarantined, so it gets read by a human before it lands. The npm search endpoint is anonymous, so the job needs no registry token — only `contents: write` and `pull-requests: write` to open the PR.

Consuming repos pick the change up when they bump their pin, deliberately.
