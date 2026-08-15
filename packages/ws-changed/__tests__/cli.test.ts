import { rmSync } from 'fs';

import { parseArgs, run } from '../src/cli';
import { buildWorkspace } from './support/build-workspace';

describe('parseArgs', () => {
  it('parses provider as a repeatable, comma-separated list', () => {
    expect(parseArgs(['--provider', 'pnpm,pgpm']).overrides.provider).toEqual(['pnpm', 'pgpm']);
    expect(parseArgs(['--provider', 'pnpm', '--provider', 'glob']).overrides.provider).toEqual([
      'pnpm',
      'glob'
    ]);
  });

  it('parses --base and --no-base', () => {
    expect(parseArgs(['--base', 'origin/develop']).base).toBe('origin/develop');
    expect(parseArgs(['--no-base']).base).toBe(false);
  });

  it('accepts --flag=value form', () => {
    expect(parseArgs(['--base=origin/main']).base).toBe('origin/main');
  });

  it('parses global/include/exclude lists', () => {
    const p = parseArgs(['--global', 'pnpm-lock.yaml', '--global', '.github/**', '--exclude', 'apps/**']);
    expect(p.overrides.global).toEqual(['pnpm-lock.yaml', '.github/**']);
    expect(p.overrides.exclude).toEqual(['apps/**']);
  });

  it('parses the file filter flags into config.files', () => {
    const p = parseArgs(['--ext', 'sql,ts', '--files', 'deploy/**', '--not-files', '**/generated/**']);
    expect(p.overrides.files).toEqual({
      ext: ['sql', 'ts'],
      include: ['deploy/**'],
      exclude: ['**/generated/**']
    });
  });

  it('leaves config.files unset when no file flag is given', () => {
    expect(parseArgs(['--base', 'origin/main']).overrides.files).toBeUndefined();
  });

  it('throws on an unknown option', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown option/);
  });

  it('throws when a value-taking flag has no value', () => {
    expect(() => parseArgs(['--base'])).toThrow(/requires a value/);
  });
});

describe('run', () => {
  const roots: string[] = [];
  const logs: string[] = [];
  let logSpy: jest.SpyInstance;
  let outSpy: jest.SpyInstance;
  beforeEach(() => {
    logs.length = 0;
    logSpy = jest.spyOn(console, 'log').mockImplementation((...a) => void logs.push(a.join(' ')));
    outSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        logs.push(String(chunk).replace(/\n$/, ''));
        return true;
      });
  });
  afterEach(() => {
    logSpy.mockRestore();
    outSpy.mockRestore();
  });
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

  it('prints the version', () => {
    expect(run(['--version'])).toBe(0);
    expect(logs.join('\n')).toMatch(/\d+\.\d+\.\d+|unknown/);
  });

  it('exits 2 on a bad flag', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(run(['--bogus'])).toBe(2);
    err.mockRestore();
  });

  it('--list prints every package name', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        { dir: 'packages/a', pkg: { name: 'a' } },
        { dir: 'packages/b', pkg: { name: 'b', dependencies: { a: 'workspace:*' } } }
      ]
    });
    roots.push(root);
    expect(run(['--list', '--cwd', root, '--root', root])).toBe(0);
    expect(logs.join('\n').split('\n').sort()).toEqual(['a', 'b']);
  });

  it('--graph prints dependencies-first order', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        { dir: 'packages/a', pkg: { name: 'a' } },
        { dir: 'packages/b', pkg: { name: 'b', dependencies: { a: 'workspace:*' } } }
      ]
    });
    roots.push(root);
    expect(run(['--graph', '--cwd', root, '--root', root])).toBe(0);
    const out = logs.join('\n');
    expect(out).toContain('b <- a');
  });
});
