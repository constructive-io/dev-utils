import { spawnSync } from 'child_process';

/** Thrown when git itself is unusable: not installed, or `cwd` is not a repo. */
export class GitChangedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitChangedError';
  }
}

/**
 * Run git and return stdout. Arguments are passed as an array — never a shell
 * string — so a branch name like `feat/it's-fine` cannot become a shell quoting
 * bug.
 */
export function git(args: string[], cwd: string): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    // A monorepo diff can be large, and the default 1 MB cap truncates it
    // *silently* — which reads as "nothing changed" rather than an error.
    maxBuffer: 64 * 1024 * 1024
  });

  if (result.error) {
    throw new GitChangedError(`git ${args[0]} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    throw new GitChangedError(
      `git ${args.join(' ')} exited ${result.status}${stderr ? `: ${stderr}` : ''}`
    );
  }
  return result.stdout ?? '';
}

/**
 * Run git, returning `undefined` instead of throwing. For the probes where
 * failure is a legitimate answer: a ref that does not exist, a shallow clone
 * with no merge base, a directory that is not a repository.
 */
export function tryGit(args: string[], cwd: string): string | undefined {
  try {
    return git(args, cwd);
  } catch {
    return undefined;
  }
}

/** Absolute path to the repository root, or `undefined` outside a repository. */
export function repoRoot(cwd: string): string | undefined {
  return tryGit(['rev-parse', '--show-toplevel'], cwd)?.trim() || undefined;
}

/** Whether `cwd` is inside a git work tree. */
export function isRepo(cwd: string): boolean {
  return tryGit(['rev-parse', '--is-inside-work-tree'], cwd)?.trim() === 'true';
}

/** Whether the repository is a shallow clone (no merge base to be had). */
export function isShallow(cwd: string): boolean {
  return tryGit(['rev-parse', '--is-shallow-repository'], cwd)?.trim() === 'true';
}
