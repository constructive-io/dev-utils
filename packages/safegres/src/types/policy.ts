/**
 * Policy and Rule Types for Safegres
 *
 * These types define the structure of policies and rules
 * that can be compiled to multiple targets.
 */

import type { Effect } from './core';
import type { SafegresCondition } from './conditions';
import type { SafegresObligation } from './obligations';

/**
 * Security layer where a policy applies
 */
export type SecurityLayer = 'postgres' | 'ingress' | 'egress';

/**
 * Target specifies where a policy applies
 */
export interface SafegresTarget {
  /** Security layer */
  layer: SecurityLayer;
  /** Postgres: schema name */
  schema?: string;
  /** Postgres: table name */
  table?: string;
  /** Postgres: operation (SELECT, INSERT, UPDATE, DELETE) */
  operation?: string;
  /** Ingress/egress: host pattern */
  host?: string;
  /** Ingress: path pattern */
  path?: string;
  /** Egress: destination pattern */
  destination?: string;
  /** Kubernetes: namespace */
  namespace?: string;
  /** Kubernetes: service */
  service?: string;
}

/**
 * Rule defines a single access pattern
 */
export interface SafegresRule {
  /** Unique rule name within the policy */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Actors this rule applies to (role names) */
  actors: string[];
  /** Actions/privileges this rule covers */
  actions: string[];
  /** Condition that must be true for the rule to apply */
  condition: SafegresCondition;
  /** Effect when condition is met */
  effect: Effect;
  /** Side effects to apply */
  obligations?: SafegresObligation[];
  /** Whether this is a permissive policy (default: true) */
  permissive?: boolean;
  /** Whether this rule is disabled */
  disabled?: boolean;
  /** Priority for rule ordering (higher = evaluated first) */
  priority?: number;
}

/**
 * Policy is a versioned, composable policy unit
 */
export interface SafegresPolicy {
  /** Unique policy identifier (e.g., "constructive.posts.access") */
  id: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description?: string;
  /** Where this policy applies */
  target: SafegresTarget;
  /** Access rules */
  rules: SafegresRule[];
  /** Tags for organization and filtering */
  tags?: string[];
  /** Whether this policy is disabled */
  disabled?: boolean;
}

/**
 * PolicySet is a collection of related policies
 */
export interface SafegresPolicySet {
  /** Unique identifier */
  id: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description?: string;
  /** Policies in this set */
  policies: SafegresPolicy[];
  /** Tags for organization */
  tags?: string[];
}

/**
 * Compiled policy output for a specific target
 */
export interface CompiledPolicy {
  /** Source policy ID */
  sourceId: string;
  /** Source policy version */
  sourceVersion: string;
  /** Target layer */
  layer: SecurityLayer;
  /** Compilation timestamp */
  compiledAt: string;
  /** Target-specific output */
  output: unknown;
}

/**
 * PostgreSQL-specific compiled output
 */
export interface PostgresCompiledPolicy extends CompiledPolicy {
  layer: 'postgres';
  output: {
    /** CREATE POLICY statements */
    policies: string[];
    /** Supporting functions */
    functions?: string[];
    /** Required extensions */
    extensions?: string[];
  };
}

/**
 * Nginx-specific compiled output
 */
export interface NginxCompiledPolicy extends CompiledPolicy {
  layer: 'ingress';
  output: {
    /** Server block configurations */
    servers?: string[];
    /** Location block configurations */
    locations?: string[];
    /** Upstream configurations */
    upstreams?: string[];
    /** Map configurations */
    maps?: string[];
    /** Rate limit zone configurations */
    limitReqZones?: string[];
  };
}

// ============================================================================
// Builder Functions
// ============================================================================

/**
 * Create a new policy
 */
export function createPolicy(
  id: string,
  version: string,
  target: SafegresTarget,
  rules: SafegresRule[],
  options?: Partial<Omit<SafegresPolicy, 'id' | 'version' | 'target' | 'rules'>>
): SafegresPolicy {
  return {
    id,
    version,
    target,
    rules,
    ...options,
  };
}

/**
 * Create a new rule
 */
export function createRule(
  name: string,
  actors: string[],
  actions: string[],
  condition: SafegresCondition,
  effect: Effect = 'allow',
  options?: Partial<
    Omit<SafegresRule, 'name' | 'actors' | 'actions' | 'condition' | 'effect'>
  >
): SafegresRule {
  return {
    name,
    actors,
    actions,
    condition,
    effect,
    ...options,
  };
}

/**
 * Create a postgres target
 */
export function postgresTarget(
  schema: string,
  table: string,
  operation?: string
): SafegresTarget {
  return {
    layer: 'postgres',
    schema,
    table,
    operation,
  };
}

/**
 * Create an ingress target
 */
export function ingressTarget(
  host?: string,
  path?: string,
  namespace?: string
): SafegresTarget {
  return {
    layer: 'ingress',
    host,
    path,
    namespace,
  };
}

/**
 * Create an egress target
 */
export function egressTarget(
  destination?: string,
  namespace?: string
): SafegresTarget {
  return {
    layer: 'egress',
    destination,
    namespace,
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation error for policies
 */
export interface PolicyValidationError {
  code: string;
  message: string;
  path?: string;
}

/**
 * Validation result for policies
 */
export interface PolicyValidationResult {
  valid: boolean;
  errors: PolicyValidationError[];
  warnings: PolicyValidationError[];
}

/**
 * Validate a policy structure
 */
export function validatePolicy(policy: SafegresPolicy): PolicyValidationResult {
  const errors: PolicyValidationError[] = [];
  const warnings: PolicyValidationError[] = [];

  if (!policy.id || policy.id.trim() === '') {
    errors.push({
      code: 'MISSING_ID',
      message: 'Policy must have an id',
      path: 'id',
    });
  }

  if (!policy.version || policy.version.trim() === '') {
    errors.push({
      code: 'MISSING_VERSION',
      message: 'Policy must have a version',
      path: 'version',
    });
  }

  if (!policy.target) {
    errors.push({
      code: 'MISSING_TARGET',
      message: 'Policy must have a target',
      path: 'target',
    });
  } else if (!policy.target.layer) {
    errors.push({
      code: 'MISSING_LAYER',
      message: 'Policy target must have a layer',
      path: 'target.layer',
    });
  }

  if (!policy.rules || policy.rules.length === 0) {
    warnings.push({
      code: 'NO_RULES',
      message: 'Policy has no rules',
      path: 'rules',
    });
  } else {
    policy.rules.forEach((rule, index) => {
      if (!rule.name || rule.name.trim() === '') {
        errors.push({
          code: 'MISSING_RULE_NAME',
          message: `Rule at index ${index} must have a name`,
          path: `rules[${index}].name`,
        });
      }

      if (!rule.actors || rule.actors.length === 0) {
        errors.push({
          code: 'MISSING_ACTORS',
          message: `Rule "${rule.name}" must have at least one actor`,
          path: `rules[${index}].actors`,
        });
      }

      if (!rule.actions || rule.actions.length === 0) {
        errors.push({
          code: 'MISSING_ACTIONS',
          message: `Rule "${rule.name}" must have at least one action`,
          path: `rules[${index}].actions`,
        });
      }

      if (!rule.condition) {
        errors.push({
          code: 'MISSING_CONDITION',
          message: `Rule "${rule.name}" must have a condition`,
          path: `rules[${index}].condition`,
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
