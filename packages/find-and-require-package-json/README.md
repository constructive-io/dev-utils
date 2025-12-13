# find-and-require-package-json

<p align="center">
  <img src="https://raw.githubusercontent.com/hyperweb-io/dev-utils/refs/heads/main/docs/img/logo.svg" width="80">
  <br />
    Find the package.json file from within a build/package
  <br />
  <a href="https://github.com/hyperweb-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/hyperweb-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/hyperweb-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

This TypeScript module provides a function to locate, read, and parse the `package.json` file starting from a specified directory and searching up through parent directories.

## install

```sh
npm install find-and-require-package-json
```

### Example

```js
import { findAndRequirePackageJson } from 'find-and-require-package-json';

// Pass __dirname to find the package.json for your module
const packageJson = findAndRequirePackageJson(__dirname);
console.log('Package name:', packageJson.name);
console.log('Version:', packageJson.version);
```

### ESM Usage

For ESM modules, you'll need to convert `import.meta.url` to a directory path:

```js
import { findAndRequirePackageJson } from 'find-and-require-package-json';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = findAndRequirePackageJson(__dirname);
```
