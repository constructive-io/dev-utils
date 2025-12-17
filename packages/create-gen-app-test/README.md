# create-gen-app-test

Integration tests for `create-gen-app` with cache leveraging using `appstash`.

## Overview

This package provides functionality to clone and cache template repositories for efficient reuse. It combines the power of `create-gen-app` for template processing and `appstash` for cache management.

## Features

- Clone GitHub repositories to a local cache
- Reuse cached templates for faster project generation
- Variable replacement in templates
- Integration tests with real GitHub cloning
- Snapshot testing for generated files

## Usage

```typescript
import { createFromCachedTemplate } from 'create-gen-app-test';

const result = await createFromCachedTemplate({
  templateUrl: 'https://github.com/constructive-io/pgpm-boilerplates',
  outputDir: './my-new-project',
  answers: {
    PROJECT_NAME: 'my-project',
    AUTHOR: 'Your Name',
    MODULE_NAME: 'mymodule'
  },
  cacheTool: 'mymodule'
});

console.log('Cache used:', result.cacheUsed);
```

## API

### `getCachedRepo(templateUrl, cacheTool?)`

Get cached repository from appstash cache directory.

- `templateUrl`: Repository URL
- `cacheTool`: Tool name for appstash (default: 'mymodule')
- Returns: Cached repository path or null if not found

### `cloneToCache(templateUrl, cacheTool?)`

Clone repository to cache.

- `templateUrl`: Repository URL
- `cacheTool`: Tool name for appstash (default: 'mymodule')
- Returns: Path to cached repository

### `createFromCachedTemplate(options)`

Create project from cached template.

- `options.templateUrl`: Repository URL
- `options.outputDir`: Output directory path
- `options.answers`: Variable replacements
- `options.cacheTool`: Tool name for appstash (default: 'mymodule')
- Returns: Promise with result containing outputDir, cacheUsed, and cachePath

## Testing

The package includes comprehensive integration tests that:

1. Clone real repositories from GitHub (default: https://github.com/constructive-io/pgpm-boilerplates)
2. Cache templates using appstash
3. Process templates with variable replacement
4. Snapshot generated files and package.json files
5. Test cache reuse on subsequent clones
6. Verify cache persistence

Run tests:

```bash
pnpm test
```

## Cache Location

Templates are cached using appstash at:
- `~/.{cacheTool}/cache/repos/{md5-hash-of-url}`

## License

MIT
