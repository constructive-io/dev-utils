import type {
  AggregateExpr,
  AggregateOp,
  AtModifier,
  BinaryExpr,
  BinaryOp,
  Call,
  Expr,
  LabelMatcher,
  MatchOp,
  MatrixSelector,
  NumberLiteral,
  ParenExpr,
  StringLiteral,
  SubqueryExpr,
  UnaryExpr,
  VectorMatching,
  VectorSelector,
} from './types';

export type Grouping = { modifier: 'by' | 'without'; labels: string[] };
export type MatchersInput = LabelMatcher[] | Record<string, string>;

function toMatchers(input?: MatchersInput): LabelMatcher[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return Object.entries(input).map(([name, value]) => ({ name, op: '=' as MatchOp, value }));
}

/** Number literal. */
export function num(value: number): NumberLiteral {
  return { type: 'NumberLiteral', value };
}

/** String literal. */
export function str(value: string): StringLiteral {
  return { type: 'StringLiteral', value };
}

/** A label matcher, e.g. `eq('job', 'api')` → `job="api"`. */
export function eq(name: string, value: string): LabelMatcher {
  return { name, op: '=', value };
}
export function neq(name: string, value: string): LabelMatcher {
  return { name, op: '!=', value };
}
export function re(name: string, value: string): LabelMatcher {
  return { name, op: '=~', value };
}
export function nre(name: string, value: string): LabelMatcher {
  return { name, op: '!~', value };
}

/**
 * A PromQL duration string (e.g. `5m`, `1h30m`, `500ms`). Produced by the
 * duration builders so callers never assemble the syntax by hand.
 */
export type Duration = string & { readonly __promqlDuration?: unique symbol };

/** Compose a PromQL duration from unit components, e.g. `duration({ h: 1, m: 30 })` → `1h30m`. */
export function duration(parts: {
  y?: number;
  w?: number;
  d?: number;
  h?: number;
  m?: number;
  s?: number;
  ms?: number;
}): Duration {
  const order: Array<[keyof typeof parts, string]> = [
    ['y', 'y'],
    ['w', 'w'],
    ['d', 'd'],
    ['h', 'h'],
    ['m', 'm'],
    ['s', 's'],
    ['ms', 'ms'],
  ];
  const out = order
    .filter(([k]) => parts[k] != null)
    .map(([k, unit]) => `${parts[k]}${unit}`)
    .join('');
  if (out === '') throw new Error('duration() requires at least one non-null unit');
  return out as Duration;
}

export const milliseconds = (n: number): Duration => duration({ ms: n });
export const seconds = (n: number): Duration => duration({ s: n });
export const minutes = (n: number): Duration => duration({ m: n });
export const hours = (n: number): Duration => duration({ h: n });
export const days = (n: number): Duration => duration({ d: n });
export const weeks = (n: number): Duration => duration({ w: n });
export const years = (n: number): Duration => duration({ y: n });

/** Instant vector selector with a metric name, e.g. `metric('up', { job: 'api' })`. */
export function metric(name: string, matchers?: MatchersInput): VectorSelector {
  return { type: 'VectorSelector', name, matchers: toMatchers(matchers) };
}

/** Instant vector selector without a metric name, e.g. `selector({ __name__: 'up' })`. */
export function selector(matchers: MatchersInput): VectorSelector {
  return { type: 'VectorSelector', matchers: toMatchers(matchers) };
}

/** Range vector, e.g. `range(metric('x'), minutes(5))` → `x[5m]`. */
export function range(vectorSelector: VectorSelector, window: Duration): MatrixSelector {
  return { type: 'MatrixSelector', vectorSelector, range: window };
}

/** Subquery, e.g. `subquery(rate(range(metric('x'), minutes(5))), hours(1), minutes(1))`. */
export function subquery(expr: Expr, window: Duration, step?: Duration): SubqueryExpr {
  return { type: 'SubqueryExpr', expr, range: window, ...(step ? { step } : {}) };
}

/** Parenthesized expression. */
export function paren(expr: Expr): ParenExpr {
  return { type: 'ParenExpr', expr };
}

/** Unary negation / plus. */
export function neg(expr: Expr): UnaryExpr {
  return { type: 'UnaryExpr', op: '-', expr };
}
export function pos(expr: Expr): UnaryExpr {
  return { type: 'UnaryExpr', op: '+', expr };
}

/** Attach an `offset` modifier, e.g. `offset(sel, minutes(5))` (accepts signed durations). */
export function offset<T extends VectorSelector | MatrixSelector | SubqueryExpr>(
  expr: T,
  window: Duration
): T {
  return { ...expr, offset: window };
}

/** Attach an `@` modifier. */
export function at<T extends VectorSelector | MatrixSelector | SubqueryExpr>(
  expr: T,
  modifier: AtModifier | number | 'start' | 'end'
): T {
  let mod: AtModifier;
  if (modifier === 'start') mod = { kind: 'start' };
  else if (modifier === 'end') mod = { kind: 'end' };
  else if (typeof modifier === 'number') mod = { kind: 'timestamp', value: modifier };
  else mod = modifier;
  return { ...expr, at: mod };
}

