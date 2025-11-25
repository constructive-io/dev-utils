# dev-utils

<p align="center">
  <img src="https://raw.githubusercontent.com/hyperweb-io/dev-utils/refs/heads/main/docs/img/logo.svg" width="80">
  <br />
  Open-source development utilities for modern web applications
  <br />
  <a href="https://github.com/hyperweb-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/hyperweb-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/hyperweb-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg">
  </a>
</p>

A comprehensive collection of TypeScript utilities for working with schemas, JSON-LD, API clients, and general-purpose development tools.

## Packages

| Package | npm | Source | Description |
|---------|-----|--------|-------------|
| **appstash** | [![npm](https://img.shields.io/npm/v/appstash.svg)](https://www.npmjs.com/package/appstash) | [GitHub](./packages/appstash) | Simple, clean application directory resolution |
| **clean-ansi** | [![npm](https://img.shields.io/npm/v/clean-ansi.svg)](https://www.npmjs.com/package/clean-ansi) | [GitHub](./packages/clean-ansi) | Remove ANSI escape codes from strings |
| **create-gen-app** | [![npm](https://img.shields.io/npm/v/create-gen-app.svg)](https://www.npmjs.com/package/create-gen-app) | [GitHub](./packages/create-gen-app) | Clone and customize template repositories with variable replacement |
| **inquirerer** | [![npm](https://img.shields.io/npm/v/inquirerer.svg)](https://www.npmjs.com/package/inquirerer) | [GitHub](./packages/inquirerer) | TypeScript-first library for building beautiful CLI interfaces with interactive prompts |
| **jsonldjs** | [![npm](https://img.shields.io/npm/v/jsonldjs.svg)](https://www.npmjs.com/package/jsonldjs) | [GitHub](./packages/jsonld-tools) | Powerful JSON-LD builder with comprehensive filtering and subgraph extraction |
| **komoji** | [![npm](https://img.shields.io/npm/v/komoji.svg)](https://www.npmjs.com/package/komoji) | [GitHub](./packages/komoji) | the tiny case transformer — effortlessly transform strings between naming conventions |
| **nested-obj** | [![npm](https://img.shields.io/npm/v/nested-obj.svg)](https://www.npmjs.com/package/nested-obj) | [GitHub](./packages/nested-obj) | Safely access and modify nested object properties using string paths |
| **schema-sdk** | [![npm](https://img.shields.io/npm/v/schema-sdk.svg)](https://www.npmjs.com/package/schema-sdk) | [GitHub](./packages/schema-sdk) | Convert JSON Schema OpenAPI Spec to TypeScript Clients |
| **schema-typescript** | [![npm](https://img.shields.io/npm/v/schema-typescript.svg)](https://www.npmjs.com/package/schema-typescript) | [GitHub](./packages/schema-typescript) | Convert JSON Schema to TypeScript Definitions |
| **strfy-js** | [![npm](https://img.shields.io/npm/v/strfy-js.svg)](https://www.npmjs.com/package/strfy-js) | [GitHub](./packages/strfy-js) | Stringify JSON as JavaScript with extended serialization capabilities |
| **yanse** | [![npm](https://img.shields.io/npm/v/yanse.svg)](https://www.npmjs.com/package/yanse) | [GitHub](./packages/yanse) | Fast and lightweight terminal color styling library with chalk-like API |
| **@interweb/fetch-api-client** | [![npm](https://img.shields.io/npm/v/@interweb/fetch-api-client.svg)](https://www.npmjs.com/package/@interweb/fetch-api-client) | [GitHub](./packages/fetch-api-client) | Universal Fetch-based HTTP client for Node.js and browsers |
| **@interweb/find-pkg** | [![npm](https://img.shields.io/npm/v/@interweb/find-pkg.svg)](https://www.npmjs.com/package/@interweb/find-pkg) | [GitHub](./packages/find-pkg) | Find the package.json file from within a build/package |
| **@interweb/http-errors** | [![npm](https://img.shields.io/npm/v/@interweb/http-errors.svg)](https://www.npmjs.com/package/@interweb/http-errors) | [GitHub](./packages/http-errors) | HTTP error handling utilities for API clients |
| **@interweb/node-api-client** | [![npm](https://img.shields.io/npm/v/@interweb/node-api-client.svg)](https://www.npmjs.com/package/@interweb/node-api-client) | [GitHub](./packages/node-api-client) | Lightweight HTTP client for Node.js RESTful APIs |
| **@schema-typescript/cli** | [![npm](https://img.shields.io/npm/v/@schema-typescript/cli.svg)](https://www.npmjs.com/package/@schema-typescript/cli) | [GitHub](./packages/schema-ts-cli) | schema-typescript CLI |

## Development

### Prerequisites

- Node.js 18+
- `pnpm` 

### Getting Started

When first cloning the repo:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Available Scripts

```bash
# Build all packages
pnpm build

# Clean all build artifacts
pnpm clean

# Run tests across all packages
pnpm test

# Lint all packages
pnpm lint
```

## Disclaimer

AS DESCRIBED IN THE LICENSES, THE SOFTWARE IS PROVIDED "AS IS", AT YOUR OWN RISK, AND WITHOUT WARRANTIES OF ANY KIND.

No developer or entity involved in creating this software will be liable for any claims or damages whatsoever associated with your use, inability to use, or your interaction with other users of the code, including any direct, indirect, incidental, special, exemplary, punitive or consequential damages, or loss of profits, cryptocurrencies, tokens, or anything else of value.
