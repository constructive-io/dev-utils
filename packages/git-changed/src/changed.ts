import { existsSync } from 'fs';
import { isAbsolute, relative, resolve, sep } from 'path';

import { resolveBase } from './base';
import { GitChangedError, isRepo, repoRoot, tryGit } from './git';
import { makeMatcher, normalizeExts, withinAny } from './match';
import type {
  ChangedFile,
  ChangedOptions,
  ChangedResult,
  ChangedSource,
  ChangeStatus
} from './types';

/** Map a `git diff --name-status` letter to a status. */
function diffStatus(code: string): ChangeStatus {
  switch (code[0]) {
  case 'A':
    return 'added';
  case 'M':
  case 'T':
    return 'modified';
  case 'D':
    return 'deleted';
  case 'R':
  case 'C':
    return 'renamed';
  default:
    return 'unknown';
  }
}

/** Map the two-letter `git status --porcelain` code to a status. */
function porcelainStatus(code: string): ChangeStatus {
  if (code === '??') return 'untracked';
  // Either column can carry the interesting letter: `M ` is staged, ` M` is
  // unstaged, `MM` is both. Prefer the first non-space.
  const letter = code.trim()[0] ?? '';
  switch (letter) {
  case 'A':
    return 'added';
  case 'D':
    return 'deleted';
  case 'R':
  case 'C':
    return 'renamed';
  case 'M':
  case 'T':
    return 'modified';
  default:
    return 'unknown';
  }
}

/** Strip git's quoting of paths with unusual characters. */
function unquote(p: string): string {
  if (!p.startsWith('"')) return p;
  const inner = p.slice(1, -1);
  try {
    return JSON.parse(`"${inner}"`) as string;
  } catch {
    return inner;
  }
}

interface Entry {
  status: ChangeStatus;
  from?: string;
  committed: boolean;
  worktree: boolean;
}

/**
 * Merge a path into the accumulator. A path can show up twice — committed
 * against the base *and* modified again in the working tree — so keep the union
 * of the flags and let the later, more specific status win.
 */
function record(map: Map<string, Entry>, path: string, next: Entry): void {
  const prev = map.get(path);
  if (!prev) {
    map.set(path, next);
    return;
  }
  map.set(path, {
    // A path deleted in the working tree is deleted, whatever the base said.
    status: next.status === 'deleted' ? 'deleted' : prev.status,
    from: prev.from ?? next.from,
    committed: prev.committed || next.committed,
    worktree: prev.worktree || next.worktree
  });
}

/** Committed changes between the merge base (or the base ref) and `HEAD`. */
function collectCommitted(
  map: Map<string, Entry>,
  cwd: string,
  from: string
): void {
  // -M detects renames so the destination is reported instead of an
  // add/delete pair.
  const out = tryGit(['diff', '--name-status', '-M', from, 'HEAD'], cwd) ?? '';
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const code = parts[0];
    const status = diffStatus(code);
    if (status === 'renamed' && parts.length >= 3) {
      // R100<TAB>old<TAB>new — the destination is what exists now.
      record(map, unquote(parts[2]), {
        status,
        from: unquote(parts[1]),
        committed: true,
        worktree: false
      });
      continue;
    }
    if (parts.length < 2) continue;
    record(map, unquote(parts[1]), { status, committed: true, worktree: false });
  }
}

/** Uncommitted and untracked changes in the working tree. */
function collectWorktree(
  map: Map<string, Entry>,
  cwd: string,
  untracked: boolean
): void {
  // -uall lists files inside a new directory individually. Without it git
  // reports the directory as a single entry and every file under it is invisible
  // to the caller — the bug this utility exists to stop re-implementing.
  const args = ['status', '--porcelain', untracked ? '-uall' : '-uno'];
  const out = tryGit(args, cwd) ?? '';
  for (const raw of out.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line) continue;
    const code = line.slice(0, 2);
    let path = line.slice(3);
    let from: string | undefined;
    const arrow = path.indexOf(' -> ');
    if (arrow !== -1) {
      from = unquote(path.slice(0, arrow));
      path = path.slice(arrow + 4);
    }
    path = unquote(path);
    if (!path) continue;
    record(map, path, {
      status: porcelainStatus(code),
      from,
      committed: false,
      worktree: true
    });
  }
}

