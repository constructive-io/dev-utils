/**
 * Config and result shapes for pnpm-policy.
 */

/** A human duration (`14d`, `36h`, `90m`) or a plain number of minutes. */
export type Duration = string | number;

/** A third-party package allowed to skip the release-age wait. */
export interface PolicyException {
  /** Package name. Globs are allowed, but a glob here is a wide hole. */
  package: string;
  /** Exact versions the waiver covers. Omit to cover every version. */
  versions?: string[];
  /** Why this package may skip the wait. Required — a waiver without a reason is unreviewable. */
  reason: string;
  /** ISO date (`2026-10-01`) after which `check` fails until the waiver is renewed or removed. */
  until?: string;
}

/** A dependency permitted to run its install scripts. */
export interface AllowedBuild {
  package: string;
  reason?: string;
}

/** A dependency whose install scripts were reviewed and deliberately left off. */
export interface DeniedBuild {
  package: string;
  reason?: string;
}

export interface PolicyConfig {
  /**
   * How long a third-party release must exist before it may be installed.
   * This is the main lever: raise it to harden, lower it to move faster.
   */
  minimumReleaseAge?: Duration;
  /** Reject git/tarball/other non-registry transitive dependencies. */
  blockExoticSubdeps?: boolean;
  /** npm accounts *you publish under*. Everything they publish is exempt from the wait. */
  maintainers?: string[];
  /**
   * Scopes to treat as yours without asking the registry. Use for a scope you
   * own but publish to under a different account (CI tokens, org automation).
   */
  scopes?: string[];
  /**
   * Where the first-party inventory comes from: a path relative to this config,
   * or an installed package that ships one.
   *
   * A list is merged into a single inventory, which is how a workspace combines
   * inventories that are deliberately kept apart — your own accounts in one
   * published package, an upstream you have chosen to trust in another — without
   * either being flattened into a copy checked in beside the config.
   */
  inventory?: string | string[];
  /**
   * Emit only the first-party names this workspace actually resolves.
   * Scopes are always emitted as globs — see the README.
   */
  intersect?: boolean;
  /** Dependencies allowed to run install scripts. */
  allowBuilds?: Array<string | AllowedBuild> | Record<string, string | true>;
  /**
   * Dependencies whose install scripts are known and not needed. pnpm treats an
   * unlisted script as an open question — it warns, or on pnpm 11 fails the
   * install and asks for `pnpm approve-builds` — so a `false` here closes it.
   */
  denyBuilds?: Array<string | DeniedBuild> | Record<string, string | false>;
  /** Third-party escape hatches. */
  exceptions?: PolicyException[];
  /** Extra pnpm settings written verbatim into the workspace file. */
  settings?: Record<string, unknown>;
}

/** A resolved config: defaults applied, durations in minutes, shapes normalized. */
export interface ResolvedConfig {
  minimumReleaseAgeMinutes: number;
  blockExoticSubdeps: boolean;
  maintainers: string[];
  scopes: string[];
  /** Normalized to a list; empty when no inventory is configured. */
  inventory: string[];
  intersect: boolean;
  allowBuilds: AllowedBuild[];
  denyBuilds: DeniedBuild[];
  exceptions: PolicyException[];
  settings: Record<string, unknown>;
}

/** The packages a maintainer publishes, compressed to scope globs where possible. */
export interface Inventory {
  /** ISO timestamp of the registry query that produced this file. */
  generatedAt: string;
  /** The npm accounts queried. */
  maintainers: string[];
  /** Scopes published to exclusively by those accounts, safe to glob wholesale. */
  scopes: string[];
  /** Everything a scope glob cannot cover: unscoped names, and names in shared scopes. */
  packages: string[];
  /** Scopes seen in the query that hold packages published by someone else. */
  sharedScopes?: string[];
}

/**
 * A comment's target: a key path, spelled out segment by segment.
 *
 * Segments rather than a dotted string because a package name may contain a
 * dot (`lodash.merge`), and splitting that would address a key that is not there.
 */
export type CommentPath = Array<string | number>;

/** Rationale to attach to the generated settings. */
export interface PolicyComments {
  before: Array<[CommentPath, string]>;
  inline: Array<[CommentPath, string]>;
}

/** The pnpm settings a policy resolves to, plus the reasoning behind them. */
export interface ResolvedPolicy {
  settings: Record<string, unknown>;
  comments: PolicyComments;
  report: PolicyReport;
}

export interface PolicyReport {
  /** Release-age wait applied to third-party packages, in minutes. */
  minimumReleaseAgeMinutes: number;
  /** Scope globs emitted. */
  scopes: string[];
  /** First-party names emitted individually. */
  firstPartyPackages: string[];
  /** First-party names the inventory knows but this workspace does not use. */
  omittedPackages: string[];
  /** Exception patterns emitted. */
  exceptions: string[];
  /** Exceptions whose `until` date has passed. */
  expiredExceptions: PolicyException[];
}
