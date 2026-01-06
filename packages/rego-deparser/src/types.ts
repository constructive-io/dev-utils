/**
 * Rego AST Types - TypeScript definitions for OPA's Rego Abstract Syntax Tree
 *
 * These types represent the JSON AST structure produced by OPA's parser.
 * The AST can be obtained via:
 * - OPA's REST API: POST /v1/compile
 * - OPA's rego.parse_module builtin
 * - OPA CLI: opa parse --format json
 *
 * Reference: https://pkg.go.dev/github.com/open-policy-agent/opa/ast
 */

/**
 * Location information for AST nodes
 */
export interface Location {
  file?: string;
  row?: number;
  col?: number;
  text?: string;
}

/**
 * A Rego module (policy file)
 */
export interface Module {
  package?: Package;
  imports?: Import[];
  rules?: Rule[];
  comments?: Comment[];
}

/**
 * Package declaration: package foo.bar
 */
export interface Package {
  location?: Location;
  path?: Term[];
}

/**
 * Import statement: import data.foo.bar as baz
 */
export interface Import {
  location?: Location;
  path?: Term;
  alias?: string;
}

/**
 * A Rego rule
 */
export interface Rule {
  location?: Location;
  annotations?: Annotations[];
  default?: boolean;
  head?: Head;
  body?: Body;
  else?: Else;
}

/**
 * Rule annotations (METADATA comments)
 */
export interface Annotations {
  scope?: string;
  title?: string;
  description?: string;
  authors?: Author[];
  organizations?: string[];
  related_resources?: RelatedResource[];
  schemas?: SchemaAnnotation[];
  custom?: Record<string, unknown>;
}

export interface Author {
  name?: string;
  email?: string;
}

export interface RelatedResource {
  ref?: string;
  description?: string;
}

export interface SchemaAnnotation {
  path?: Term[];
  schema?: unknown;
  definition?: unknown;
}

/**
 * Rule head: name[key] = value { ... } or name { ... } or name if { ... }
 */
export interface Head {
  location?: Location;
  name?: string;
  ref?: Term[];
  key?: Term;
  value?: Term;
  assign?: boolean;
}

/**
 * Rule body - array of expressions
 */
export type Body = Expr[];

/**
 * Else clause for rules
 */
export interface Else {
  location?: Location;
  value?: Term;
  body?: Body;
  else?: Else;
}

/**
 * An expression in a rule body
 */
export interface Expr {
  location?: Location;
  index?: number;
  generated?: boolean;
  negated?: boolean;
  terms?: Term | Term[];
  with?: With[];
}

/**
 * With modifier: with input as {...}
 */
export interface With {
  location?: Location;
  target?: Term;
  value?: Term;
}

/**
 * A term in an expression
 */
export interface Term {
  location?: Location;
  type?: string;
  value?: TermValue;
}

/**
 * Possible term values
 */
export type TermValue =
  | null
  | boolean
  | number
  | string
  | Ref
  | Var
  | Call
  | ArrayValue
  | SetValue
  | ObjectValue
  | ArrayComprehension
  | SetComprehension
  | ObjectComprehension
  | Every;

/**
 * Reference: data.foo.bar[x]
 */
export type Ref = Term[];

/**
 * Variable: x
 */
export type Var = string;

/**
 * Function/rule call: func(arg1, arg2)
 */
export type Call = Term[];

/**
 * Array literal: [1, 2, 3]
 */
export type ArrayValue = Term[];

/**
 * Set literal: {1, 2, 3}
 */
export type SetValue = Term[];

/**
 * Object literal: {"key": "value"}
 */
export type ObjectValue = ObjectItem[];

export interface ObjectItem {
  key?: Term;
  value?: Term;
}

/**
 * Array comprehension: [x | x := arr[_]]
 */
export interface ArrayComprehension {
  location?: Location;
  term?: Term;
  body?: Body;
}

/**
 * Set comprehension: {x | x := arr[_]}
 */
export interface SetComprehension {
  location?: Location;
  term?: Term;
  body?: Body;
}

/**
 * Object comprehension: {k: v | some k, v; obj[k] = v}
 */
export interface ObjectComprehension {
  location?: Location;
  key?: Term;
  value?: Term;
  body?: Body;
}

/**
 * Every expression: every x in arr { ... }
 */
export interface Every {
  location?: Location;
  key?: Term;
  value?: Term;
  domain?: Term;
  body?: Body;
}

/**
 * Comment in the source
 */
export interface Comment {
  location?: Location;
  text?: string;
}

/**
 * Term type constants
 */
export const TermType = {
  NULL: 'null',
  BOOLEAN: 'boolean',
  NUMBER: 'number',
  STRING: 'string',
  VAR: 'var',
  REF: 'ref',
  CALL: 'call',
  ARRAY: 'array',
  SET: 'set',
  OBJECT: 'object',
  ARRAY_COMPREHENSION: 'arraycomprehension',
  SET_COMPREHENSION: 'setcomprehension',
  OBJECT_COMPREHENSION: 'objectcomprehension'
} as const;

export type TermTypeValue = (typeof TermType)[keyof typeof TermType];

/**
 * Built-in operators in Rego
 */
export const Operators = {
  // Comparison
  EQUAL: 'equal',
  NOT_EQUAL: 'neq',
  LESS_THAN: 'lt',
  LESS_THAN_EQ: 'lte',
  GREATER_THAN: 'gt',
  GREATER_THAN_EQ: 'gte',

  // Arithmetic
  PLUS: 'plus',
  MINUS: 'minus',
  MUL: 'mul',
  DIV: 'div',
  REM: 'rem',

  // Logical
  AND: 'and',
  OR: 'or',

  // Assignment
  ASSIGN: 'assign',
  UNIFY: 'eq',

  // Membership
  INTERNAL_MEMBER_2: 'internal.member_2',
  INTERNAL_MEMBER_3: 'internal.member_3'
} as const;

/**
 * Infix operator symbols for deparsing
 */
export const InfixOperators: Record<string, string> = {
  equal: '==',
  neq: '!=',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
  plus: '+',
  minus: '-',
  mul: '*',
  div: '/',
  rem: '%',
  and: '&',
  or: '|',
  assign: ':=',
  eq: '='
};

/**
 * Operator precedence for correct parenthesization
 */
export const Precedence = {
  OR: 1,
  AND: 2,
  UNIFY: 3,
  COMPARISON: 4,
  ADDITION: 5,
  MULTIPLICATION: 6,
  UNARY: 7,
  CALL: 8,
  REF: 9,
  PRIMARY: 10
} as const;
