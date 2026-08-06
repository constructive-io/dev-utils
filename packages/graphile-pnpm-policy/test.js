#!/usr/bin/env node
/**
 * Guards the trust boundary this package exists to draw.
 *
 * Every name here is exempt from the release-age quarantine, so the list must
 * stay Graphile-owned. The account that publishes Graphile also co-maintains
 * `graphql` and the GraphiQL packages; a maintainer-derived list swept those in
 * once already, which is why this package enumerates names instead.
 *
 * Plain node asserts, no test framework: this is data, and the check should run
 * anywhere with no install.
 */
const assert = require('assert');
const inventory = require('./inventory.json');

const FORBIDDEN = [
  'graphql',
  'graphiql',
  'monaco-graphql',
  'graphql-language-service',
  'graphql-tag',
  'graphql-upload',
  'graphql-ws'
];

assert.ok(Array.isArray(inventory.packages), 'inventory.packages must be an array');
assert.ok(inventory.packages.length > 0, 'inventory.packages must not be empty');

// Scope globs would exempt anything published into that scope later — the same
// open-ended delegation as a maintainer entry. Names only.
assert.deepStrictEqual(inventory.scopes, [], 'scopes must stay empty: enumerate names instead');
assert.deepStrictEqual(
  inventory.maintainers,
  [],
  'maintainers must stay empty: this is a reviewed allowlist, not a maintainer query'
);

for (const name of FORBIDDEN) {
  assert.ok(
    !inventory.packages.includes(name),
    `${name} is not Graphile-owned and must not skip the quarantine`
  );
}

const sorted = [...inventory.packages].sort();
assert.deepStrictEqual(inventory.packages, sorted, 'packages must stay sorted for reviewable diffs');
assert.strictEqual(
  new Set(inventory.packages).size,
  inventory.packages.length,
  'packages must not contain duplicates'
);

console.log(`ok — ${inventory.packages.length} Graphile packages, no forbidden names`);
