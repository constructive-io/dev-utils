/**
 * Position represents a line and column in the source text.
 */
export interface Position {
  line: number;
  column: number;
  offset: number;
}

/**
 * Range represents a span in the source text.
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * Base node type for all AST nodes.
 */
export interface BaseNode {
  type: string;
  /** Optional source location. Named `loc` (not `range`) to avoid colliding with
   *  the semantic `range` duration field on matrix selectors / subqueries. */
  loc?: Range;
}

/** Label matcher operators. */
export type MatchOp = '=' | '!=' | '=~' | '!~';

/** Binary operators, in PromQL surface syntax. */
export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '^'
  | '=='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'and'
  | 'or'
  | 'unless'
  | 'atan2';

/** Aggregation operators. */
export type AggregateOp =
  | 'sum'
  | 'min'
  | 'max'
  | 'avg'
  | 'group'
  | 'stddev'
  | 'stdvar'
  | 'count'
  | 'count_values'
  | 'bottomk'
  | 'topk'
  | 'quantile'
  | 'limitk'
  | 'limit_ratio';

/**
 * The `@` modifier: an absolute evaluation timestamp, or `start()` / `end()`.
 */
export type AtModifier = { kind: 'timestamp'; value: number } | { kind: 'start' } | { kind: 'end' };

/**
 * A single label matcher inside a vector selector, e.g. `job="api"`.
 */
export interface LabelMatcher {
  name: string;
  op: MatchOp;
  value: string;
}

/**
 * Vector matching clause for binary operators:
 * `on(...) / ignoring(...)` plus optional `group_left(...) / group_right(...)`.
 */
export interface VectorMatching {
  on?: string[];
  ignoring?: string[];
  groupLeft?: string[];
  groupRight?: string[];
}

/** A numeric literal (supports `Inf`, `+Inf`, `-Inf`, `NaN`). */
export interface NumberLiteral extends BaseNode {
  type: 'NumberLiteral';
  value: number;
}

/** A string literal. `value` is the unquoted, unescaped content. */
export interface StringLiteral extends BaseNode {
  type: 'StringLiteral';
  value: string;
}

/**
 * An instant vector selector, e.g. `http_requests_total{job="api"} offset 5m`.
 * `name` is the metric name (may also be encoded as a `__name__` matcher).
 */
export interface VectorSelector extends BaseNode {
  type: 'VectorSelector';
  name?: string;
  matchers: LabelMatcher[];
  offset?: string;
  at?: AtModifier;
}

/**
 * A range vector selector, e.g. `rate(x[5m])`'s `x[5m]`. The range window is a
 * PromQL duration string (e.g. `5m`, `1h30m`).
 */
export interface MatrixSelector extends BaseNode {
  type: 'MatrixSelector';
  vectorSelector: VectorSelector;
  range: string;
  offset?: string;
  at?: AtModifier;
}

/**
 * A subquery, e.g. `rate(x[5m])[1h:1m]`. `step` is optional (default step).
 */
export interface SubqueryExpr extends BaseNode {
  type: 'SubqueryExpr';
  expr: Expr;
  range: string;
  step?: string;
  offset?: string;
  at?: AtModifier;
}

/** A parenthesized expression. */
export interface ParenExpr extends BaseNode {
  type: 'ParenExpr';
  expr: Expr;
}

/** A unary expression (`-x`, `+x`). */
export interface UnaryExpr extends BaseNode {
  type: 'UnaryExpr';
  op: '+' | '-';
  expr: Expr;
}

/** A binary expression with optional vector matching and `bool` modifier. */
export interface BinaryExpr extends BaseNode {
  type: 'BinaryExpr';
  op: BinaryOp;
  lhs: Expr;
  rhs: Expr;
  matching?: VectorMatching;
  bool?: boolean;
}

/** An aggregation, e.g. `sum by (job) (rate(x[5m]))` or `topk(3, x)`. */
export interface AggregateExpr extends BaseNode {
  type: 'AggregateExpr';
  op: AggregateOp;
  expr: Expr;
  /** Leading parameter for `topk`/`bottomk`/`quantile`/`count_values`/`limitk`/`limit_ratio`. */
  param?: Expr;
  grouping?: { modifier: 'by' | 'without'; labels: string[] };
}

/** A function call, e.g. `rate(x[5m])`, `histogram_quantile(0.9, x)`. */
export interface Call extends BaseNode {
  type: 'Call';
  func: string;
  args: Expr[];
}

/** Any PromQL expression node. */
export type Expr =
  | NumberLiteral
  | StringLiteral
  | VectorSelector
  | MatrixSelector
  | SubqueryExpr
  | ParenExpr
  | UnaryExpr
  | BinaryExpr
  | AggregateExpr
  | Call;

/** Union of every AST node (used by tree utilities). */
export type AstNode = Expr | LabelMatcher;
