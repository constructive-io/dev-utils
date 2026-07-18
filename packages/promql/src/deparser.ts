import type {
  AggregateExpr,
  AtModifier,
  BinaryExpr,
  BinaryOp,
  Call,
  Expr,
  LabelMatcher,
  MatrixSelector,
  NumberLiteral,
  ParenExpr,
  StringLiteral,
  SubqueryExpr,
  UnaryExpr,
  VectorMatching,
  VectorSelector,
} from './types';

const UNARY_PREC = 7;
const ATOM_PREC = 100;

function binOpPrec(op: BinaryOp): number {
  switch (op) {
    case 'or':
      return 1;
    case 'and':
    case 'unless':
      return 2;
    case '==':
    case '!=':
    case '<=':
    case '<':
    case '>=':
    case '>':
      return 3;
    case '+':
    case '-':
      return 4;
    case '*':
    case '/':
    case '%':
    case 'atan2':
      return 5;
    case '^':
      return 6;
  }
}

function isRightAssoc(op: BinaryOp): boolean {
  return op === '^';
}

function nodePrec(e: Expr): number {
  if (e.type === 'BinaryExpr') return binOpPrec(e.op);
  if (e.type === 'UnaryExpr') return UNARY_PREC;
  return ATOM_PREC;
}

/**
 * Deparser: renders a PromQL AST back to a canonical PromQL string.
 *
 * Parentheses are inserted based on operator precedence so that ASTs built
 * programmatically (without explicit `ParenExpr` nodes) still deparse to a
 * string that reparses to the same tree.
 */
export class Deparser {
  deparse(node: Expr): string {
    switch (node.type) {
      case 'NumberLiteral':
        return this.number(node);
      case 'StringLiteral':
        return this.string(node);
      case 'VectorSelector':
        return this.vectorSelector(node);
      case 'MatrixSelector':
        return this.matrixSelector(node);
      case 'SubqueryExpr':
        return this.subquery(node);
      case 'ParenExpr':
        return this.paren(node);
      case 'UnaryExpr':
        return this.unary(node);
      case 'BinaryExpr':
        return this.binary(node);
      case 'AggregateExpr':
        return this.aggregate(node);
      case 'Call':
        return this.call(node);
    }
  }

  private number(n: NumberLiteral): string {
    if (Number.isNaN(n.value)) return 'NaN';
    if (n.value === Infinity) return '+Inf';
    if (n.value === -Infinity) return '-Inf';
    return String(n.value);
  }

  private string(n: StringLiteral): string {
    return JSON.stringify(n.value);
  }

  private matcher(m: LabelMatcher): string {
    return `${m.name}${m.op}${JSON.stringify(m.value)}`;
  }

  private selectorHead(name: string | undefined, matchers: LabelMatcher[]): string {
    let head = name ?? '';
    if (matchers.length > 0) {
      head += `{${matchers.map((m) => this.matcher(m)).join(', ')}}`;
    } else if (!name) {
      head += '{}';
    }
    return head;
  }

  private atModifier(at: AtModifier): string {
    switch (at.kind) {
      case 'start':
        return ' @ start()';
      case 'end':
        return ' @ end()';
      case 'timestamp':
        return ` @ ${at.value}`;
    }
  }

  private offset(offset: string): string {
    return ` offset ${offset}`;
  }

  private vectorSelector(n: VectorSelector): string {
    let out = this.selectorHead(n.name, n.matchers);
    if (n.at) out += this.atModifier(n.at);
    if (n.offset) out += this.offset(n.offset);
    return out;
  }

  private matrixSelector(n: MatrixSelector): string {
    let out = this.selectorHead(n.vectorSelector.name, n.vectorSelector.matchers);
    out += `[${n.range}]`;
    if (n.at) out += this.atModifier(n.at);
    if (n.offset) out += this.offset(n.offset);
    return out;
  }

  private subquery(n: SubqueryExpr): string {
    let out = this.deparse(n.expr);
    out += `[${n.range}:${n.step ?? ''}]`;
    if (n.at) out += this.atModifier(n.at);
    if (n.offset) out += this.offset(n.offset);
    return out;
  }

  private paren(n: ParenExpr): string {
    return `(${this.deparse(n.expr)})`;
  }

  private unary(n: UnaryExpr): string {
    const operand = nodePrec(n.expr) < UNARY_PREC ? `(${this.deparse(n.expr)})` : this.deparse(n.expr);
    return `${n.op}${operand}`;
  }

  private binary(n: BinaryExpr): string {
    const p = binOpPrec(n.op);
    const rightAssoc = isRightAssoc(n.op);

    const lp = nodePrec(n.lhs);
    const rp = nodePrec(n.rhs);

    const lhsParen = lp < p || (lp === p && rightAssoc);
    const rhsParen = rp < p || (rp === p && !rightAssoc);

    const lhs = lhsParen ? `(${this.deparse(n.lhs)})` : this.deparse(n.lhs);
    const rhs = rhsParen ? `(${this.deparse(n.rhs)})` : this.deparse(n.rhs);

    let mid = n.op;
    if (n.bool) mid += ' bool';
    if (n.matching) mid += this.matching(n.matching);

    return `${lhs} ${mid} ${rhs}`;
  }

  private matching(m: VectorMatching): string {
    let out = '';
    if (m.on) out += ` on (${m.on.join(', ')})`;
    else if (m.ignoring) out += ` ignoring (${m.ignoring.join(', ')})`;

    if (m.groupLeft) out += m.groupLeft.length ? ` group_left (${m.groupLeft.join(', ')})` : ' group_left';
    else if (m.groupRight)
      out += m.groupRight.length ? ` group_right (${m.groupRight.join(', ')})` : ' group_right';

    return out;
  }

  private aggregate(n: AggregateExpr): string {
    const inner = n.param ? `${this.deparse(n.param)}, ${this.deparse(n.expr)}` : this.deparse(n.expr);
    if (n.grouping) {
      const g = `${n.grouping.modifier} (${n.grouping.labels.join(', ')})`;
      return `${n.op} ${g} (${inner})`;
    }
    return `${n.op}(${inner})`;
  }

  private call(n: Call): string {
    return `${n.func}(${n.args.map((a) => this.deparse(a)).join(', ')})`;
  }
}

/** Deparse a PromQL AST to a string. */
export function deparse(node: Expr): string {
  return new Deparser().deparse(node);
}
