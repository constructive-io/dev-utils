/**
 * Effect represents the outcome of a policy decision
 */
export type Effect = 'allow' | 'deny';

/**
 * Reason explains why a decision was made
 */
export interface Reason {
  /** Stable identifier for analytics and programmatic handling */
  code: string;
  /** Human-readable explanation */
  message: string;
  /** Optional path to the relevant context field (e.g., "request.path") */
  path?: string;
  /** Optional metadata for debugging */
  meta?: Record<string, unknown>;
}

/**
 * Obligation represents a side effect to apply after the decision
 * These map to Nginx directives when compiled
 */
export interface Obligation {
  kind:
    | 'setHeader'
    | 'rateLimit'
    | 'rewrite'
    | 'log'
    | 'mask'
    | 'route'
    | 'cache'
    | 'cors';
  args: Record<string, unknown>;
}

/**
 * TraceStep records a step in policy evaluation for debugging
 */
export interface TraceStep {
  step: string;
  ok: boolean;
  meta?: unknown;
}

/**
 * Decision is the result of policy evaluation
 */
export interface Decision {
  effect: Effect;
  reasons: Reason[];
  obligations?: Obligation[];
  /** Optional trace for debugging (can be disabled in production) */
  trace?: TraceStep[];
}

/**
 * RequestContext contains information about the incoming request
 */
export interface RequestContext {
  /** Unique request identifier */
  id: string;
  /** Request timestamp in ISO format */
  time: string;
  /** Client IP address */
  ip?: string;
  /** HTTP method (GET, POST, etc.) */
  method?: string;
  /** Request host */
  host?: string;
  /** Request path */
  path?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Query parameters */
  query?: Record<string, string>;
  /** Request body (parsed) */
  body?: unknown;
  /** Kubernetes/mesh namespace */
  namespace?: string;
  /** Service name */
  service?: string;
  /** Operation being performed (e.g., "connect", "query", "deploy") */
  operation?: string;
  /** Destination for egress policies */
  destination?: {
    host: string;
    port?: number;
    protocol?: string;
  };
}

/**
 * IdentityContext contains information about the authenticated identity
 */
export interface IdentityContext {
  /** User or service principal identifier */
  subject: string;
  /** Assigned roles */
  roles?: string[];
  /** Group memberships */
  groups?: string[];
  /** JWT claims or other identity attributes */
  claims?: Record<string, unknown>;
}

/**
 * EnvironmentContext contains deployment environment information
 */
export interface EnvironmentContext {
  /** Tenant identifier for multi-tenant systems */
  tenantId?: string;
  /** Cluster name */
  cluster?: string;
  /** Region */
  region?: string;
  /** Deployment stage */
  stage?: 'dev' | 'staging' | 'prod';
  /** Additional environment variables */
  vars?: Record<string, string>;
}

/**
 * PolicyContext is the complete context passed to policy evaluation
 */
export interface PolicyContext {
  request: RequestContext;
  identity: IdentityContext;
  env: EnvironmentContext;
}

/**
 * PolicyData contains static configuration and facts for policy evaluation
 */
export interface PolicyData {
  /** Namespace to group bindings */
  nsBindings?: Record<string, { groups: string[]; roles?: string[] }>;
  /** Egress allowlist per namespace */
  egressAllow?: Record<string, Array<{ host: string; ports?: number[] }>>;
  /** RBAC role definitions */
  rbac?: Record<string, { allowOps: string[] }>;
  /** Rate limit configurations */
  rateLimits?: Record<string, { rate: string; burst?: number }>;
  /** Allow arbitrary additional data */
  [key: string]: unknown;
}

/**
 * MatchHelpers provides safe string matching operations
 */
export interface MatchHelpers {
  /** Exact string equality (case-sensitive) */
  exact(a?: string, b?: string): boolean;
  /** Check if value starts with prefix */
  prefix(value: string | undefined, prefix: string): boolean;
  /** Check if value ends with suffix */
  suffix(value: string | undefined, suffix: string): boolean;
  /** Simple glob matching (supports * and ?) */
  glob(value: string | undefined, pattern: string): boolean;
  /** Safe regex matching (with timeout protection) */
  regex(value: string | undefined, pattern: string): boolean;
  /** Case-insensitive exact match */
  iexact(a?: string, b?: string): boolean;
}

/**
 * PolicyHelpers provides safe, deterministic operations for policy evaluation
 */
export interface PolicyHelpers {
  /** Check if all items satisfy the predicate */
  all<T>(items: readonly T[], pred: (x: T) => boolean): boolean;
  /** Check if any item satisfies the predicate */
  any<T>(items: readonly T[], pred: (x: T) => boolean): boolean;
  /** Check if no items satisfy the predicate */
  none<T>(items: readonly T[], pred: (x: T) => boolean): boolean;
  /** Count items that satisfy the predicate */
  count<T>(items: readonly T[], pred: (x: T) => boolean): number;
  /** Find first item that satisfies the predicate */
  find<T>(items: readonly T[], pred: (x: T) => boolean): T | undefined;
  /** String matching helpers */
  match: MatchHelpers;
  /** Safe property access that never throws */
  get<T>(obj: unknown, path: string, fallback: T): T;
  /** Check if a value is defined (not null or undefined) */
  defined(value: unknown): boolean;
  /** Check if an array or string is empty */
  empty(value: unknown[] | string | undefined | null): boolean;
  /** Check if a value is in a list */
  includes<T>(list: readonly T[], value: T): boolean;
}

/**
 * Policy is the core evaluation function type
 */
export type Policy = (
  ctx: PolicyContext,
  data: PolicyData,
  h: PolicyHelpers
) => Decision;

/**
 * PolicyExpects declares the inputs a policy requires
 */
export interface PolicyExpects {
  /** Required data fields */
  data?: string[];
  /** Required identity claims */
  claims?: string[];
  /** Required request fields */
  request?: string[];
  /** Required environment fields */
  env?: string[];
}

/**
 * PolicyModule is a versioned, composable policy unit
 */
export interface PolicyModule {
  /** Unique policy identifier (e.g., "constructive.k8s.namespace.bind") */
  id: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description?: string;
  /** Declared input requirements for validation */
  expects?: PolicyExpects;
  /** The policy evaluation function */
  evaluate: Policy;
}

/**
 * EvaluateOptions configures policy evaluation
 */
export interface EvaluateOptions {
  /** Enable trace/explain mode for debugging */
  explain?: boolean;
  /** Maximum execution time in milliseconds */
  maxTimeMs?: number;
  /** Override module ID for logging */
  moduleId?: string;
  /** Freeze context and data objects */
  freeze?: boolean;
}

/**
 * EvaluationResult wraps a Decision with metadata
 */
export interface EvaluationResult {
  decision: Decision;
  moduleId: string;
  moduleVersion: string;
  evaluatedAt: string;
  durationMs: number;
}

/**
 * ValidationError represents a policy validation failure
 */
export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

/**
 * ValidationResult is the result of policy module validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
