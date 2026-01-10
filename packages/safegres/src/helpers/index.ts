/**
 * Safegres Helpers
 *
 * Safe, deterministic helper functions for policy evaluation.
 */

// Match helpers
export { match, exact, iexact, prefix, suffix, contains, glob, regex } from './match';
export type { MatchHelpers } from './match';

// Quantifier helpers
export {
  quantifiers,
  all,
  any,
  none,
  count,
  find,
  filter,
  map,
  first,
  last,
} from './quantifiers';
export type { QuantifierHelpers } from './quantifiers';

// Access helpers
export {
  access,
  get,
  defined,
  empty,
  includes,
  truthy,
  falsy,
  equals,
  coalesce,
} from './access';
export type { AccessHelpers } from './access';

// Condition builders
export {
  conditions,
  directOwner,
  directOwnerAny,
  membership,
  membershipByField,
  membershipByJoin,
  orgHierarchy,
  temporal,
  publishable,
  pathMatch,
  hostMatch,
  destinationMatch,
  namespaceMatch,
  serviceMatch,
  fieldEquals,
  fieldEqualsField,
  fieldIn,
  fieldNotNull,
  fieldIsNull,
  allOf,
  anyOf,
  not,
  boolExpr,
  always,
  never,
} from './conditions';
export type { ConditionBuilders } from './conditions';

// Combined helpers interface
import { match, type MatchHelpers } from './match';
import { quantifiers, type QuantifierHelpers } from './quantifiers';
import { access, type AccessHelpers } from './access';
import { conditions, type ConditionBuilders } from './conditions';

/**
 * Combined policy helpers interface
 */
export interface SafegresHelpers {
  match: MatchHelpers;
  quantifiers: QuantifierHelpers;
  access: AccessHelpers;
  conditions: ConditionBuilders;
  // Shorthand access to common helpers
  all: QuantifierHelpers['all'];
  any: QuantifierHelpers['any'];
  none: QuantifierHelpers['none'];
  count: QuantifierHelpers['count'];
  find: QuantifierHelpers['find'];
  get: AccessHelpers['get'];
  defined: AccessHelpers['defined'];
  empty: AccessHelpers['empty'];
  includes: AccessHelpers['includes'];
}

/**
 * Create the combined helpers object
 */
export function createHelpers(): SafegresHelpers {
  return {
    match,
    quantifiers,
    access,
    conditions,
    // Shorthand
    all: quantifiers.all,
    any: quantifiers.any,
    none: quantifiers.none,
    count: quantifiers.count,
    find: quantifiers.find,
    get: access.get,
    defined: access.defined,
    empty: access.empty,
    includes: access.includes,
  };
}

/**
 * Default helpers instance
 */
export const helpers = createHelpers();
