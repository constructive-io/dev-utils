# @genomic/utils

CLI lifecycle utilities for building command-line applications.

## Installation

```bash
npm install @genomic/utils
```

## Features

### extractFirst

Extracts the first positional argument from argv for command routing:

```typescript
import { extractFirst } from '@genomic/utils';

const { first, newArgv } = extractFirst(argv);
// first = 'init' (the subcommand)
// newArgv = remaining arguments with first positional removed
```

### cliExitWithError

Exits the CLI with an error message and optional cleanup:

```typescript
import { cliExitWithError } from '@genomic/utils';

await cliExitWithError(error, {
  beforeExit: async () => {
    await closeConnections();
  }
});
```

### checkForUpdates

Checks for package updates with caching:

```typescript
import { checkForUpdates } from '@genomic/utils';

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
import { getSelfPackageJson, getSelfVersion, getSelfName } from '@genomic/utils';

const pkg = getSelfPackageJson(__dirname);
const version = getSelfVersion(__dirname);
const name = getSelfName(__dirname);
```

## License

MIT
