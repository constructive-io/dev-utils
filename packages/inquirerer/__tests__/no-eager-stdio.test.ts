import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { defaultCLIOptions } from '../src/commander';

describe('inquirerer does not eagerly open stdio on require', () => {
  it('exposes defaultCLIOptions.input/output as lazy getters', () => {
    const inputDesc = Object.getOwnPropertyDescriptor(defaultCLIOptions, 'input');
    const outputDesc = Object.getOwnPropertyDescriptor(defaultCLIOptions, 'output');

    expect(inputDesc).toBeDefined();
    expect(outputDesc).toBeDefined();
    // Must be accessor properties, not data properties — otherwise
    // `process.stdin` / `process.stdout` would be evaluated at
    // module-load time and register libuv handles even for consumers
    // that never construct a CLI.
    expect(typeof inputDesc!.get).toBe('function');
    expect(typeof outputDesc!.get).toBe('function');
    expect(inputDesc!.value).toBeUndefined();
    expect(outputDesc!.value).toBeUndefined();
  });

  it('reading the getters returns process.stdin / process.stdout', () => {
    expect(defaultCLIOptions.input).toBe(process.stdin);
    expect(defaultCLIOptions.output).toBe(process.stdout);
  });

  // End-to-end guard: spawn a fresh Node process with stdin piped (so fd 0
  // is a PIPEWRAP, which is exactly the Jest-worker / spawned-child case
  // that surfaced the original bug in pgsql-test → @pgpmjs/core → genomic
  // → inquirerer). Require inquirerer, then assert the active handle set
  // is empty — i.e. no stdio was lazily materialised just by importing.
  it('require() alone does not materialise stdio handles', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inquirerer-stdio-'));
    const probe = join(dir, 'probe.js');
    writeFileSync(
      probe,
      `
        require(${JSON.stringify(require.resolve('../dist/index.js'))});
        setImmediate(() => {
          const byType = {};
          for (const h of process._getActiveHandles()) {
            const t = (h && h.constructor && h.constructor.name) || typeof h;
            byType[t] = (byType[t] || 0) + 1;
          }
          process.stdout.write(JSON.stringify(byType));
        });
      `
    );

    const out = execFileSync(process.execPath, [probe], {
      input: '',
      encoding: 'utf8',
    });
    const byType = JSON.parse(out);
    // No Socket (stdin) or WriteStream (stdout) should be kept alive.
    expect(byType.Socket).toBeUndefined();
    expect(byType.WriteStream).toBeUndefined();
  });
});
