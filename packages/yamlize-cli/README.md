# @yamlize/cli

CLI for [yamlize](https://github.com/constructive-io/dev-utils/tree/main/packages/yamlize) — generate YAML from templates with imports and variable substitution.

## Install

```sh
npm install -g @yamlize/cli
```

Or locally:

```sh
npm install @yamlize/cli
```

## Usage

```sh
yamlize --config config.yaml --inFile meta.yaml --outFile output.yaml
```

### Options

| Flag | Description |
|---|---|
| `--config` | Path to a YAML config file providing template variables (optional) |
| `--inFile` | Path to the meta YAML template file |
| `--outFile` | Path where the generated YAML file will be saved |
| `--help, -h` | Show help message |
| `--version, -v` | Show version number |

### Config File

The config file provides the context for `${{yamlize.VAR}}` template substitution:

```yaml
git:
  USER_NAME: Cosmology
  USER_EMAIL: developers@cosmology.zone
NODE_VERSION: '20.x'
```

### Interactive Mode

When run without arguments, the CLI will prompt for each required option interactively.

### Example

Given a template `meta.yaml`:

```yaml
name: Build
on:
  workflow_dispatch:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - import-yaml: node/setup.yaml
      - name: Install
        run: yarn
```

And a fragment `node/setup.yaml`:

```yaml
name: Setup Node.js
uses: actions/setup-node@v4
with:
  node-version: ${{yamlize.NODE_VERSION}}
```

Running:

```sh
yamlize --config config.yaml --inFile meta.yaml --outFile workflow.yaml
```

Produces the fully resolved `workflow.yaml` with imports inlined and variables substituted.
