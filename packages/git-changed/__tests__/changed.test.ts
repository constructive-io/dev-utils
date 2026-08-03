import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { changedFiles, changedPaths, GitChanged } from '../src/changed';
import { GitChangedError } from '../src/git';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function write(cwd: string, file: string, body = 'select 1;\n'): void {
  const full = join(cwd, file);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, body);
}

function commit(cwd: string, message: string): void {
  git(['add', '-A'], cwd);
  git(['commit', '-q', '-m', message], cwd);
}

/** A repo with one commit on `branch` and an empty working tree. */
function makeRepo(branch = 'main'): string {
  const dir = mkdtempSync(join(tmpdir(), 'git-changed-'));
  git(['init', '-q', '-b', branch], dir);
  git(['config', 'user.email', 'test@example.com'], dir);
  git(['config', 'user.name', 'Test'], dir);
  git(['config', 'commit.gpgsign', 'false'], dir);
  write(dir, 'base.sql');
  commit(dir, 'base');
  return dir;
}

describe('changedFiles', () => {
  const repos: string[] = [];
  const track = (dir: string): string => {
    repos.push(dir);
    return dir;
  };

  afterAll(() => {
    for (const dir of repos) rmSync(dir, { recursive: true, force: true });
    delete process.env.GITHUB_BASE_REF;
  });

  beforeEach(() => {
    delete process.env.GITHUB_BASE_REF;
  });

  it('rejects a directory that is not a repository', () => {
    const dir = track(mkdtempSync(join(tmpdir(), 'git-changed-bare-')));
    expect(() => changedFiles({ cwd: dir })).toThrow(GitChangedError);
  });

  it('finds committed changes against the merge base, not the base tip', () => {
    const dir = track(makeRepo());
    git(['checkout', '-q', '-b', 'feature'], dir);
    write(dir, 'feature.sql');
    commit(dir, 'feature');

    // A commit landing on main after the fork must not be attributed to the
    // branch — this is the whole reason for using the merge base.
    git(['checkout', '-q', 'main'], dir);
    write(dir, 'other.sql');
    commit(dir, 'other');
    git(['checkout', '-q', 'feature'], dir);

    const result = changedFiles({ cwd: dir, base: 'main' });
    expect(result.source).toBe('merge-base');
    expect(result.mergeBase).toBeTruthy();
    expect(result.files.map((f) => f.relative)).toEqual(['feature.sql']);
    expect(result.files[0].committed).toBe(true);
    expect(result.files[0].worktree).toBe(false);
  });

  it('unions working-tree and untracked changes with committed ones', () => {
    const dir = track(makeRepo());
    git(['checkout', '-q', '-b', 'feature'], dir);
    write(dir, 'committed.sql');
    commit(dir, 'committed');
    write(dir, 'dirty.sql');
    write(dir, 'base.sql', 'select 2;\n');

    const result = changedFiles({ cwd: dir, base: 'main' });
    expect(result.files.map((f) => f.relative).sort()).toEqual([
      'base.sql',
      'committed.sql',
      'dirty.sql'
    ]);
    const dirty = result.files.find((f) => f.relative === 'dirty.sql');
    expect(dirty).toMatchObject({ status: 'untracked', worktree: true, committed: false });
  });

  it('lists untracked files inside a brand-new directory individually', () => {
    const dir = track(makeRepo());
    write(dir, 'pkg/deploy/one.sql');
    write(dir, 'pkg/deploy/two.sql');

    // Without `status -uall` git collapses this to the directory `pkg/`, and
    // every file under it goes unseen.
    expect(changedPaths({ cwd: dir, ext: '.sql' }).sort()).toEqual([
      join(dir, 'pkg/deploy/one.sql'),
      join(dir, 'pkg/deploy/two.sql')
    ]);
  });

  it('reports a rename at its destination and drops the vanished source', () => {
    const dir = track(makeRepo());
    write(dir, 'old.sql', 'select 42;\n');
    commit(dir, 'add old');
    git(['checkout', '-q', '-b', 'feature'], dir);
    git(['mv', 'old.sql', 'new.sql'], dir);
    commit(dir, 'rename');

    const result = changedFiles({ cwd: dir, base: 'main' });
    expect(result.files.map((f) => f.relative)).toEqual(['new.sql']);
    expect(result.files[0]).toMatchObject({ status: 'renamed', from: 'old.sql' });
  });

  it('omits deleted paths unless asked for them', () => {
    const dir = track(makeRepo());
    git(['checkout', '-q', '-b', 'feature'], dir);
    git(['rm', '-q', 'base.sql'], dir);
    commit(dir, 'delete');

    expect(changedFiles({ cwd: dir, base: 'main' }).files).toEqual([]);

    const withDeleted = changedFiles({ cwd: dir, base: 'main', existingOnly: false });
    expect(withDeleted.files.map((f) => f.relative)).toEqual(['base.sql']);
    expect(withDeleted.files[0]).toMatchObject({ status: 'deleted', exists: false });
  });

  it('falls back to the working tree when no base exists', () => {
    // No remote, no origin/HEAD, no main/master, no $GITHUB_BASE_REF: there is
    // nothing to diff against, as on a shallow or detached CI checkout.
    const dir = track(makeRepo('work'));
    write(dir, 'dirty.sql');

    const result = changedFiles({ cwd: dir });
    expect(result.base).toBeUndefined();
    expect(result.source).toBe('worktree');
    expect(result.files.map((f) => f.relative)).toEqual(['dirty.sql']);
  });

  it('discovers the local default branch when no base is given', () => {
    const dir = track(makeRepo());
    git(['checkout', '-q', '-b', 'feature'], dir);
    write(dir, 'feature.sql');
    commit(dir, 'feature');

    const result = changedFiles({ cwd: dir });
    expect(result.base).toBe('main');
    expect(result.source).toBe('merge-base');
    expect(result.files.map((f) => f.relative)).toEqual(['feature.sql']);
  });

  it('honours base: false even when a base could be resolved', () => {
    const dir = track(makeRepo());
    git(['checkout', '-q', '-b', 'feature'], dir);
    write(dir, 'committed.sql');
    commit(dir, 'committed');
    write(dir, 'dirty.sql');

    const result = changedFiles({ cwd: dir, base: false });
    expect(result.source).toBe('worktree');
    expect(result.files.map((f) => f.relative)).toEqual(['dirty.sql']);
  });

  it('ignores $GITHUB_BASE_REF when the remote ref is missing', () => {
    const dir = track(makeRepo());
    process.env.GITHUB_BASE_REF = 'main';
    write(dir, 'dirty.sql');

    // `origin/main` does not exist here. A naive implementation hands back that
    // ref anyway and every later git call rejects it; this falls through to the
    // local default branch instead.
    const result = changedFiles({ cwd: dir });
    expect(result.base).toBe('main');
    expect(result.files.map((f) => f.relative)).toEqual(['dirty.sql']);
  });

  it('uses $GITHUB_BASE_REF as origin/<branch> when that ref exists', () => {
    const origin = track(makeRepo());
    const dir = track(mkdtempSync(join(tmpdir(), 'git-changed-clone-')));
    git(['clone', '-q', origin, dir], process.cwd());
    git(['config', 'user.email', 'test@example.com'], dir);
    git(['config', 'user.name', 'Test'], dir);
    git(['checkout', '-q', '-b', 'feature'], dir);
    write(dir, 'feature.sql');
    commit(dir, 'feature');

    process.env.GITHUB_BASE_REF = 'main';
    const result = changedFiles({ cwd: dir });
    expect(result.base).toBe('origin/main');
    expect(result.files.map((f) => f.relative)).toEqual(['feature.sql']);
  });

  it('filters by extension, exclude, include and within', () => {
    const dir = track(makeRepo());
    write(dir, 'pkg/a.sql');
    write(dir, 'pkg/b.ts');
    write(dir, 'generated/c.sql');
    write(dir, 'other/d.sql');

    expect(changedFiles({ cwd: dir, ext: 'sql' }).files.map((f) => f.relative).sort()).toEqual(
      ['generated/c.sql', 'other/d.sql', 'pkg/a.sql']
    );
    expect(
      changedFiles({ cwd: dir, ext: '.sql', exclude: ['generated/'] })
        .files.map((f) => f.relative)
        .sort()
    ).toEqual(['other/d.sql', 'pkg/a.sql']);
    expect(
      changedFiles({ cwd: dir, include: ['pkg/**'] }).files.map((f) => f.relative).sort()
    ).toEqual(['pkg/a.sql', 'pkg/b.ts']);
    expect(
      changedFiles({ cwd: dir, within: ['pkg'], ext: ['.sql', '.ts'] })
        .files.map((f) => f.relative)
        .sort()
    ).toEqual(['pkg/a.sql', 'pkg/b.ts']);
  });

  it('excludes the whole subtree for a bare directory pattern', () => {
    const dir = track(makeRepo());
    write(dir, 'a/dist/x.sql');
    write(dir, 'a/src/y.sql');

    expect(
      changedFiles({ cwd: dir, exclude: ['dist/'] }).files.map((f) => f.relative)
    ).toEqual(['a/src/y.sql']);
  });

  it('reports paths relative to cwd when run from a subdirectory', () => {
    const dir = track(makeRepo());
    write(dir, 'pkg/deploy/one.sql');
    write(dir, 'outside.sql');

    const result = changedFiles({ cwd: join(dir, 'pkg') });
    // git speaks in repository-root paths; the caller asked from `pkg/`.
    expect(result.repoRoot).toBe(require('fs').realpathSync(dir));
    const byRel = result.files.map((f) => f.relative).sort();
    expect(byRel).toContain('deploy/one.sql');
    expect(byRel).toContain('../outside.sql');
  });

  it('handles paths that git quotes', () => {
    const dir = track(makeRepo());
    write(dir, 'we ird/na"me.sql');

    expect(changedFiles({ cwd: dir, ext: '.sql' }).files.map((f) => f.relative)).toEqual([
      'we ird/na"me.sql'
    ]);
  });

  it('can skip untracked files and the working tree', () => {
    const dir = track(makeRepo());
    git(['checkout', '-q', '-b', 'feature'], dir);
    write(dir, 'committed.sql');
    commit(dir, 'committed');
    write(dir, 'untracked.sql');
    write(dir, 'base.sql', 'select 3;\n');

    expect(
      changedFiles({ cwd: dir, base: 'main', untracked: false })
        .files.map((f) => f.relative)
        .sort()
    ).toEqual(['base.sql', 'committed.sql']);

    expect(
      changedFiles({ cwd: dir, base: 'main', worktree: false }).files.map((f) => f.relative)
    ).toEqual(['committed.sql']);
  });
});

describe('GitChanged', () => {
  const repos: string[] = [];

  afterAll(() => {
    for (const dir of repos) rmSync(dir, { recursive: true, force: true });
  });

  it('reuses constructor defaults and lets calls override them', () => {
    const dir = makeRepo();
    repos.push(dir);
    write(dir, 'pkg/a.sql');
    write(dir, 'pkg/a.ts');

    const changed = new GitChanged({ cwd: dir, ext: '.sql' });
    expect(changed.isRepo()).toBe(true);
    expect(changed.paths()).toEqual([join(dir, 'pkg/a.sql')]);
    expect(changed.paths({ ext: '.ts' })).toEqual([join(dir, 'pkg/a.ts')]);
    expect(changed.files({ ext: undefined }).length).toBe(2);
  });
});
