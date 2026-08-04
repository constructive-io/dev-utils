/**
 * A single node in a workspace: a pnpm package, a pgpm module, or a plain
 * directory — whatever the active provider considers a unit. `name` is the
 * node's identity within the workspace (a pnpm package name, a pgpm module
 * name); edges are expressed between names.
 */
export interface WorkspacePackage {
  /** Identity within the workspace — the thing edges point at. */
  name: string;
  /** Absolute path to the package directory. */
  dir: string;
  /** Path relative to the workspace root, `/`-separated — what you print. */
  relDir: string;
  /**
   * Names of this package's direct dependencies *that live in the workspace*.
   * Dependencies on things outside the workspace go in {@link external}.
   */
  requires: string[];
  /** Direct dependency names that are not workspace packages. */
  external: string[];
  /** Which provider produced this node (`pnpm`, `pgpm`, `glob`, …). */
  provider: string;
  /** Provider-specific extras (dependency edge kinds, version specs, …). */
  meta?: Record<string, unknown>;
}

/** A resolved workspace: its packages plus the root they were discovered under. */
export interface Workspace {
  /** Absolute path to the workspace root. */
  root: string;
  /** Providers that contributed nodes, in the order they ran. */
  providers: string[];
  /** Discovered packages, sorted by name. */
  packages: WorkspacePackage[];
}

/** pnpm dependency edge kinds, so callers can select which ones count. */
export type EdgeKind = 'prod' | 'dev' | 'peer' | 'optional';

/** Context a provider is given to discover its packages. */
export interface ProviderContext {
  /** Absolute path to the workspace root. */
  root: string;
  /** The fully-merged config (provider-specific keys live under `providers`). */
  config: WsChangedConfig;
}

/**
 * A workspace provider turns a root directory into a set of packages with
 * dependency edges. Built-ins: `pnpm`, `pgpm`, `glob`. Register your own with
 * {@link registerProvider} — this is the extension point that lets ws-changed
 * describe "which set of packages" you mean for a given question.
 */
export interface WorkspaceProvider {
  /** Unique name, matched against `config.provider`. */
  name: string;
  /** Discover packages under `ctx.root`. */
  discover(ctx: ProviderContext): WorkspacePackage[];
}

/** Per-provider configuration, keyed by provider name under `providers`. */
export interface PnpmProviderConfig {
  /** Which dependency kinds form edges. Default `['prod','dev','peer','optional']`. */
  edgeKinds?: EdgeKind[];
}

export interface GlobProviderConfig {
  /** Directory globs to treat as packages, e.g. `['packages/*']`. */
  globs?: string[];
}

export interface PgpmProviderConfig {
  /** Directory globs under which to look for pgpm modules. Default: pnpm globs, else `['packages/*']`. */
  globs?: string[];
}

/**
 * The ws-changed configuration. Loaded via confstash (`.ws-changedrc`,
 * `ws-changed.config.{ts,js,json}`, or a `ws-changed` key in package.json),
 * overridable per-call and from the CLI.
 */
export interface WsChangedConfig {
  /**
   * Which provider(s) to run. A single name or a list; multiple providers are
   * composed (their package sets unioned, their edges merged). Default `pnpm`.
   */
  provider?: string | string[];
  /** Workspace root. Default: the git repo root, else `cwd`. */
  root?: string;
  /**
   * Paths (glob patterns, relative to root) whose change means "everything is
   * affected" — a lockfile, CI config, the shard planner. When any changed file
   * matches, {@link AffectedResult.global} is `true`.
   */
  global?: string[];
  /** Restrict discovered packages to those whose relDir matches these globs. */
  include?: string[];
  /** Drop discovered packages whose relDir matches these globs. */
  exclude?: string[];
  /** Per-provider options, keyed by provider name. */
  providers?: {
    pnpm?: PnpmProviderConfig;
    glob?: GlobProviderConfig;
    pgpm?: PgpmProviderConfig;
    [name: string]: unknown;
  };
}

/** Why a package ended up in the affected set. */
export interface AffectedReason {
  package: string;
  /** `changed` — a changed file lives in it; `dependent` — it depends on an affected package. */
  kind: 'changed' | 'dependent';
  /** For `changed`: the changed file (relDir). For `dependent`: the package it depends on. */
  via: string;
}

export interface AffectedResult {
  /** All affected package names (changed ∪ transitive dependents), sorted. */
  packages: string[];
  /** Packages directly containing a changed file, sorted. */
  changed: string[];
  /** Changed paths (relDir) owned by no package — root-level changes. */
  rootChanged: string[];
  /** A changed path matched `config.global`; callers should treat all packages as affected. */
  global: boolean;
  /** The global patterns that matched, if any. */
  globalMatches: string[];
  /** Per-package explanation of why it is affected. */
  why: AffectedReason[];
}
