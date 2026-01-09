/**
 * Safegres Types
 *
 * Unified type system for security policies across postgres, ingress, and egress layers.
 */

// Core types
export type { Effect, Reason, TraceStep, Decision } from './core';

// Condition types
export type {
  DirectOwner,
  DirectOwnerAny,
  Membership,
  MembershipByField,
  MembershipByJoin,
  OrgHierarchy,
  MembershipType,
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
  TrueCondition,
  FalseCondition,
  SafegresCondition,
} from './conditions';

// Condition type guards
export {
  isDirectOwner,
  isDirectOwnerAny,
  isMembership,
  isMembershipByField,
  isMembershipByJoin,
  isOrgHierarchy,
  isTemporal,
  isPublishable,
  isPathMatch,
  isHostMatch,
  isDestinationMatch,
  isNamespaceMatch,
  isServiceMatch,
  isFieldEquals,
  isFieldEqualsField,
  isFieldIn,
  isFieldNotNull,
  isFieldIsNull,
  isBoolExpr,
  isAnyOf,
  isAllOf,
  isNot,
  isTrue,
  isFalse,
  getConditionType,
  getConditionValue,
} from './conditions';

// Obligation types
export type {
  LogObligation,
  MaskObligation,
  RowFilterObligation,
  ColumnMaskObligation,
  AuditObligation,
  SetHeaderObligation,
  RateLimitObligation,
  RewriteObligation,
  RouteObligation,
  CacheObligation,
  CorsObligation,
  ReturnStatusObligation,
  RequireAuthObligation,
  AllowDestinationObligation,
  DenyDestinationObligation,
  ProxyThroughObligation,
  SafegresObligation,
  ObligationKind,
} from './obligations';

// Obligation type guards
export {
  isLogObligation,
  isMaskObligation,
  isRowFilterObligation,
  isColumnMaskObligation,
  isAuditObligation,
  isSetHeaderObligation,
  isRateLimitObligation,
  isRewriteObligation,
  isRouteObligation,
  isCacheObligation,
  isCorsObligation,
  isReturnStatusObligation,
  isRequireAuthObligation,
  isAllowDestinationObligation,
  isDenyDestinationObligation,
  isProxyThroughObligation,
  isPostgresObligation,
  isIngressObligation,
  isEgressObligation,
  isSharedObligation,
} from './obligations';

// Context types
export type {
  SafegresRequest,
  SafegresIdentity,
  SafegresEnvironment,
  SafegresContext,
  SafegresData,
} from './context';

// Context helpers
export { createMinimalContext, createAuthenticatedContext } from './context';

// Policy types
export type {
  SecurityLayer,
  SafegresTarget,
  SafegresRule,
  SafegresPolicy,
  SafegresPolicySet,
  CompiledPolicy,
  PostgresCompiledPolicy,
  NginxCompiledPolicy,
  PolicyValidationError,
  PolicyValidationResult,
} from './policy';

// Policy helpers
export {
  createPolicy,
  createRule,
  postgresTarget,
  ingressTarget,
  egressTarget,
  validatePolicy,
} from './policy';
