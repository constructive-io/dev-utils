# yamlize

YAML templating engine with import resolution, variable substitution, and deep merge.

## Install

```sh
npm install yamlize
```

For CLI usage, see [@yamlize/cli](https://github.com/constructive-io/dev-utils/tree/main/packages/yamlize-cli).

## Usage

### File-based (original API)

Create a meta YAML template that references other YAML fragments via `import-yaml`, and substitute variables with `${{yamlize.VAR}}`:

**meta.yaml**

```yaml
name: Build

on:
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - import-yaml: node/setup.yaml
      - import-yaml: git/configure.yaml
      - name: Install and Build
        run: |
          yarn
```

**node/setup.yaml**

```yaml
name: Setup Node.js
uses: actions/setup-node@v4
with:
  node-version: ${{yamlize.NODE_VERSION}}
  cache: 'yarn'
```

**git/configure.yaml**

```yaml
name: Configure Git
run: |
  git config user.name "${{yamlize.git.USER_NAME}}"
  git config user.email "${{yamlize.git.USER_EMAIL}}"
```

```ts
import { yamlize } from 'yamlize';

yamlize('meta.yaml', 'output.yaml', {
  git: {
    USER_NAME: 'Cosmology',
    USER_EMAIL: 'developers@cosmology.zone',
  },
  NODE_VERSION: '20.x',
});
```

### Programmatic API

Work with YAML strings or objects directly without reading/writing files:

```ts
import { yamlizeString, yamlizeObject, toYaml, fromYaml } from 'yamlize';

// Resolve template variables in a YAML string
const result = yamlizeString(
  'image: ${{yamlize.IMAGE}}',
  { IMAGE: 'nginx:1.25' }
);
// => { image: 'nginx:1.25' }

// Resolve template variables in a parsed object
const resolved = yamlizeObject(
  { name: '${{yamlize.APP}}', replicas: 3 },
  { APP: 'my-service' }
);
// => { name: 'my-service', replicas: 3 }

// Serialize / parse
const yaml = toYaml({ name: 'test', version: 1 });
const obj = fromYaml(yaml);
```

### Deep Merge

Merge YAML/JSON objects with configurable null semantics:

```ts
import { merge, mergeNullable } from 'yamlize';

// Deep merge — null values inherit from base (default)
const merged = merge(
  { spec: { replicas: 1, image: 'nginx' } },
  { spec: { replicas: 3 } }
);
// => { spec: { replicas: 3, image: 'nginx' } }

// null in overrides is skipped, base value preserved
merge({ image: 'nginx:1.0' }, { image: null });
// => { image: 'nginx:1.0' }

// With nullRemoves: true, null deletes the key
merge({ image: 'nginx:1.0' }, { image: null }, { nullRemoves: true });
// => {}

// Shallow merge with null-skipping
mergeNullable(
  { name: 'app', replicas: 1 },
  { replicas: 5, name: null }
);
// => { name: 'app', replicas: 5 }
```

## API

| Function | Description |
|---|---|
| `yamlize(inFile, outFile, context)` | Read template, resolve imports + variables, write output file |
| `yamlizeString(yaml, context, opts?)` | Resolve a YAML string against a context, return parsed object |
| `yamlizeObject(obj, context, opts?)` | Resolve a parsed object against a context |
| `toYaml(obj)` | Serialize a value to YAML string |
| `fromYaml(str)` | Parse a YAML string to a value |
| `parse(obj, dir, context)` | Low-level: resolve imports + variables recursively |
| `merge(base, overrides, opts?)` | Deep merge with null-inheritance (default) or null-removes |
| `mergeNullable(base, overrides)` | Shallow merge skipping null/undefined overrides |
