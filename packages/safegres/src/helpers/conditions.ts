/**
 * Condition Builder Helpers for Safegres
 *
 * Convenient functions for creating condition nodes.
 */

import type {
  SafegresCondition,
  DirectOwner,
  DirectOwnerAny,
  Membership,
  MembershipByField,
  MembershipByJoin,
  OrgHierarchy,
  Temporal,
  Publishable,
  PathMatch,
  HostMatch,
  DestinationMatch,
  NamespaceMatch,
  ServiceMatch,
  FieldEquals,
  FieldEqualsField,
  FieldIn,
  FieldNotNull,
  FieldIsNull,
  BoolExpr,
  MembershipType,
} from '../types/conditions';

// ============================================================================
// Identity Condition Builders
// ============================================================================

/**
 * Create a DirectOwner condition
 */
export function directOwner(entity_field: string): SafegresCondition {
  return { DirectOwner: { entity_field } };
}

/**
 * Create a DirectOwnerAny condition
 */
export function directOwnerAny(entity_fields: string[]): SafegresCondition {
  return { DirectOwnerAny: { entity_fields } };
}

/**
 * Create a Membership condition
 */
export function membership(
  membership_type: MembershipType,
  options?: Partial<Omit<Membership, 'membership_type'>>
): SafegresCondition {
  return { Membership: { membership_type, ...options } };
}

/**
 * Create a MembershipByField condition
 */
export function membershipByField(
  entity_field: string,
  membership_type: MembershipType,
  options?: Partial<Omit<MembershipByField, 'entity_field' | 'membership_type'>>
): SafegresCondition {
  return { MembershipByField: { entity_field, membership_type, ...options } };
}

/**
 * Create a MembershipByJoin condition
 */
export function membershipByJoin(
  entity_field: string,
  membership_type: MembershipType,
  options?: Partial<Omit<MembershipByJoin, 'entity_field' | 'membership_type'>>
): SafegresCondition {
  return { MembershipByJoin: { entity_field, membership_type, ...options } };
}

/**
 * Create an OrgHierarchy condition
 */
export function orgHierarchy(
  direction: 'up' | 'down',
  anchor_field: string,
  options?: Partial<Omit<OrgHierarchy, 'direction' | 'anchor_field'>>
): SafegresCondition {
  return { OrgHierarchy: { direction, anchor_field, ...options } };
}

// ============================================================================
// Temporal Condition Builders
// ============================================================================

/**
 * Create a Temporal condition
 */
export function temporal(options: Temporal): SafegresCondition {
  return { Temporal: options };
}

/**
 * Create a Publishable condition
 */
export function publishable(is_published_field: string): SafegresCondition {
  return { Publishable: { is_published_field } };
}

// ============================================================================
// Resource Condition Builders
// ============================================================================

/**
 * Create a PathMatch condition
 */
export function pathMatch(
  pattern: string,
  method?: string
): SafegresCondition {
  return { PathMatch: { pattern, method } };
}

/**
 * Create a HostMatch condition
 */
export function hostMatch(pattern: string): SafegresCondition {
  return { HostMatch: { pattern } };
}

/**
 * Create a DestinationMatch condition
 */
export function destinationMatch(
  host: string,
  options?: Partial<Omit<DestinationMatch, 'host'>>
): SafegresCondition {
  return { DestinationMatch: { host, ...options } };
}

/**
 * Create a NamespaceMatch condition
 */
export function namespaceMatch(
  pattern: string,
  exact?: boolean
): SafegresCondition {
  return { NamespaceMatch: { pattern, exact } };
}

/**
 * Create a ServiceMatch condition
 */
export function serviceMatch(
  name: string,
  namespace?: string
): SafegresCondition {
  return { ServiceMatch: { name, namespace } };
}

// ============================================================================
// Comparison Condition Builders
// ============================================================================

/**
 * Create a FieldEquals condition
 */
export function fieldEquals(
  field: string,
  value: string | number | boolean
): SafegresCondition {
  return { FieldEquals: { field, value } };
}

/**
 * Create a FieldEqualsField condition
 */
export function fieldEqualsField(
  field: string,
  other_field: string
): SafegresCondition {
  return { FieldEqualsField: { field, other_field } };
}

/**
 * Create a FieldIn condition
 */
export function fieldIn(
  field: string,
  values: (string | number)[]
): SafegresCondition {
  return { FieldIn: { field, values } };
}

/**
 * Create a FieldNotNull condition
 */
export function fieldNotNull(field: string): SafegresCondition {
  return { FieldNotNull: { field } };
}

/**
 * Create a FieldIsNull condition
 */
export function fieldIsNull(field: string): SafegresCondition {
  return { FieldIsNull: { field } };
}

// ============================================================================
// Composition Condition Builders
// ============================================================================

/**
 * Create an AND composition of conditions
 */
export function allOf(...conditions: SafegresCondition[]): SafegresCondition {
  if (conditions.length === 0) return { True: {} };
  if (conditions.length === 1) return conditions[0];
  return { AllOf: conditions };
}

/**
 * Create an OR composition of conditions
 */
export function anyOf(...conditions: SafegresCondition[]): SafegresCondition {
  if (conditions.length === 0) return { False: {} };
  if (conditions.length === 1) return conditions[0];
  return { AnyOf: conditions };
}

/**
 * Create a NOT condition
 */
export function not(condition: SafegresCondition): SafegresCondition {
  return { Not: condition };
}

/**
 * Create a BoolExpr condition
 */
export function boolExpr(
  boolop: 'AND_EXPR' | 'OR_EXPR' | 'NOT_EXPR',
  args: SafegresCondition[]
): SafegresCondition {
  return { BoolExpr: { boolop, args } };
}

// ============================================================================
// Constant Condition Builders
// ============================================================================

/**
 * Create a True condition (always allows)
 */
export function always(): SafegresCondition {
  return { True: {} };
}

/**
 * Create a False condition (always denies)
 */
export function never(): SafegresCondition {
  return { False: {} };
}

// ============================================================================
// Condition Builders Object
// ============================================================================

export const conditions = {
  // Identity
  directOwner,
  directOwnerAny,
  membership,
  membershipByField,
  membershipByJoin,
  orgHierarchy,
  // Temporal
  temporal,
  publishable,
  // Resource
  pathMatch,
  hostMatch,
  destinationMatch,
  namespaceMatch,
  serviceMatch,
  // Comparison
  fieldEquals,
  fieldEqualsField,
  fieldIn,
  fieldNotNull,
  fieldIsNull,
  // Composition
  allOf,
  anyOf,
  not,
  boolExpr,
  // Constants
  always,
  never,
};

export type ConditionBuilders = typeof conditions;
