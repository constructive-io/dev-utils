import { Lexer, Token, TokenType } from './lexer';
import type {
  AggregateExpr,
  AggregateOp,
  AtModifier,
  BinaryOp,
  Call,
  Expr,
  LabelMatcher,
  MatchOp,
  VectorMatching,
  VectorSelector,
} from './types';

const AGGREGATE_OPS = new Set<AggregateOp>([
  'sum',
  'min',
  'max',
  'avg',
  'group',
  'stddev',
  'stdvar',
  'count',
  'count_values',
  'bottomk',
  'topk',
  'quantile',
  'limitk',
  'limit_ratio',
]);

const AGG_WITH_PARAM = new Set<AggregateOp>([
  'count_values',
  'bottomk',
  'topk',
  'quantile',
  'limitk',
  'limit_ratio',
]);

const COMPARISON_OPS = new Set<BinaryOp>(['==', '!=', '<=', '<', '>=', '>']);

interface BinaryInfo {
  op: BinaryOp;
  prec: number;
  rightAssoc: boolean;
}

function tokenBinaryInfo(tok: Token): BinaryInfo | null {
  switch (tok.type) {
    case TokenType.ADD:
      return { op: '+', prec: 4, rightAssoc: false };
    case TokenType.SUB:
      return { op: '-', prec: 4, rightAssoc: false };
    case TokenType.MUL:
      return { op: '*', prec: 5, rightAssoc: false };
    case TokenType.DIV:
      return { op: '/', prec: 5, rightAssoc: false };
    case TokenType.MOD:
      return { op: '%', prec: 5, rightAssoc: false };
    case TokenType.POW:
      return { op: '^', prec: 6, rightAssoc: true };
    case TokenType.EQLC:
      return { op: '==', prec: 3, rightAssoc: false };
    case TokenType.NEQ:
      return { op: '!=', prec: 3, rightAssoc: false };
    case TokenType.LTE:
      return { op: '<=', prec: 3, rightAssoc: false };
    case TokenType.LT:
      return { op: '<', prec: 3, rightAssoc: false };
    case TokenType.GTE:
      return { op: '>=', prec: 3, rightAssoc: false };
    case TokenType.GT:
      return { op: '>', prec: 3, rightAssoc: false };
    case TokenType.IDENTIFIER:
      switch (tok.value) {
        case 'or':
          return { op: 'or', prec: 1, rightAssoc: false };
        case 'and':
          return { op: 'and', prec: 2, rightAssoc: false };
        case 'unless':
          return { op: 'unless', prec: 2, rightAssoc: false };
        case 'atan2':
          return { op: 'atan2', prec: 5, rightAssoc: false };
        default:
          return null;
      }
    default:
      return null;
  }
}

/**
 * Recursive-descent / precedence-climbing parser for PromQL.
 */
