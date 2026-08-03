import { tryGit } from './git';

/**
 * Candidate default branches, in the order git itself would find them. Tried
 * only when the remote HEAD symref is missing — which is the norm in CI, where
 * `actions/checkout` never sets it.
 */
const FALLBACK_BASES = ['origin/main', 'origin/master', 'main', 'master'];

/** The repository's default branch (`origin/main`, `origin/master`, …). */
export function defaultBranch(cwd: string): string | undefined {
  const head = tryGit(['symbolic-ref', 'refs/remotes/origin/HEAD'], cwd)?.trim();
  if (head) {
    // refs/remotes/origin/HEAD → refs/remotes/origin/main → origin/main
    const short = head.replace(/^refs\/remotes\//, '');
    if (short) return short;
  }
  return FALLBACK_BASES.find(
    (ref) => tryGit(['rev-parse', '--verify', '--quiet', ref], cwd) !== undefined
  );
}

/**
 * Resolve the ref to diff against, in precedence order:
 *
 * 1. an explicit base (`--base`, or `base` in code) — always wins;
 * 2. `$GITHUB_BASE_REF` — the PR's target branch, set by GitHub Actions on
 *    `pull_request` events, as `origin/<branch>` since only the remote ref is
 *    fetched;
 * 3. the repository's default branch.
 *
 * `undefined` means "no base is available" — a detached checkout, a fresh repo
 * with no remote, or a shallow clone whose base ref was never fetched. Callers
 * fall back to the working tree rather than failing: a gate that cannot see the
 * base should still catch what the author is editing right now.
 */
export function resolveBase(base?: string, cwd: string = process.cwd()): string | undefined {
  if (base && base.trim()) return base.trim();

  const prBase = process.env.GITHUB_BASE_REF;
  if (prBase && prBase.trim()) {
    const ref = `origin/${prBase.trim()}`;
    if (tryGit(['rev-parse', '--verify', '--quiet', ref], cwd) !== undefined) return ref;
    // The remote ref is missing (a single-branch or shallow fetch). Fall through
    // rather than handing back a ref that every later git call will reject.
  }

  return defaultBranch(cwd);
}
