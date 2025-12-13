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

This TypeScript module provides a function to locate, read, and parse the `package.json` file from the current directory or any of its parent directories.

## install

```sh
npm install find-and-require-package-json
```

### Example

```js
import { findAndRequirePackageJson } from 'find-and-require-package-json';

const packageJson = findAndRequirePackageJson();
console.log('Package name:', packageJson.name);
console.log('Version:', packageJson.version);
```