/**
 * Context Types for Safegres
 *
 * These types define the runtime context available during policy evaluation.
 */

/**
 * Request information available during policy evaluation
 */
export interface SafegresRequest {
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
 * Identity information available during policy evaluation
 */
export interface SafegresIdentity {
  /** User or service principal identifier */
  subject: string;
  /** Assigned roles */
  roles?: string[];
  /** Group memberships */
  groups?: string[];
  /** JWT claims or other identity attributes */
  claims?: Record<string, unknown>;
  /** Postgres-specific: current user ID from JWT */
  user_id?: string;
  /** Postgres-specific: current database ID */
  database_id?: string;
  /** Postgres-specific: current app ID */
  app_id?: string;
  /** Postgres-specific: current organization ID */
  org_id?: string;
}

/**
 * Environment information available during policy evaluation
 */
export interface SafegresEnvironment {
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
 * Complete context for policy evaluation
 */
export interface SafegresContext {
  request: SafegresRequest;
  identity: SafegresIdentity;
  env: SafegresEnvironment;
}

/**
 * Static data available during policy evaluation
 * This includes facts, configurations, and cached data
 */
export interface SafegresData {
  /** Namespace to group bindings */
  nsBindings?: Record<string, { groups: string[]; roles?: string[] }>;
  /** Egress allowlist per namespace */
  egressAllow?: Record<string, Array<{ host: string; ports?: number[] }>>;
  /** RBAC role definitions */
  rbac?: Record<string, { allowOps: string[] }>;
  /** Rate limit configurations */
  rateLimits?: Record<string, { rate: string; burst?: number }>;
  /** SPRT (Security Predicate Resolution Table) data */
  sprt?: {
    memberships?: Array<{
      actor_id: string;
      entity_id: string;
      membership_type: string | number;
      permission_mask?: number;
      is_admin?: boolean;
      is_owner?: boolean;
    }>;
    hierarchy?: Array<{
      ancestor_id: string;
      descendant_id: string;
      depth: number;
    }>;
  };
  /** Allow arbitrary additional data */
  [key: string]: unknown;
}

/**
 * Create a minimal context for testing
 */
export function createMinimalContext(
  overrides?: Partial<SafegresContext>
): SafegresContext {
  return {
    request: {
      id: 'test-request',
      time: new Date().toISOString(),
      ...overrides?.request,
    },
    identity: {
      subject: 'anonymous',
      ...overrides?.identity,
    },
    env: {
      stage: 'dev',
      ...overrides?.env,
    },
  };
}

/**
 * Create an authenticated context for testing
 */
export function createAuthenticatedContext(
  userId: string,
  roles: string[] = ['authenticated'],
  overrides?: Partial<SafegresContext>
): SafegresContext {
  return {
    request: {
      id: 'test-request',
      time: new Date().toISOString(),
      ...overrides?.request,
    },
    identity: {
      subject: userId,
      user_id: userId,
      roles,
      ...overrides?.identity,
    },
    env: {
      stage: 'dev',
      ...overrides?.env,
    },
  };
}
