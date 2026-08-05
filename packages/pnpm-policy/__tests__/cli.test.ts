import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { parseArgs, run } from '../src/cli';

describe('parseArgs', () => {
  it('reads a command and its options', () => {
    const parsed = parseArgs(['generate', '--cwd', '/tmp/ws', '--json']);
    expect(parsed).toMatchObject({ command: 'generate', cwd: '/tmp/ws', json: true });
  });

  it('accepts --flag=value as well as --flag value', () => {
    expect(parseArgs(['check', '--config=./policy.yaml']).config).toBe('./policy.yaml');
  });

  it('leaves scope verification off unless asked for', () => {
    expect(parseArgs(['inventory']).verifyScopes).toBe(false);
    expect(parseArgs(['inventory', '--verify-scopes']).verifyScopes).toBe(true);
  });

  it('rejects a builds key pnpm does not have', () => {
    expect(() => parseArgs(['generate', '--builds-key', 'allowScripts'])).toThrow(
      /--builds-key must be/
    );
  });

  it('rejects an unknown option instead of ignoring it', () => {
    expect(() => parseArgs(['generate', '--yolo'])).toThrow(/Unknown option/);
  });
});

describe('run', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  afterEach(() => {
    log.mockClear();
    error.mockClear();
  });

  afterAll(() => {
    log.mockRestore();
    error.mockRestore();
  });

  function workspace(): string {
    const dir = mkdtempSync(join(tmpdir(), 'pnpm-policy-cli-'));
    writeFileSync(join(dir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\npackages:\n  yanse@1.0.0: {}\n");
    return dir;
  }

  it('init writes a starter config, and refuses to overwrite one', async () => {
    const dir = workspace();
    expect(await run(['init', '--cwd', dir])).toBe(0);
    expect(readFileSync(join(dir, 'pnpm-policy.yaml'), 'utf-8')).toContain('minimumReleaseAge');
    expect(await run(['init', '--cwd', dir])).toBe(1);
  });

  it('generate then check round-trips to a clean exit', async () => {
    const dir = workspace();
    writeFileSync(join(dir, 'pnpm-policy.yaml'), 'minimumReleaseAge: 7d\n');

    expect(await run(['generate', '--cwd', dir])).toBe(0);
    expect(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf-8')).toContain(
      'minimumReleaseAge: 10080'
    );
    expect(await run(['check', '--cwd', dir])).toBe(0);
  });

  it('check exits non-zero on drift and says how to fix it', async () => {
    const dir = workspace();
    writeFileSync(join(dir, 'pnpm-policy.yaml'), 'minimumReleaseAge: 7d\n');
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'minimumReleaseAge: 0\n');

    expect(await run(['check', '--cwd', dir])).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('pnpm-policy generate'));
  });

  it('reports a config error without a stack trace', async () => {
    const dir = workspace();
    expect(await run(['generate', '--cwd', dir])).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('No policy config found'));
  });

  it('shows usage for no command, and for an unknown one', async () => {
    expect(await run([])).toBe(2);
    expect(await run(['frobnicate'])).toBe(2);
  });

  it('prints help on request', async () => {
    expect(await run(['--help'])).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('pnpm-policy <command>'));
  });
});