/** Generic function call, e.g. `call('rate', range(metric('x'), minutes(5)))`. */
export function call(func: string, ...args: Expr[]): Call {
  return { type: 'Call', func, args };
}

// Common function helpers.
export const rate = (v: MatrixSelector): Call => call('rate', v);
export const irate = (v: MatrixSelector): Call => call('irate', v);
export const increase = (v: MatrixSelector): Call => call('increase', v);
export const avgOverTime = (v: MatrixSelector): Call => call('avg_over_time', v);
export const maxOverTime = (v: MatrixSelector): Call => call('max_over_time', v);
export const minOverTime = (v: MatrixSelector): Call => call('min_over_time', v);
export const sumOverTime = (v: MatrixSelector): Call => call('sum_over_time', v);
export const histogramQuantile = (q: number | Expr, v: Expr): Call =>
  call('histogram_quantile', typeof q === 'number' ? num(q) : q, v);

/** `by (...labels)` grouping clause. */
export function by(...labels: string[]): Grouping {
  return { modifier: 'by', labels };
}
/** `without (...labels)` grouping clause. */
export function without(...labels: string[]): Grouping {
  return { modifier: 'without', labels };
}

function agg(op: AggregateOp, expr: Expr, grouping?: Grouping): AggregateExpr {
  return { type: 'AggregateExpr', op, expr, ...(grouping ? { grouping } : {}) };
}
function aggParam(op: AggregateOp, param: Expr, expr: Expr, grouping?: Grouping): AggregateExpr {
  return { type: 'AggregateExpr', op, expr, param, ...(grouping ? { grouping } : {}) };
}

export const sum = (expr: Expr, grouping?: Grouping): AggregateExpr => agg('sum', expr, grouping);
export const min = (expr: Expr, grouping?: Grouping): AggregateExpr => agg('min', expr, grouping);
export const max = (expr: Expr, grouping?: Grouping): AggregateExpr => agg('max', expr, grouping);
export const avg = (expr: Expr, grouping?: Grouping): AggregateExpr => agg('avg', expr, grouping);
export const group = (expr: Expr, grouping?: Grouping): AggregateExpr => agg('group', expr, grouping);
export const count = (expr: Expr, grouping?: Grouping): AggregateExpr => agg('count', expr, grouping);
export const stddev = (expr: Expr, grouping?: Grouping): AggregateExpr => agg('stddev', expr, grouping);
export const stdvar = (expr: Expr, grouping?: Grouping): AggregateExpr => agg('stdvar', expr, grouping);

export const topk = (k: number | Expr, expr: Expr, grouping?: Grouping): AggregateExpr =>
  aggParam('topk', typeof k === 'number' ? num(k) : k, expr, grouping);
export const bottomk = (k: number | Expr, expr: Expr, grouping?: Grouping): AggregateExpr =>
  aggParam('bottomk', typeof k === 'number' ? num(k) : k, expr, grouping);
export const quantile = (q: number | Expr, expr: Expr, grouping?: Grouping): AggregateExpr =>
  aggParam('quantile', typeof q === 'number' ? num(q) : q, expr, grouping);
export const countValues = (label: string, expr: Expr, grouping?: Grouping): AggregateExpr =>
  aggParam('count_values', str(label), expr, grouping);

export interface BinaryOptions {
  bool?: boolean;
  matching?: VectorMatching;
}

/** Generic binary expression. */
export function binary(op: BinaryOp, lhs: Expr, rhs: Expr, options: BinaryOptions = {}): BinaryExpr {
  return {
    type: 'BinaryExpr',
    op,
    lhs,
    rhs,
    ...(options.bool ? { bool: options.bool } : {}),
    ...(options.matching ? { matching: options.matching } : {}),
  };
}

export const add = (l: Expr, r: Expr, o?: BinaryOptions): BinaryExpr => binary('+', l, r, o);
export const sub = (l: Expr, r: Expr, o?: BinaryOptions): BinaryExpr => binary('-', l, r, o);
export const mul = (l: Expr, r: Expr, o?: BinaryOptions): BinaryExpr => binary('*', l, r, o);
export const div = (l: Expr, r: Expr, o?: BinaryOptions): BinaryExpr => binary('/', l, r, o);
export const mod = (l: Expr, r: Expr, o?: BinaryOptions): BinaryExpr => binary('%', l, r, o);
export const pow = (l: Expr, r: Expr, o?: BinaryOptions): BinaryExpr => binary('^', l, r, o);
export const and = (l: Expr, r: Expr, o?: BinaryOptions): BinaryExpr => binary('and', l, r, o);
export const or = (l: Expr, r: Expr, o?: BinaryOptions): BinaryExpr => binary('or', l, r, o);
export const unless = (l: Expr, r: Expr, o?: BinaryOptions): BinaryExpr => binary('unless', l, r, o);

/** `on (...labels)` vector matching clause. */
export function on(...labels: string[]): VectorMatching {
  return { on: labels };
}
/** `ignoring (...labels)` vector matching clause. */
export function ignoring(...labels: string[]): VectorMatching {
  return { ignoring: labels };
}
