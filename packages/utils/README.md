# @commodore/utils

CLI lifecycle utilities for building command-line applications.

## Installation

```bash
npm install @commodore/utils
```

## Features

- **extractFirst** - Extract the first positional argument for command routing
- **cliExitWithError** - Consistent error handling with optional cleanup hooks
- **checkForUpdates** - Check for package updates with configurable registry
- **getSelfPackageJson** - Get the package.json for the current CLI tool

## Usage

### extractFirst

Extract the first positional argument from argv for command routing:

```typescript
import { extractFirst } from '@commodore/utils';
import minimist from 'minimist';

const argv = minimist(process.argv.slice(2));
// argv = { _: ['install', 'package-name'], verbose: true }

const { first, newArgv } = extractFirst(argv);
// first = 'install'
// newArgv = { _: ['package-name'], verbose: true }
```

### cliExitWithError

Handle CLI errors consistently with optional cleanup:

```typescript
import { cliExitWithError } from '@commodore/utils';

// Basic usage
await cliExitWithError('Something went wrong');

// With context
await cliExitWithError(new Error('Failed to connect'), {
  context: { host: 'localhost', port: 5432 }
});

// With cleanup hook (e.g., for database connections)
await cliExitWithError(error, {
  beforeExit: async () => {
    await teardownPgPools();
  }
});
```

### checkForUpdates

Check if a newer version is available:

```typescript
import { checkForUpdates } from '@commodore/utils';

const result = await checkForUpdates({
  pkgName: '@constructive-io/cli',
  currentVersion: '1.0.0',
  toolName: 'cnc'
});

if (result.updateAvailable) {
  console.log(`Update available: ${result.latestVersion}`);
}
```

### getSelfPackageJson

Get the package.json for the current CLI tool:

```typescript
import { getSelfPackageJson, getSelfVersion } from '@commodore/utils';

const pkg = getSelfPackageJson(__dirname);
console.log(`${pkg.name}@${pkg.version}`);

// Or just get the version
const version = getSelfVersion(__dirname);
```

## License

MIT
