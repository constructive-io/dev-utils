# @inquirerer/test

Testing utilities for [inquirerer](https://www.npmjs.com/package/inquirerer)-based CLI applications.

## Installation

```bash
npm install --save-dev @inquirerer/test
```

## Usage

### Basic Test Setup

```typescript
import { createTestEnvironment, KEY_SEQUENCES } from '@inquirerer/test';
import { Inquirerer } from 'inquirerer';

describe('my CLI', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  it('should handle user input', async () => {
    // Queue up user inputs
    env.sendKey(KEY_SEQUENCES.ENTER);
    
    const prompter = new Inquirerer(env.options);
    const result = await prompter.prompt({}, [
      { name: 'confirm', type: 'confirm', message: 'Continue?' }
    ]);
    
    expect(result.confirm).toBe(true);
  });
});
```

### Key Sequences

The package exports common key sequences for simulating user input:

```typescript
import { KEY_SEQUENCES } from '@inquirerer/test';

KEY_SEQUENCES.ENTER      // Enter/Return key
KEY_SEQUENCES.UP_ARROW   // Up arrow
KEY_SEQUENCES.DOWN_ARROW // Down arrow
KEY_SEQUENCES.SPACE      // Space bar
KEY_SEQUENCES.TAB        // Tab key
KEY_SEQUENCES.ESCAPE     // Escape key
KEY_SEQUENCES.BACKSPACE  // Backspace
KEY_SEQUENCES.CTRL_C     // Ctrl+C (interrupt)
KEY_SEQUENCES.CTRL_D     // Ctrl+D (EOF)
```

### Snapshot Utilities

Normalize package.json files for stable snapshots:

```typescript
import { normalizePackageJsonForSnapshot } from '@inquirerer/test';

const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const normalized = normalizePackageJsonForSnapshot(pkgJson, {
  preserveVersionsFor: ['my-important-package']
});

expect(normalized).toMatchSnapshot();
```

Normalize paths and dates for cross-platform snapshots:

```typescript
import { normalizePathsForSnapshot, normalizeDatesForSnapshot } from '@inquirerer/test';

const output = normalizePathsForSnapshot(rawOutput);
const stableOutput = normalizeDatesForSnapshot(output);

expect(stableOutput).toMatchSnapshot();
```

### TestEnvironment API

The `createTestEnvironment()` function returns a `TestEnvironment` object with:

| Property | Type | Description |
|----------|------|-------------|
| `options` | `Partial<CLIOptions>` | CLI options configured with mock streams |
| `mockInput` | `Readable` | Mock stdin stream |
| `mockOutput` | `Writable` | Mock stdout stream |
| `writeResults` | `string[]` | Captured output lines (ANSI stripped) |
| `enqueueInputResponse` | `(input) => void` | Queue an input response |
| `sendKey` | `(key) => void` | Send a key sequence immediately |
| `sendLine` | `(text) => void` | Send text input (for readline) |
| `getOutput` | `() => string` | Get all captured output |
| `clearOutput` | `() => void` | Clear captured output |

## License

MIT