/**
 * Files changed relative to a base ref, unioned with working-tree changes.
 *
 * ```ts
 * changedFiles({ ext: '.sql', exclude: ['**\/generated/**'] });
 * // → { files: [...], paths: [...], base: 'origin/main', source: 'merge-base' }
 * ```
 *
 * Resolution order for the base is `options.base` → `$GITHUB_BASE_REF` → the
 * repository default branch; pass `base: false` to skip it entirely. When no
 * base is available the result falls back to the working tree with
 * `source: 'worktree'` rather than throwing, so a gate still checks what the
 * author is editing on a shallow or detached checkout.
 */
export function changedFiles(options: ChangedOptions = {}): ChangedResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  if (!isRepo(cwd)) {
    throw new GitChangedError(`Not a git repository: ${cwd}`);
  }
  const root = repoRoot(cwd) ?? cwd;

  const base = options.base === false ? undefined : resolveBase(options.base, cwd);
  let mergeBase: string | undefined;
  let source: ChangedSource = 'worktree';

  if (base) {
    mergeBase = tryGit(['merge-base', 'HEAD', base], cwd)?.trim() || undefined;
    source = mergeBase ? 'merge-base' : 'base';
  }

  const map = new Map<string, Entry>();
  // Diff from the merge base, not the branch tip: changes the base picked up
  // since this branch forked are not this branch's changes.
  if (base) collectCommitted(map, cwd, mergeBase ?? base);
  if (options.worktree !== false) {
    collectWorktree(map, cwd, options.untracked !== false);
  }

  const exts = normalizeExts(options.ext);
  const included = makeMatcher(options.include ?? [], cwd);
  const hasInclude = (options.include ?? []).filter((p) => p && p.trim()).length > 0;
  const excluded = makeMatcher(options.exclude ?? [], cwd);
  const within = options.within ?? [];
  const existingOnly = options.existingOnly !== false;

  const files: ChangedFile[] = [];
  for (const [gitPath, entry] of map) {
    // git reports paths from the repository root; everything else here is
    // relative to `cwd`, which may be a subdirectory.
    const abs = resolve(root, gitPath);
    const rel = relative(cwd, abs).split(sep).join('/');
    const exists = existsSync(abs);

    if (existingOnly && !exists) continue;
    if (exts.length > 0 && !exts.some((e) => abs.toLowerCase().endsWith(e))) continue;
    if (!withinAny(abs, within, cwd)) continue;
    if (hasInclude && !included(abs)) continue;
    if (excluded(abs)) continue;

    files.push({
      path: abs,
      relative: rel,
      status: entry.status,
      from: entry.from,
      committed: entry.committed,
      worktree: entry.worktree,
      exists
    });
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return {
    files,
    paths: files.map((f) => f.path),
    base,
    mergeBase,
    source,
    repoRoot: root
  };
}

/** Just the absolute paths — the common case. */
export function changedPaths(options: ChangedOptions = {}): string[] {
  return changedFiles(options).paths;
}

/**
 * Bound to one repository, so a tool that asks several questions resolves the
 * repository root and the base once.
 *
 * ```ts
 * const changed = new GitChanged({ cwd, exclude: ['dist/'] });
 * changed.paths({ ext: '.sql' });
 * changed.paths({ ext: ['.ts', '.tsx'] });
 * ```
 *
 * Options given to the constructor are defaults; options passed to a method
 * override them key by key. Array options replace rather than merge — an
 * `exclude` on a call means "these instead", which is easier to reason about
 * than a growing union.
 */
export class GitChanged {
  private readonly defaults: ChangedOptions;
  readonly cwd: string;

  constructor(options: ChangedOptions = {}) {
    this.cwd = resolve(options.cwd ?? process.cwd());
    this.defaults = { ...options, cwd: this.cwd };
  }

  /** Whether `cwd` is inside a git work tree. */
  isRepo(): boolean {
    return isRepo(this.cwd);
  }

  /** Absolute path to the repository root. */
  root(): string | undefined {
    return repoRoot(this.cwd);
  }

  /** The base ref this instance would diff against. */
  base(): string | undefined {
    const base = this.defaults.base;
    return base === false ? undefined : resolveBase(base, this.cwd);
  }

  files(options: ChangedOptions = {}): ChangedFile[] {
    return this.result(options).files;
  }

  paths(options: ChangedOptions = {}): string[] {
    return this.result(options).paths;
  }

  result(options: ChangedOptions = {}): ChangedResult {
    return changedFiles({ ...this.defaults, ...options, cwd: this.cwd });
  }
}

/** Resolve a path against `cwd`, for callers holding relative paths. */
export function toAbsolute(file: string, cwd: string = process.cwd()): string {
  return isAbsolute(file) ? file : resolve(cwd, file);
}
