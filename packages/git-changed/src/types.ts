/**
 * How a file came to be in the changed set. `deleted` and `renamed` are the two
 * a naive implementation gets wrong: linting a path that no longer exists is a
 * crash, and a rename must be reported at its *destination*.
 */
export type ChangeStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'untracked'
  | 'unknown';

export interface ChangedFile {
  /** Absolute path. */
  path: string;
  /** Path relative to `cwd`, `/`-separated — what you print. */
  relative: string;
  status: ChangeStatus;
  /** For a rename, the path it came from. */
  from?: string;
  /** Present in the diff against the base. */
  committed: boolean;
  /** Present in `git status` — uncommitted or untracked. */
  worktree: boolean;
  /** Whether the path exists on disk right now. */
  exists: boolean;
}

/** Where the committed half of the set came from. */
export type ChangedSource =
  /** `merge-base HEAD <base>` — the normal PR case. */
  | 'merge-base'
  /** The base ref exists but has no merge base with HEAD (unrelated history). */
  | 'base'
  /** No base at all: working-tree changes only (shallow, detached, no remote). */
  | 'worktree';

export interface ChangedOptions {
  /** Directory to resolve from and report relative to. Default `process.cwd()`. */
  cwd?: string;
  /**
   * Ref to diff against. Omit to auto-resolve (`$GITHUB_BASE_REF` → default
   * branch); pass `false` for working-tree changes only.
   */
  base?: string | false;
  /** Keep only these extensions, e.g. `'.sql'` or `['.sql', '.psql']`. */
  ext?: string | string[];
  /** Keep only paths matching these globs. */
  include?: string[];
  /** Drop paths matching these globs — generated trees, `dist/`, fixtures. */
  exclude?: string[];
  /**
   * Restrict to these directories. Cheaper and more predictable than an
   * `include` glob when you already know the subtree (a package dir, a CLI's
   * positional paths).
   */
  within?: string[];
  /** Drop paths that no longer exist. Default `true`. */
  existingOnly?: boolean;
  /** Include uncommitted/untracked working-tree changes. Default `true`. */
  worktree?: boolean;
  /** Include untracked files. Default `true`; ignored when `worktree` is false. */
  untracked?: boolean;
}

export interface ChangedResult {
  /** The changed files, sorted by path, after filtering. */
  files: ChangedFile[];
  /** Absolute paths — the common case, so you don't map every call site. */
  paths: string[];
  /** The base that was used, if any. */
  base?: string;
  /** The resolved merge-base commit, if one was found. */
  mergeBase?: string;
  source: ChangedSource;
  /** Absolute path to the repository root. */
  repoRoot: string;
}
