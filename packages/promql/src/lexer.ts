import type { Position, Range } from './types';

/**
 * Token types for PromQL.
 */
export enum TokenType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',
  DURATION = 'DURATION',

  LEFT_PAREN = 'LEFT_PAREN',
  RIGHT_PAREN = 'RIGHT_PAREN',
  LEFT_BRACE = 'LEFT_BRACE',
  RIGHT_BRACE = 'RIGHT_BRACE',
  LEFT_BRACKET = 'LEFT_BRACKET',
  RIGHT_BRACKET = 'RIGHT_BRACKET',
  COMMA = 'COMMA',
  COLON = 'COLON',
  AT = 'AT',

  ADD = 'ADD',
  SUB = 'SUB',
  MUL = 'MUL',
  DIV = 'DIV',
  MOD = 'MOD',
  POW = 'POW',

  EQLC = 'EQLC', // ==
  NEQ = 'NEQ', //  !=
  LTE = 'LTE', //  <=
  GTE = 'GTE', //  >=
  LT = 'LT', //    <
  GT = 'GT', //    >

  EQL = 'EQL', //        =
  EQL_REGEX = 'EQL_REGEX', // =~
  NEQ_REGEX = 'NEQ_REGEX', // !~

  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  range: Range;
}

const DURATION_RE = /^([0-9]+(ms|[smhdwy]))+/;

function isIdentStart(ch: string): boolean {
  return /[a-zA-Z_]/.test(ch);
}
function isIdentPart(ch: string): boolean {
  return /[a-zA-Z0-9_]/.test(ch);
}
function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/**
 * Lexer for PromQL. Bracket-aware: `:` is a subquery separator inside `[...]`
 * and part of a (recording-rule) metric name outside of it.
 */
