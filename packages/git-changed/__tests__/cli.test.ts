import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { parseArgs, run } from '../src/cli';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function write(cwd: string, file: string, body = 'select 1;\n'): void {
  const full = join(cwd, file);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, body);
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'git-changed-cli-'));
  git(['init', '-q', '-b', 'main'], dir);
  git(['config', 'user.email', 'test@example.com'], dir);
  git(['config', 'user.name', 'Test'], dir);
  git(['config', 'commit.gpgsign', 'false'], dir);
  write(dir, 'base.sql');
  git(['add', '-A'], dir);
  git(['commit', '-q', '-m', 'base'], dir);
  return dir;
}

describe('parseArgs', () => {
  it('collects repeatable and comma-separated list values', () => {
    const { options } = parseArgs([
      '--ext',
      '.sql,.psql',
      '--ext',
      '.ddl',
      '--exclude',
      'dist/',
      '--exclude=generated/'
    ]);
    expect(options.ext).toEqual(['.sql', '.psql', '.ddl']);
    expect(options.exclude).toEqual(['dist/', 'generated/']);
  });

  it('maps the negative flags', () => {
    const { options } = parseArgs(['--no-base', '--no-worktree', '--no-untracked', '--deleted']);
    expect(options).toMatchObject({
      base: false,
      worktree: false,
      untracked: false,
      existingOnly: false
    });
  });

  it('rejects an unknown option and a flag with no value', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown option: --nope/);
    expect(() => parseArgs(['--base'])).toThrow(/--base requires a value/);
  });
});

describe('run', () => {
  const repos: string[] = [];
  let out: string;
  let err: string;
  let logSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;
  let writeSpy: jest.SpyInstance;

  beforeEach(() => {
    out = '';
    err = '';
    logSpy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      out += `${args.join(' ')}\n`;
    });
    errSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      err += `${args.join(' ')}\n`;
    });
    writeSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        out += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
        return true;
      });
    delete process.env.GITHUB_BASE_REF;
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    writeSpy.mockRestore();
  });

  afterAll(() => {
    for (const dir of repos) rmSync(dir, { recursive: true, force: true });
  });

  it('prints relative paths, one per line', () => {
    const dir = makeRepo();
    repos.push(dir);
    write(dir, 'pkg/a.sql');
    write(dir, 'pkg/b.ts');

    expect(run(['--cwd', dir, '--ext', '.sql'])).toBe(0);
    expect(out).toBe('pkg/a.sql\n');
  });

  it('exits 0 and prints nothing when nothing changed', () => {
    const dir = makeRepo();
    repos.push(dir);

    expect(run(['--cwd', dir])).toBe(0);
    expect(out).toBe('');
  });

  it('NUL-separates for xargs -0 without a trailing newline', () => {
    const dir = makeRepo();
    repos.push(dir);
    write(dir, 'a.sql');
    write(dir, 'b.sql');

    expect(run(['--cwd', dir, '--ext', '.sql', '--null'])).toBe(0);
    expect(out).toBe('a.sql\0b.sql\0');
  });

  it('prefixes the status and can print absolute paths', () => {
    const dir = makeRepo();
    repos.push(dir);
    write(dir, 'a.sql');

    expect(run(['--cwd', dir, '--status'])).toBe(0);
    expect(out).toBe('untracked\ta.sql\n');

    out = '';
    expect(run(['--cwd', dir, '--absolute'])).toBe(0);
    expect(out.trim()).toBe(join(dir, 'a.sql'));
  });

  it('emits the full result as JSON', () => {
    const dir = makeRepo();
    repos.push(dir);
    write(dir, 'a.sql');

    expect(run(['--cwd', dir, '--json', '--no-base'])).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed).toMatchObject({ source: 'worktree' });
    expect(parsed.files[0]).toMatchObject({ relative: 'a.sql', status: 'untracked' });
  });

  it('reports usage on a bad flag and fails on a non-repository', () => {
    expect(run(['--nope'])).toBe(2);
    expect(err).toMatch(/Unknown option/);

    const bare = mkdtempSync(join(tmpdir(), 'git-changed-bare-'));
    repos.push(bare);
    err = '';
    expect(run(['--cwd', bare])).toBe(1);
    expect(err).toMatch(/Not a git repository/);
  });

  it('prints help and a version', () => {
    expect(run(['--help'])).toBe(0);
    expect(out).toMatch(/git-changed — list files changed/);

    out = '';
    expect(run(['--version'])).toBe(0);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+|unknown$/);
  });
});
