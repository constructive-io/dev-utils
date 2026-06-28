import type { Position, Range } from './types';

export enum TokenType {
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  DOUBLE_LBRACKET = 'DOUBLE_LBRACKET',
  DOUBLE_RBRACKET = 'DOUBLE_RBRACKET',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  EQUALS = 'EQUALS',
  DOT = 'DOT',
  COMMA = 'COMMA',
  NEWLINE = 'NEWLINE',

  BARE_KEY = 'BARE_KEY',
  BASIC_STRING = 'BASIC_STRING',
  LITERAL_STRING = 'LITERAL_STRING',
  MULTILINE_BASIC_STRING = 'MULTILINE_BASIC_STRING',
  MULTILINE_LITERAL_STRING = 'MULTILINE_LITERAL_STRING',

  INTEGER = 'INTEGER',
  FLOAT = 'FLOAT',
  BOOLEAN = 'BOOLEAN',
  DATETIME = 'DATETIME',

  COMMENT = 'COMMENT',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  range: Range;
}

export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  private atLineStart: boolean = true;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.scanToken();
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      range: { start: this.getPosition(), end: this.getPosition() },
    });

    return this.tokens;
  }

  private scanToken(): void {
    this.skipInlineWhitespace();
    if (this.isAtEnd()) return;

    const start = this.getPosition();
    const char = this.peek();

    if (char === '\n') {
      this.advance();
      this.addToken(TokenType.NEWLINE, '\n', start);
      this.atLineStart = true;
      return;
    }

    if (char === '\r') {
      this.advance();
      if (this.peek() === '\n') this.advance();
      this.addToken(TokenType.NEWLINE, '\n', start);
      this.atLineStart = true;
      return;
    }

    if (char === '#') {
      this.scanComment(start);
      return;
    }

    if (char === '[') {
      if (this.atLineStart && this.peekAt(1) === '[') {
        this.advance();
        this.advance();
        this.addToken(TokenType.DOUBLE_LBRACKET, '[[', start);
        this.atLineStart = false;
        return;
      }
      this.advance();
      this.addToken(TokenType.LBRACKET, '[', start);
      this.atLineStart = false;
      return;
    }

    if (char === ']') {
      if (this.peekAt(1) === ']' && this.isAfterTableKey()) {
        this.advance();
        this.advance();
        this.addToken(TokenType.DOUBLE_RBRACKET, ']]', start);
        return;
      }
      this.advance();
      this.addToken(TokenType.RBRACKET, ']', start);
      return;
    }

    if (char === '{') {
      this.advance();
      this.addToken(TokenType.LBRACE, '{', start);
      this.atLineStart = false;
      return;
    }

    if (char === '}') {
      this.advance();
      this.addToken(TokenType.RBRACE, '}', start);
      this.atLineStart = false;
      return;
    }

    if (char === '=') {
      this.advance();
      this.addToken(TokenType.EQUALS, '=', start);
      this.atLineStart = false;
      return;
    }

    if (char === '.') {
      this.advance();
      this.addToken(TokenType.DOT, '.', start);
      this.atLineStart = false;
      return;
    }

    if (char === ',') {
      this.advance();
      this.addToken(TokenType.COMMA, ',', start);
      this.atLineStart = false;
      return;
    }

    if (char === '"') {
      if (this.peekAt(1) === '"' && this.peekAt(2) === '"') {
        this.scanMultilineBasicString(start);
      } else {
        this.scanBasicString(start);
      }
      return;
    }

    if (char === "'") {
      if (this.peekAt(1) === "'" && this.peekAt(2) === "'") {
        this.scanMultilineLiteralString(start);
      } else {
        this.scanLiteralString(start);
      }
      return;
    }

    if (char === 't' && this.matchWord('true')) {
      this.advanceN(4);
      this.addToken(TokenType.BOOLEAN, 'true', start);
      return;
    }

    if (char === 'f' && this.matchWord('false')) {
      this.advanceN(5);
      this.addToken(TokenType.BOOLEAN, 'false', start);
      return;
    }

    if (this.isNumberStart(char)) {
      this.scanNumber(start);
      return;
    }

    if (char === 'i' && this.matchWord('inf')) {
      this.advanceN(3);
      this.addToken(TokenType.FLOAT, 'inf', start);
      return;
    }

    if (char === 'n' && this.matchWord('nan')) {
      this.advanceN(3);
      this.addToken(TokenType.FLOAT, 'nan', start);
      return;
    }

    if (this.isBareKeyChar(char)) {
      this.scanBareKey(start);
      this.atLineStart = false;
      return;
    }

    this.atLineStart = false;
    this.advance();
  }

  private isAfterTableKey(): boolean {
    // ]] should only be emitted as DOUBLE_RBRACKET when closing an array-of-tables header
    // Look back through tokens to find a matching DOUBLE_LBRACKET
    let depth = 0;
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      const t = this.tokens[i].type;
      if (t === TokenType.DOUBLE_RBRACKET) depth++;
      if (t === TokenType.DOUBLE_LBRACKET) {
        if (depth === 0) return true;
        depth--;
      }
      if (t === TokenType.NEWLINE) break;
    }
    return false;
  }

  private scanComment(start: Position): void {
    this.advance(); // skip #
    let value = '';
    while (!this.isAtEnd() && this.peek() !== '\n' && this.peek() !== '\r') {
      value += this.advance();
    }
    this.addToken(TokenType.COMMENT, value.trim(), start);
  }

  private scanBasicString(start: Position): void {
    this.advance(); // skip opening "
    let value = '';
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\\') {
        value += this.advance(); // backslash
        if (!this.isAtEnd()) value += this.advance(); // escaped char
      } else {
        value += this.advance();
      }
    }
    if (!this.isAtEnd()) this.advance(); // skip closing "
    this.addToken(TokenType.BASIC_STRING, value, start);
  }

  private scanLiteralString(start: Position): void {
    this.advance(); // skip opening '
    let value = '';
    while (!this.isAtEnd() && this.peek() !== "'") {
      value += this.advance();
    }
    if (!this.isAtEnd()) this.advance(); // skip closing '
    this.addToken(TokenType.LITERAL_STRING, value, start);
  }

  private scanMultilineBasicString(start: Position): void {
    this.advanceN(3); // skip opening """
    // skip immediate newline after opening delimiter
    if (this.peek() === '\n') {
      this.advance();
    } else if (this.peek() === '\r' && this.peekAt(1) === '\n') {
      this.advance();
      this.advance();
    }
    let value = '';
    while (!this.isAtEnd()) {
      if (this.peek() === '"' && this.peekAt(1) === '"' && this.peekAt(2) === '"') {
        this.advanceN(3);
        break;
      }
      if (this.peek() === '\\') {
        value += this.advance();
        if (!this.isAtEnd()) value += this.advance();
      } else {
        value += this.advance();
      }
    }
    this.addToken(TokenType.MULTILINE_BASIC_STRING, value, start);
  }

  private scanMultilineLiteralString(start: Position): void {
    this.advanceN(3); // skip opening '''
    // skip immediate newline after opening delimiter
    if (this.peek() === '\n') {
      this.advance();
    } else if (this.peek() === '\r' && this.peekAt(1) === '\n') {
      this.advance();
      this.advance();
    }
    let value = '';
    while (!this.isAtEnd()) {
      if (this.peek() === "'" && this.peekAt(1) === "'" && this.peekAt(2) === "'") {
        this.advanceN(3);
        break;
      }
      value += this.advance();
    }
    this.addToken(TokenType.MULTILINE_LITERAL_STRING, value, start);
  }

  private scanNumber(start: Position): void {
    let value = '';
    const firstChar = this.peek();

    // leading sign
    if (firstChar === '+' || firstChar === '-') {
      value += this.advance();
      // +inf, -inf, +nan, -nan
      if (this.peek() === 'i' && this.matchWord('inf')) {
        value += 'inf';
        this.advanceN(3);
        this.addToken(TokenType.FLOAT, value, start);
        return;
      }
      if (this.peek() === 'n' && this.matchWord('nan')) {
        value += 'nan';
        this.advanceN(3);
        this.addToken(TokenType.FLOAT, value, start);
        return;
      }
    }

    // 0x, 0o, 0b prefixes
    if (this.peek() === '0' && this.peekAt(1) && 'xXoObB'.includes(this.peekAt(1))) {
      value += this.advance(); // 0
      value += this.advance(); // prefix letter
      while (!this.isAtEnd() && (this.isHexDigit(this.peek()) || this.peek() === '_')) {
        value += this.advance();
      }
      this.addToken(TokenType.INTEGER, value, start);
      return;
    }

    // regular digits
    let isFloat = false;
    while (!this.isAtEnd() && (this.isDigit(this.peek()) || this.peek() === '_')) {
      value += this.advance();
    }

    // check for datetime (digits followed by - in date pattern or : in time pattern)
    if (this.peek() === '-' && value.length === 4 && /^\d{4}$/.test(value)) {
      value += this.scanDateTimeTail();
      this.addToken(TokenType.DATETIME, value, start);
      return;
    }

    if (this.peek() === ':' && value.length === 2 && /^\d{2}$/.test(value)) {
      value += this.scanTimeTail();
      this.addToken(TokenType.DATETIME, value, start);
      return;
    }

    // decimal point
    if (this.peek() === '.' && this.isDigit(this.peekAt(1))) {
      isFloat = true;
      value += this.advance(); // dot
      while (!this.isAtEnd() && (this.isDigit(this.peek()) || this.peek() === '_')) {
        value += this.advance();
      }
    }

    // exponent
    if (this.peek() === 'e' || this.peek() === 'E') {
      isFloat = true;
      value += this.advance(); // e/E
      if (this.peek() === '+' || this.peek() === '-') {
        value += this.advance();
      }
      while (!this.isAtEnd() && (this.isDigit(this.peek()) || this.peek() === '_')) {
        value += this.advance();
      }
    }

    this.addToken(isFloat ? TokenType.FLOAT : TokenType.INTEGER, value, start);
  }

  private scanDateTimeTail(): string {
    let tail = '';
    // consume rest of date/time characters
    while (!this.isAtEnd() && /[\d\-T:+Z.]/.test(this.peek())) {
      tail += this.advance();
      // handle space separator between date and time (TOML allows it)
      if (this.peek() === ' ' && this.peekAt(1) && this.isDigit(this.peekAt(1)) && tail.match(/-\d{2}$/)) {
        tail += this.advance(); // space
      }
    }
    return tail;
  }

  private scanTimeTail(): string {
    let tail = '';
    while (!this.isAtEnd() && /[\d:.]/.test(this.peek())) {
      tail += this.advance();
    }
    return tail;
  }

  private scanBareKey(start: Position): void {
    let value = '';
    while (!this.isAtEnd() && this.isBareKeyChar(this.peek())) {
      value += this.advance();
    }
    this.addToken(TokenType.BARE_KEY, value, start);
  }

  private matchWord(word: string): boolean {
    for (let i = 0; i < word.length; i++) {
      if (this.peekAt(i) !== word[i]) return false;
    }
    const after = this.peekAt(word.length);
    return !after || !this.isBareKeyChar(after);
  }

  private isNumberStart(char: string): boolean {
    if (this.isDigit(char)) return true;
    if ((char === '+' || char === '-') && this.isDigit(this.peekAt(1))) return true;
    if ((char === '+' || char === '-') && this.peekAt(1) === 'i') return true;
    if ((char === '+' || char === '-') && this.peekAt(1) === 'n') return true;
    return false;
  }

  private isBareKeyChar(char: string): boolean {
    return /[A-Za-z0-9_-]/.test(char);
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isHexDigit(char: string): boolean {
    return /[0-9a-fA-F]/.test(char);
  }

  private skipInlineWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.input[this.pos];
  }

  private peekAt(offset: number): string {
    const idx = this.pos + offset;
    if (idx >= this.input.length) return '\0';
    return this.input[idx];
  }

  private advance(): string {
    const char = this.input[this.pos];
    this.pos++;
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private advanceN(n: number): void {
    for (let i = 0; i < n; i++) this.advance();
  }

  private isAtEnd(): boolean {
    return this.pos >= this.input.length;
  }

  private getPosition(): Position {
    return { line: this.line, column: this.column };
  }

  private addToken(type: TokenType, value: string, start: Position): void {
    this.tokens.push({
      type,
      value,
      range: { start, end: this.getPosition() },
    });
  }
}