export class Lexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private col = 1;
  private bracketDepth = 0;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    let tok = this.next();
    while (tok.type !== TokenType.EOF) {
      tokens.push(tok);
      tok = this.next();
    }
    tokens.push(tok); // EOF
    return tokens;
  }

  private position(): Position {
    return { line: this.line, column: this.col, offset: this.pos };
  }

  private advance(n = 1): void {
    for (let i = 0; i < n; i++) {
      if (this.input[this.pos] === '\n') {
        this.line++;
        this.col = 1;
      } else {
        this.col++;
      }
      this.pos++;
    }
  }

  private makeToken(type: TokenType, value: string, start: Position): Token {
    return { type, value, range: { start, end: this.position() } };
  }

  private skipTrivia(): void {
    for (;;) {
      const ch = this.input[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
      } else if (ch === '#') {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') this.advance();
      } else {
        break;
      }
    }
  }

  private next(): Token {
    this.skipTrivia();
    const start = this.position();
    if (this.pos >= this.input.length) return this.makeToken(TokenType.EOF, '', start);

    const ch = this.input[this.pos];
    const two = this.input.slice(this.pos, this.pos + 2);

    // Multi-char operators
    switch (two) {
      case '==':
        this.advance(2);
        return this.makeToken(TokenType.EQLC, '==', start);
      case '!=':
        this.advance(2);
        return this.makeToken(TokenType.NEQ, '!=', start);
      case '<=':
        this.advance(2);
        return this.makeToken(TokenType.LTE, '<=', start);
      case '>=':
        this.advance(2);
        return this.makeToken(TokenType.GTE, '>=', start);
      case '=~':
        this.advance(2);
        return this.makeToken(TokenType.EQL_REGEX, '=~', start);
      case '!~':
        this.advance(2);
        return this.makeToken(TokenType.NEQ_REGEX, '!~', start);
      default:
        break;
    }

    // Single-char structural / operators
    switch (ch) {
      case '(':
        this.advance();
        return this.makeToken(TokenType.LEFT_PAREN, '(', start);
      case ')':
        this.advance();
        return this.makeToken(TokenType.RIGHT_PAREN, ')', start);
      case '{':
        this.advance();
        return this.makeToken(TokenType.LEFT_BRACE, '{', start);
      case '}':
        this.advance();
        return this.makeToken(TokenType.RIGHT_BRACE, '}', start);
      case '[':
        this.bracketDepth++;
        this.advance();
        return this.makeToken(TokenType.LEFT_BRACKET, '[', start);
      case ']':
        if (this.bracketDepth > 0) this.bracketDepth--;
        this.advance();
        return this.makeToken(TokenType.RIGHT_BRACKET, ']', start);
      case ',':
        this.advance();
        return this.makeToken(TokenType.COMMA, ',', start);
      case ':':
        this.advance();
        return this.makeToken(TokenType.COLON, ':', start);
      case '@':
        this.advance();
        return this.makeToken(TokenType.AT, '@', start);
      case '+':
        this.advance();
        return this.makeToken(TokenType.ADD, '+', start);
      case '-':
        this.advance();
        return this.makeToken(TokenType.SUB, '-', start);
      case '*':
        this.advance();
        return this.makeToken(TokenType.MUL, '*', start);
      case '/':
        this.advance();
        return this.makeToken(TokenType.DIV, '/', start);
      case '%':
        this.advance();
        return this.makeToken(TokenType.MOD, '%', start);
      case '^':
        this.advance();
        return this.makeToken(TokenType.POW, '^', start);
      case '=':
        this.advance();
        return this.makeToken(TokenType.EQL, '=', start);
      case '<':
        this.advance();
        return this.makeToken(TokenType.LT, '<', start);
      case '>':
        this.advance();
        return this.makeToken(TokenType.GT, '>', start);
      default:
        break;
    }

    if (ch === '"' || ch === "'" || ch === '`') return this.readString(start, ch);
    if (isDigit(ch) || (ch === '.' && isDigit(this.input[this.pos + 1] ?? ''))) {
      return this.readNumberOrDuration(start);
    }
    if (isIdentStart(ch)) return this.readIdentifier(start);

    throw new Error(`Unexpected character '${ch}' at line ${start.line}:${start.column}`);
  }

  private readString(start: Position, quote: string): Token {
    this.advance(); // opening quote
    let value = '';
    const raw = quote === '`';
    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      const c = this.input[this.pos];
      if (!raw && c === '\\') {
        const esc = this.input[this.pos + 1];
        this.advance(2);
        switch (esc) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '\\':
            value += '\\';
            break;
          case '"':
            value += '"';
            break;
          case "'":
            value += "'";
            break;
          default:
            value += esc ?? '';
        }
      } else {
        value += c;
        this.advance();
      }
    }
    if (this.pos >= this.input.length) {
      throw new Error(`Unterminated string starting at line ${start.line}:${start.column}`);
    }
    this.advance(); // closing quote
    return this.makeToken(TokenType.STRING, value, start);
  }

  private readNumberOrDuration(start: Position): Token {
    const rest = this.input.slice(this.pos);
    const durMatch = DURATION_RE.exec(rest);
    // Only a duration when the digits are immediately followed by a unit
    // (i.e. the match consumed more than just the leading digits).
    if (durMatch && /[a-z]/.test(durMatch[0])) {
      const value = durMatch[0];
      this.advance(value.length);
      return this.makeToken(TokenType.DURATION, value, start);
    }

    let value = '';
    // hex
    if (rest.startsWith('0x') || rest.startsWith('0X')) {
      value = '0x';
      this.advance(2);
      while (/[0-9a-fA-F]/.test(this.input[this.pos] ?? '')) {
        value += this.input[this.pos];
        this.advance();
      }
      return this.makeToken(TokenType.NUMBER, value, start);
    }
    while (isDigit(this.input[this.pos] ?? '')) {
      value += this.input[this.pos];
      this.advance();
    }
    if (this.input[this.pos] === '.') {
      value += '.';
      this.advance();
      while (isDigit(this.input[this.pos] ?? '')) {
        value += this.input[this.pos];
        this.advance();
      }
    }
    if (this.input[this.pos] === 'e' || this.input[this.pos] === 'E') {
      value += this.input[this.pos];
      this.advance();
      if (this.input[this.pos] === '+' || this.input[this.pos] === '-') {
        value += this.input[this.pos];
        this.advance();
      }
      while (isDigit(this.input[this.pos] ?? '')) {
        value += this.input[this.pos];
        this.advance();
      }
    }
    return this.makeToken(TokenType.NUMBER, value, start);
  }

  private readIdentifier(start: Position): Token {
    let value = '';
    // Metric names may contain ':' but only outside bracket (subquery) context.
    const allowColon = this.bracketDepth === 0;
    while (this.pos < this.input.length) {
      const c = this.input[this.pos];
      if (isIdentPart(c) || (allowColon && c === ':')) {
        value += c;
        this.advance();
      } else {
        break;
      }
    }
    return this.makeToken(TokenType.IDENTIFIER, value, start);
  }
}

/** Convenience: tokenize a PromQL string. */
export function tokenize(input: string): Token[] {
  return new Lexer(input).tokenize();
}