export class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(input: string) {
    this.tokens = new Lexer(input).tokenize();
  }

  parse(): Expr {
    const expr = this.parseExpr(0);
    this.expect(TokenType.EOF);
    return expr;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private lookahead(n: number): Token {
    return this.tokens[Math.min(this.pos + n, this.tokens.length - 1)];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private checkKeyword(word: string): boolean {
    const t = this.peek();
    return t.type === TokenType.IDENTIFIER && t.value === word;
  }

  private expect(type: TokenType): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new Error(
        `Expected ${type} but found ${t.type} ('${t.value}') at line ${t.range.start.line}:${t.range.start.column}`
      );
    }
    return this.advance();
  }

  private parseExpr(minPrec: number): Expr {
    let left = this.parseUnary();

    for (;;) {
      const info = tokenBinaryInfo(this.peek());
      if (!info || info.prec < minPrec) break;

      this.advance(); // operator

      let bool = false;
      if (COMPARISON_OPS.has(info.op) && this.checkKeyword('bool')) {
        this.advance();
        bool = true;
      }

      const matching = this.parseVectorMatching();

      const nextMin = info.rightAssoc ? info.prec : info.prec + 1;
      const right = this.parseExpr(nextMin);

      left = {
        type: 'BinaryExpr',
        op: info.op,
        lhs: left,
        rhs: right,
        ...(bool ? { bool } : {}),
        ...(matching ? { matching } : {}),
      };
    }

    return left;
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (t.type === TokenType.ADD || t.type === TokenType.SUB) {
      this.advance();
      const expr = this.parseUnary();
      return { type: 'UnaryExpr', op: t.type === TokenType.ADD ? '+' : '-', expr };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();

    for (;;) {
      if (this.check(TokenType.LEFT_BRACKET)) {
        expr = this.parseRangeOrSubquery(expr);
      } else if (this.check(TokenType.AT)) {
        this.advance();
        const at = this.parseAtModifier();
        expr = this.attachAt(expr, at);
      } else if (this.checkKeyword('offset')) {
        this.advance();
        const offset = this.parseOffsetDuration();
        expr = this.attachOffset(expr, offset);
      } else {
        break;
      }
    }

    return expr;
  }

  private parseRangeOrSubquery(expr: Expr): Expr {
    this.expect(TokenType.LEFT_BRACKET);
    const range = this.expect(TokenType.DURATION).value;

    if (this.check(TokenType.COLON)) {
      this.advance();
      let step: string | undefined;
      if (this.check(TokenType.DURATION)) step = this.advance().value;
      this.expect(TokenType.RIGHT_BRACKET);
      return { type: 'SubqueryExpr', expr, range, ...(step ? { step } : {}) };
    }

    this.expect(TokenType.RIGHT_BRACKET);
    if (expr.type !== 'VectorSelector') {
      throw new Error('Range vector selector must be applied to a vector selector');
    }
    return { type: 'MatrixSelector', vectorSelector: expr, range };
  }

  private attachAt(expr: Expr, at: AtModifier): Expr {
    if (
      expr.type === 'VectorSelector' ||
      expr.type === 'MatrixSelector' ||
      expr.type === 'SubqueryExpr'
    ) {
      return { ...expr, at };
    }
    throw new Error(`@ modifier cannot be applied to ${expr.type}`);
  }

  private attachOffset(expr: Expr, offset: string): Expr {
    if (
      expr.type === 'VectorSelector' ||
      expr.type === 'MatrixSelector' ||
      expr.type === 'SubqueryExpr'
    ) {
      return { ...expr, offset };
    }
    throw new Error(`offset modifier cannot be applied to ${expr.type}`);
  }

  private parseOffsetDuration(): string {
    let sign = '';
    if (this.check(TokenType.SUB)) {
      this.advance();
      sign = '-';
    } else if (this.check(TokenType.ADD)) {
      this.advance();
    }
    return sign + this.expect(TokenType.DURATION).value;
  }

  private parseAtModifier(): AtModifier {
    if (this.checkKeyword('start')) {
      this.advance();
      this.expect(TokenType.LEFT_PAREN);
      this.expect(TokenType.RIGHT_PAREN);
      return { kind: 'start' };
    }
    if (this.checkKeyword('end')) {
      this.advance();
      this.expect(TokenType.LEFT_PAREN);
      this.expect(TokenType.RIGHT_PAREN);
      return { kind: 'end' };
    }
    let sign = 1;
    if (this.check(TokenType.SUB)) {
      this.advance();
      sign = -1;
    } else if (this.check(TokenType.ADD)) {
      this.advance();
    }
    const num = this.expect(TokenType.NUMBER).value;
    return { kind: 'timestamp', value: sign * parseNumber(num) };
  }

  private parsePrimary(): Expr {
    const t = this.peek();

    switch (t.type) {
      case TokenType.NUMBER:
        this.advance();
        return { type: 'NumberLiteral', value: parseNumber(t.value) };
      case TokenType.STRING:
        this.advance();
        return { type: 'StringLiteral', value: t.value };
      case TokenType.LEFT_PAREN: {
        this.advance();
        const inner = this.parseExpr(0);
        this.expect(TokenType.RIGHT_PAREN);
        return { type: 'ParenExpr', expr: inner };
      }
      case TokenType.LEFT_BRACE: {
        const matchers = this.parseMatchers();
        return { type: 'VectorSelector', matchers };
      }
      case TokenType.IDENTIFIER:
        return this.parseIdentifierExpr();
      default:
        throw new Error(
          `Unexpected token ${t.type} ('${t.value}') at line ${t.range.start.line}:${t.range.start.column}`
        );
    }
  }

  private parseIdentifierExpr(): Expr {
    const nameTok = this.peek();
    const name = nameTok.value;

    if (name === 'Inf' || name === 'inf' || name === '+Inf') {
      this.advance();
      return { type: 'NumberLiteral', value: Infinity };
    }
    if (name === 'NaN' || name === 'nan') {
      this.advance();
      return { type: 'NumberLiteral', value: NaN };
    }

    if (AGGREGATE_OPS.has(name as AggregateOp) && this.isAggregateAhead()) {
      return this.parseAggregate(name as AggregateOp);
    }

    // Function call
    if (this.lookahead(1).type === TokenType.LEFT_PAREN) {
      this.advance(); // name
      const args = this.parseCallArgs();
      const call: Call = { type: 'Call', func: name, args };
      return call;
    }

    // Vector selector with metric name
    this.advance(); // name
    let matchers: LabelMatcher[] = [];
    if (this.check(TokenType.LEFT_BRACE)) matchers = this.parseMatchers();
    const sel: VectorSelector = { type: 'VectorSelector', name, matchers };
    return sel;
  }

  /**
   * Aggregations may write the grouping clause before the args
   * (`sum by (x) (...)`) or after (`sum(...) by (x)`). Either way the token
   * right after the op is `(` or a by/without keyword.
   */
  private isAggregateAhead(): boolean {
    const nxt = this.lookahead(1);
    if (nxt.type === TokenType.LEFT_PAREN) return true;
    return nxt.type === TokenType.IDENTIFIER && (nxt.value === 'by' || nxt.value === 'without');
  }

  private parseAggregate(op: AggregateOp): AggregateExpr {
    this.advance(); // op

    let grouping: AggregateExpr['grouping'];
    if (this.checkKeyword('by') || this.checkKeyword('without')) {
      grouping = this.parseGrouping();
    }

    this.expect(TokenType.LEFT_PAREN);
    const args: Expr[] = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      args.push(this.parseExpr(0));
      while (this.check(TokenType.COMMA)) {
        this.advance();
        args.push(this.parseExpr(0));
      }
    }
    this.expect(TokenType.RIGHT_PAREN);

    if (!grouping && (this.checkKeyword('by') || this.checkKeyword('without'))) {
      grouping = this.parseGrouping();
    }

    let param: Expr | undefined;
    let expr: Expr;
    if (AGG_WITH_PARAM.has(op) && args.length === 2) {
      param = args[0];
      expr = args[1];
    } else {
      expr = args[args.length - 1];
    }

    return {
      type: 'AggregateExpr',
      op,
      expr,
      ...(param ? { param } : {}),
      ...(grouping ? { grouping } : {}),
    };
  }

  private parseGrouping(): { modifier: 'by' | 'without'; labels: string[] } {
    const modifier = this.advance().value as 'by' | 'without';
    const labels = this.parseLabelList();
    return { modifier, labels };
  }

  private parseVectorMatching(): VectorMatching | undefined {
    const matching: VectorMatching = {};
    let has = false;

    if (this.checkKeyword('on')) {
      this.advance();
      matching.on = this.parseLabelList();
      has = true;
    } else if (this.checkKeyword('ignoring')) {
      this.advance();
      matching.ignoring = this.parseLabelList();
      has = true;
    }

    if (this.checkKeyword('group_left')) {
      this.advance();
      matching.groupLeft = this.check(TokenType.LEFT_PAREN) ? this.parseLabelList() : [];
      has = true;
    } else if (this.checkKeyword('group_right')) {
      this.advance();
      matching.groupRight = this.check(TokenType.LEFT_PAREN) ? this.parseLabelList() : [];
      has = true;
    }

    return has ? matching : undefined;
  }

  private parseLabelList(): string[] {
    this.expect(TokenType.LEFT_PAREN);
    const labels: string[] = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      labels.push(this.expect(TokenType.IDENTIFIER).value);
      while (this.check(TokenType.COMMA)) {
        this.advance();
        labels.push(this.expect(TokenType.IDENTIFIER).value);
      }
    }
    this.expect(TokenType.RIGHT_PAREN);
    return labels;
  }

  private parseCallArgs(): Expr[] {
    this.expect(TokenType.LEFT_PAREN);
    const args: Expr[] = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      args.push(this.parseExpr(0));
      while (this.check(TokenType.COMMA)) {
        this.advance();
        args.push(this.parseExpr(0));
      }
    }
    this.expect(TokenType.RIGHT_PAREN);
    return args;
  }

  private parseMatchers(): LabelMatcher[] {
    this.expect(TokenType.LEFT_BRACE);
    const matchers: LabelMatcher[] = [];
    while (!this.check(TokenType.RIGHT_BRACE)) {
      const name = this.expect(TokenType.IDENTIFIER).value;
      const op = this.parseMatchOp();
      const value = this.expect(TokenType.STRING).value;
      matchers.push({ name, op, value });
      if (this.check(TokenType.COMMA)) {
        this.advance();
      } else {
        break;
      }
    }
    this.expect(TokenType.RIGHT_BRACE);
    return matchers;
  }

  private parseMatchOp(): MatchOp {
    const t = this.advance();
    switch (t.type) {
      case TokenType.EQL:
        return '=';
      case TokenType.NEQ:
        return '!=';
      case TokenType.EQL_REGEX:
        return '=~';
      case TokenType.NEQ_REGEX:
        return '!~';
      default:
        throw new Error(
          `Expected label matcher operator but found '${t.value}' at line ${t.range.start.line}:${t.range.start.column}`
        );
    }
  }
}

function parseNumber(raw: string): number {
  if (raw.startsWith('0x') || raw.startsWith('0X')) return parseInt(raw, 16);
  return Number(raw);
}

/** Parse a PromQL expression string into an AST. */
export function parse(input: string): Expr {
  return new Parser(input).parse();
}
