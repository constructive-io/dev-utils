# @inquirerer/test

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
  <br />
    <strong>CLI testing utilities</strong>
  <br />
  <br />
  Testing utilities for inquirerer-based CLI applications
  <br />
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

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

## Subprocess Testing (CLI E2E)

Some CLI tests need to exercise the actual built executable rather than the
in-process `Inquirerer` class — for example, you want to verify exit codes,
shebang resolution, or that the binary works against a real HTTP server. For
those, use `runCli`.

```typescript
import { runCli, parseArgString } from '@inquirerer/test';

const CLI_ENTRY = require.resolve('../src/index.ts');

it('search returns results', async () => {
  const { stdout, exitCode } = await runCli('node', [CLI_ENTRY, 'search', 'hello']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('1 result');
});
```

### Shell-string args

If you'd prefer to write args as a single string (handy for table-driven
tests), use `parseArgString` — it splits on whitespace while respecting
single- and double-quoted segments. It does **not** interpret shell
features (no globbing, no env expansion, no escapes).

```typescript
const { stdout } = await runCli(
  'node',
  parseArgString(`${CLI_ENTRY} search "hello world" --json`)
);
```

### Inspecting failures

By default `runCli` rejects with a `RunCliError` on non-zero exit, with the
captured `stdout` / `stderr` / `exitCode` attached. Pass `reject: false` to
resolve regardless of exit status:

```typescript
const result = await runCli(BIN, ['bad-command'], { reject: false });
expect(result.exitCode).toBe(1);
expect(result.stderr).toContain('Unknown command');
```

### Custom environment (e.g. `tsx` inside Jest)

When launching `tsx` / `ts-node` from a Jest worker, clear `NODE_OPTIONS`
to avoid Jest's instrumentation leaking into the child:

```typescript
await runCli(TSX_BIN, [CLI_ENTRY, 'init'], {
  cwd: REPO_ROOT,
  env: {
    ...process.env,
    HOME: testHome,
    NODE_OPTIONS: '',
  },
  timeout: 120_000,
});
```

### `runCli` API

```typescript
runCli(bin: string, args: string[], options?: RunCliOptions): Promise<RunCliResult>
```

| Option | Type | Default | Description |
|---|---|---|---|
| `cwd` | `string` | parent | Working directory for the child |
| `env` | `NodeJS.ProcessEnv` | parent | Environment vars (replaces parent env when set — spread `process.env` to extend) |
| `timeout` | `number` | `30_000` | Max ms before the child is killed |
| `killSignal` | `NodeJS.Signals` | `'SIGKILL'` | Signal used on timeout |
| `stdin` | `string` | — | Optional string written to the child's stdin |
| `reject` | `boolean` | `true` | Reject on non-zero exit; set `false` to inspect failures |

`RunCliResult` exposes `stdout`, `stderr`, `exitCode`, `signal`, `timedOut`, and `command`. `RunCliError` (thrown on non-zero exit or timeout) carries the same fields.

## License

MIT
