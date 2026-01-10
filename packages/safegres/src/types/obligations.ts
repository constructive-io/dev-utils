/**
 * Obligation Types for Safegres
 *
 * Obligations are side effects applied after a policy decision.
 * They are layer-specific but follow a consistent structure.
 */

// ============================================================================
// Shared Obligations (work across all layers)
// ============================================================================

/**
 * Log an event
 */
export interface LogObligation {
  kind: 'log';
  args: {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    fields?: Record<string, unknown>;
  };
}

/**
 * Mask sensitive data
 */
export interface MaskObligation {
  kind: 'mask';
  args: {
    fields: string[];
    strategy: 'redact' | 'hash' | 'partial' | 'tokenize';
  };
}

// ============================================================================
// Postgres-specific Obligations
// ============================================================================

/**
 * Apply additional row filter (beyond the policy condition)
 */
export interface RowFilterObligation {
  kind: 'rowFilter';
  args: {
    expression: string;
  };
}

/**
 * Mask a column value in query results
 */
export interface ColumnMaskObligation {
  kind: 'columnMask';
  args: {
    column: string;
    mask: string; // SQL expression for masking
  };
}

/**
 * Record an audit log entry
 */
export interface AuditObligation {
  kind: 'audit';
  args: {
    action: string;
    table: string;
    fields?: string[];
  };
}

// ============================================================================
// Ingress-specific Obligations
// ============================================================================

/**
 * Set a response or proxy header
 */
export interface SetHeaderObligation {
  kind: 'setHeader';
  args: {
    name: string;
    value: string;
    type?: 'response' | 'proxy' | 'request';
  };
}

/**
 * Apply rate limiting
 */
export interface RateLimitObligation {
  kind: 'rateLimit';
  args: {
    zone: string;
    rate: string; // e.g., "10r/s", "100r/m"
    burst?: number;
    nodelay?: boolean;
  };
}

/**
 * Rewrite the request URL
 */
export interface RewriteObligation {
  kind: 'rewrite';
  args: {
    pattern: string;
    replacement: string;
    flags?: ('last' | 'break' | 'redirect' | 'permanent')[];
  };
}

/**
 * Route to a specific upstream
 */
export interface RouteObligation {
  kind: 'route';
  args: {
    upstream: string;
    weight?: number;
    backup?: boolean;
  };
}

/**
 * Enable caching
 */
export interface CacheObligation {
  kind: 'cache';
  args: {
    ttl: number; // seconds
    key?: string;
    zone?: string;
    bypass?: string[];
  };
}

/**
 * Configure CORS headers
 */
export interface CorsObligation {
  kind: 'cors';
  args: {
    origins: string[];
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
    maxAge?: number;
  };
}

/**
 * Return a specific HTTP status
 */
export interface ReturnStatusObligation {
  kind: 'returnStatus';
  args: {
    status: number;
    body?: string;
  };
}

/**
 * Add authentication requirement
 */
export interface RequireAuthObligation {
  kind: 'requireAuth';
  args: {
    realm?: string;
    type?: 'basic' | 'bearer' | 'jwt';
  };
}

// ============================================================================
// Egress-specific Obligations
// ============================================================================

/**
 * Allow a destination
 */
export interface AllowDestinationObligation {
  kind: 'allowDestination';
  args: {
    host: string;
    ports?: number[];
    protocol?: string;
  };
}

/**
 * Deny a destination with reason
 */
export interface DenyDestinationObligation {
  kind: 'denyDestination';
  args: {
    host: string;
    reason?: string;
  };
}

/**
 * Proxy through a specific endpoint
 */
export interface ProxyThroughObligation {
  kind: 'proxyThrough';
  args: {
    proxy: string;
    auth?: string;
  };
}

// ============================================================================
// Unified Obligation Type
// ============================================================================

/**
 * SafegresObligation is a union of all obligation types
 */
export type SafegresObligation =
  // Shared
  | LogObligation
  | MaskObligation
  // Postgres-specific
  | RowFilterObligation
  | ColumnMaskObligation
  | AuditObligation
  // Ingress-specific
  | SetHeaderObligation
  | RateLimitObligation
  | RewriteObligation
  | RouteObligation
  | CacheObligation
  | CorsObligation
  | ReturnStatusObligation
  | RequireAuthObligation
  // Egress-specific
  | AllowDestinationObligation
  | DenyDestinationObligation
  | ProxyThroughObligation;

/**
 * Obligation kind type for type-safe kind checking
 */
export type ObligationKind = SafegresObligation['kind'];

// ============================================================================
// Type Guards
// ============================================================================

export function isLogObligation(o: SafegresObligation): o is LogObligation {
  return o.kind === 'log';
}

export function isMaskObligation(o: SafegresObligation): o is MaskObligation {
  return o.kind === 'mask';
}

export function isRowFilterObligation(
  o: SafegresObligation
): o is RowFilterObligation {
  return o.kind === 'rowFilter';
}

export function isColumnMaskObligation(
  o: SafegresObligation
): o is ColumnMaskObligation {
  return o.kind === 'columnMask';
}

export function isAuditObligation(
  o: SafegresObligation
): o is AuditObligation {
  return o.kind === 'audit';
}

export function isSetHeaderObligation(
  o: SafegresObligation
): o is SetHeaderObligation {
  return o.kind === 'setHeader';
}

export function isRateLimitObligation(
  o: SafegresObligation
): o is RateLimitObligation {
  return o.kind === 'rateLimit';
}

export function isRewriteObligation(
  o: SafegresObligation
): o is RewriteObligation {
  return o.kind === 'rewrite';
}

export function isRouteObligation(
  o: SafegresObligation
): o is RouteObligation {
  return o.kind === 'route';
}

export function isCacheObligation(
  o: SafegresObligation
): o is CacheObligation {
  return o.kind === 'cache';
}

export function isCorsObligation(o: SafegresObligation): o is CorsObligation {
  return o.kind === 'cors';
}

export function isReturnStatusObligation(
  o: SafegresObligation
): o is ReturnStatusObligation {
  return o.kind === 'returnStatus';
}

export function isRequireAuthObligation(
  o: SafegresObligation
): o is RequireAuthObligation {
  return o.kind === 'requireAuth';
}

export function isAllowDestinationObligation(
  o: SafegresObligation
): o is AllowDestinationObligation {
  return o.kind === 'allowDestination';
}

export function isDenyDestinationObligation(
  o: SafegresObligation
): o is DenyDestinationObligation {
  return o.kind === 'denyDestination';
}

export function isProxyThroughObligation(
  o: SafegresObligation
): o is ProxyThroughObligation {
  return o.kind === 'proxyThrough';
}

/**
 * Check if an obligation is postgres-specific
 */
export function isPostgresObligation(o: SafegresObligation): boolean {
  return ['rowFilter', 'columnMask', 'audit'].includes(o.kind);
}

/**
 * Check if an obligation is ingress-specific
 */
export function isIngressObligation(o: SafegresObligation): boolean {
  return [
    'setHeader',
    'rateLimit',
    'rewrite',
    'route',
    'cache',
    'cors',
    'returnStatus',
    'requireAuth',
  ].includes(o.kind);
}

/**
 * Check if an obligation is egress-specific
 */
export function isEgressObligation(o: SafegresObligation): boolean {
  return ['allowDestination', 'denyDestination', 'proxyThrough'].includes(
    o.kind
  );
}

/**
 * Check if an obligation is shared across layers
 */
export function isSharedObligation(o: SafegresObligation): boolean {
  return ['log', 'mask'].includes(o.kind);
}
