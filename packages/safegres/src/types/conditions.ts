/**
 * Condition Node Types for Safegres
 *
 * These conditions work across all three security layers:
 * - Postgres (RLS): Compiled to SQL WHERE clauses
 * - Ingress: Evaluated at HTTP request time
 * - Egress: Evaluated for outbound connections
 */

// ============================================================================
// Identity Conditions (Who can access)
// ============================================================================

/**
 * Direct user ID comparison
 * Postgres: owner_id = current_user_id()
 * Ingress: subject = ctx.identity.subject
 */
export interface DirectOwner {
  entity_field: string;
}

/**
 * Multiple ownership fields (OR logic)
 * Postgres: sender_id = current_user_id() OR receiver_id = current_user_id()
 */
export interface DirectOwnerAny {
  entity_fields: string[];
}

/**
 * Role/group membership check
 * Postgres: EXISTS (SELECT 1 FROM sprt WHERE actor_id = current_user_id() AND ...)
 * Ingress: ctx.identity.roles.includes(role)
 */
export interface Membership {
  membership_type: MembershipType;
  permission?: string;
  is_admin?: boolean;
  is_owner?: boolean;
}

/**
 * Scoped membership with entity binding
 * Postgres: entity_id IN (SELECT entity_id FROM sprt WHERE actor_id = current_user_id())
 */
export interface MembershipByField {
  entity_field: string;
  membership_type: MembershipType;
  permission?: string;
  is_admin?: boolean;
  is_owner?: boolean;
}

/**
 * JOIN-based membership through related tables
 */
export interface MembershipByJoin {
  entity_field: string;
  obj_table_id?: string;
  obj_table?: string;
  obj_schema?: string;
  obj_field_id?: string;
  obj_field?: string;
  membership_type: MembershipType;
  permission?: string;
}

/**
 * Hierarchical visibility using closure table
 * Postgres: EXISTS (SELECT 1 FROM hierarchy_sprt WHERE ...)
 */
export interface OrgHierarchy {
  direction: 'up' | 'down';
  entity_field?: string; // Default: 'entity_id'
  anchor_field: string;
  max_depth?: number;
}

/**
 * Membership type can be a string literal or numeric ID
 */
export type MembershipType =
  | 'App Member'
  | 'Organization Member'
  | 'Group Member'
  | 'Team Member'
  | 'Project Member'
  | number;

// ============================================================================
// Temporal Conditions (When access is valid)
// ============================================================================

/**
 * Time-window based access control
 * Postgres: publish_at <= now() AND (expires_at IS NULL OR expires_at > now())
 */
export interface Temporal {
  valid_from_field?: string;
  valid_until_field?: string;
  valid_from_inclusive?: boolean; // Default: true
  valid_until_inclusive?: boolean; // Default: false
}

/**
 * Published content visibility
 */
export interface Publishable {
  is_published_field: string;
}

// ============================================================================
// Resource Conditions (What can be accessed)
// ============================================================================

/**
 * URL path matching (ingress)
 */
export interface PathMatch {
  pattern: string; // Glob or regex
  method?: string; // HTTP method filter
}

/**
 * Host/domain matching (ingress/egress)
 */
export interface HostMatch {
  pattern: string; // Glob pattern (e.g., "*.example.com")
}

/**
 * Egress destination rules
 */
export interface DestinationMatch {
  host: string;
  ports?: number[];
  protocol?: string;
}

/**
 * Namespace matching (Kubernetes/mesh)
 */
export interface NamespaceMatch {
  pattern: string;
  exact?: boolean;
}

/**
 * Service matching (Kubernetes/mesh)
 */
export interface ServiceMatch {
  name: string;
  namespace?: string;
}

// ============================================================================
// Comparison Conditions
// ============================================================================

/**
 * Field comparison with a value
 */
export interface FieldEquals {
  field: string;
  value: string | number | boolean;
}

/**
 * Field comparison with another field
 */
export interface FieldEqualsField {
  field: string;
  other_field: string;
}

/**
 * Field is in a list of values
 */
export interface FieldIn {
  field: string;
  values: (string | number)[];
}

/**
 * Field is not null
 */
export interface FieldNotNull {
  field: string;
}

/**
 * Field is null
 */
export interface FieldIsNull {
  field: string;
}

// ============================================================================
// Composition Conditions
// ============================================================================

/**
 * Boolean expression composition
 */
export interface BoolExpr {
  boolop: 'AND_EXPR' | 'OR_EXPR' | 'NOT_EXPR';
  args: SafegresCondition[];
}

// ============================================================================
// Constant Conditions
// ============================================================================

/**
 * Always true condition
 */
export type TrueCondition = Record<string, never>;

/**
 * Always false condition
 */
export type FalseCondition = Record<string, never>;

// ============================================================================
// Unified Condition Type (Discriminated Union)
// ============================================================================

/**
 * SafegresCondition is a discriminated union of all condition types.
 * Each condition is wrapped in an object with a single key identifying the type.
 */
