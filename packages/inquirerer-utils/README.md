# @inquirerer/utils

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
  <br />
    <strong>CLI lifecycle utilities</strong>
  <br />
  <br />
  Utilities for building command-line applications with inquirerer
  <br />
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

CLI lifecycle utilities for building command-line applications with [inquirerer](https://www.npmjs.com/package/inquirerer).

## Installation

```bash
npm install @inquirerer/utils
```

## Features

### extractFirst

Extracts the first positional argument from argv for command routing:

```typescript
import { extractFirst } from '@inquirerer/utils';

const { first, newArgv } = extractFirst(argv);
// first = 'init' (the subcommand)
// newArgv = remaining arguments with first positional removed
```

### cliExitWithError

Exits the CLI with an error message and optional cleanup:

```typescript
import { cliExitWithError } from '@inquirerer/utils';

await cliExitWithError(error, {
  beforeExit: async () => {
    await closeConnections();
  }
});
```

### checkForUpdates

Checks for package updates with caching:

```typescript
import { checkForUpdates } from '@inquirerer/utils';

const result = await checkForUpdates({
  pkgName: '@my/cli',
  pkgVersion: '1.0.0',
  registryBaseUrl: 'https://registry.npmjs.org'
});

if (result.hasUpdate) {
  console.log(result.message);
}
```

### getSelfPackageJson

Gets the package.json for the current package:

```typescript
import { getSelfPackageJson, getSelfVersion, getSelfName } from '@inquirerer/utils';

const pkg = getSelfPackageJson(__dirname);
const version = getSelfVersion(__dirname);
const name = getSelfName(__dirname);
```

## License

MIT
