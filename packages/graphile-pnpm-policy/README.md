# @constructive-io/pnpm-policy-graphile

Release-age exemptions for the Graphile packages Constructive runs.

Pair it with `@constructive-io/pnpm-policy` (our own packages) in any workspace that consumes Graphile:

```yaml
inventory:
  - "@constructive-io/pnpm-policy"
  - "@constructive-io/pnpm-policy-graphile"
```

`pnpm-policy` merges the two, and `intersect: true` narrows the result to whatever that workspace's lockfile actually resolves — so a repo with no Graphile dependency emits none of these names.

## Why this is a list and not a maintainer query

The obvious way to exempt an upstream is to add its npm account under `maintainers`. That is what we did first, and it was wrong.

`maintainers` exempts **everything the account publishes**, and the account that publishes the Graphile stack also co-maintains `graphql` — the reference implementation — along with `graphiql`, `monaco-graphql`, and `graphql-language-service`. Those swept into our exemption list, so the most widely depended-upon package in the JavaScript ecosystem was skipping the quarantine. Worse, `graphql` has six maintainers, so a compromise of *any* of those accounts would have published a release that installed immediately, with no wait.

An account is a delegation as wide as everything that account will ever touch. That is fine for accounts we control and wrong for anyone who also maintains popular upstream software.

So this package enumerates package names instead. Nothing is exempt unless it is written down here.

## How the list is derived

1. Take every package the Constructive workspaces resolve (read from their lockfiles, so transitive dependencies are included — not just direct ones).
2. Keep the ones whose npm `repository` points at a Graphile-owned repository (`github.com/graphile/*`, `github.com/graphile-contrib/*`).
3. Drop everything else, including packages that merely look Graphile-adjacent.

Step 2 is the whole test, and it is checkable: `npm view <pkg> repository.url`. `graphql`, `graphiql`, `monaco-graphql`, `graphql-language-service`, `@graphiql/*`, `graphql-tag`, `graphql-upload` and `graphql-ws` all fail it — they belong to `graphql/graphql-js`, `graphql/graphiql`, Apollo, and individual authors. They wait like any other third-party dependency.

The current list is the union across `constructive` and `constructive-db`, which independently resolve the same 16 packages.

Scope globs are deliberately **not** used. `@graphile/*` or `@dataplan/*` would exempt anything published into those scopes in the future, which is the same open-ended delegation as a maintainer entry, just smaller. Names cost a line each and say exactly what was decided.

## Updating it

Adding a Graphile dependency that is not listed here means the install waits out the quarantine. Add the name, note why it is needed, and confirm its `repository` is Graphile-owned before merging. That review is the point: this file is a trust boundary, and it should be as boring and explicit as one.