export type SafegresCondition =
  // Identity conditions
  | { DirectOwner: DirectOwner }
  | { DirectOwnerAny: DirectOwnerAny }
  | { Membership: Membership }
  | { MembershipByField: MembershipByField }
  | { MembershipByJoin: MembershipByJoin }
  | { OrgHierarchy: OrgHierarchy }
  // Temporal conditions
  | { Temporal: Temporal }
  | { Publishable: Publishable }
  // Resource conditions (ingress/egress)
  | { PathMatch: PathMatch }
  | { HostMatch: HostMatch }
  | { DestinationMatch: DestinationMatch }
  | { NamespaceMatch: NamespaceMatch }
  | { ServiceMatch: ServiceMatch }
  // Comparison conditions
  | { FieldEquals: FieldEquals }
  | { FieldEqualsField: FieldEqualsField }
  | { FieldIn: FieldIn }
  | { FieldNotNull: FieldNotNull }
  | { FieldIsNull: FieldIsNull }
  // Composition
  | { BoolExpr: BoolExpr }
  | { AnyOf: SafegresCondition[] }
  | { AllOf: SafegresCondition[] }
  | { Not: SafegresCondition }
  // Constants
  | { True: TrueCondition }
  | { False: FalseCondition };

// ============================================================================
// Type Guards
// ============================================================================

export function isDirectOwner(
  c: SafegresCondition
): c is { DirectOwner: DirectOwner } {
  return 'DirectOwner' in c;
}

export function isDirectOwnerAny(
  c: SafegresCondition
): c is { DirectOwnerAny: DirectOwnerAny } {
  return 'DirectOwnerAny' in c;
}

export function isMembership(
  c: SafegresCondition
): c is { Membership: Membership } {
  return 'Membership' in c;
}

export function isMembershipByField(
  c: SafegresCondition
): c is { MembershipByField: MembershipByField } {
  return 'MembershipByField' in c;
}

export function isMembershipByJoin(
  c: SafegresCondition
): c is { MembershipByJoin: MembershipByJoin } {
  return 'MembershipByJoin' in c;
}

export function isOrgHierarchy(
  c: SafegresCondition
): c is { OrgHierarchy: OrgHierarchy } {
  return 'OrgHierarchy' in c;
}

export function isTemporal(
  c: SafegresCondition
): c is { Temporal: Temporal } {
  return 'Temporal' in c;
}

export function isPublishable(
  c: SafegresCondition
): c is { Publishable: Publishable } {
  return 'Publishable' in c;
}

export function isPathMatch(
  c: SafegresCondition
): c is { PathMatch: PathMatch } {
  return 'PathMatch' in c;
}

export function isHostMatch(
  c: SafegresCondition
): c is { HostMatch: HostMatch } {
  return 'HostMatch' in c;
}

export function isDestinationMatch(
  c: SafegresCondition
): c is { DestinationMatch: DestinationMatch } {
  return 'DestinationMatch' in c;
}

export function isNamespaceMatch(
  c: SafegresCondition
): c is { NamespaceMatch: NamespaceMatch } {
  return 'NamespaceMatch' in c;
}

export function isServiceMatch(
  c: SafegresCondition
): c is { ServiceMatch: ServiceMatch } {
  return 'ServiceMatch' in c;
}

export function isFieldEquals(
  c: SafegresCondition
): c is { FieldEquals: FieldEquals } {
  return 'FieldEquals' in c;
}

export function isFieldEqualsField(
  c: SafegresCondition
): c is { FieldEqualsField: FieldEqualsField } {
  return 'FieldEqualsField' in c;
}

export function isFieldIn(c: SafegresCondition): c is { FieldIn: FieldIn } {
  return 'FieldIn' in c;
}

export function isFieldNotNull(
  c: SafegresCondition
): c is { FieldNotNull: FieldNotNull } {
  return 'FieldNotNull' in c;
}

export function isFieldIsNull(
  c: SafegresCondition
): c is { FieldIsNull: FieldIsNull } {
  return 'FieldIsNull' in c;
}

export function isBoolExpr(
  c: SafegresCondition
): c is { BoolExpr: BoolExpr } {
  return 'BoolExpr' in c;
}

export function isAnyOf(
  c: SafegresCondition
): c is { AnyOf: SafegresCondition[] } {
  return 'AnyOf' in c;
}

export function isAllOf(
  c: SafegresCondition
): c is { AllOf: SafegresCondition[] } {
  return 'AllOf' in c;
}

export function isNot(c: SafegresCondition): c is { Not: SafegresCondition } {
  return 'Not' in c;
}

export function isTrue(
  c: SafegresCondition
): c is { True: TrueCondition } {
  return 'True' in c;
}

export function isFalse(
  c: SafegresCondition
): c is { False: FalseCondition } {
  return 'False' in c;
}

/**
 * Get the condition type key from a SafegresCondition
 */
export function getConditionType(c: SafegresCondition): string {
  return Object.keys(c)[0];
}

/**
 * Get the condition value from a SafegresCondition
 */
export function getConditionValue<T>(c: SafegresCondition): T {
  const key = Object.keys(c)[0];
  return (c as Record<string, T>)[key];
}
