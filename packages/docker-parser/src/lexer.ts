import { Position, Range } from './types';

/**
 * Token types for Dockerfile lexer
 */
export enum TokenType {
  // Instructions
  FROM = 'FROM',
  RUN = 'RUN',
  CMD = 'CMD',
  LABEL = 'LABEL',
  MAINTAINER = 'MAINTAINER',
  EXPOSE = 'EXPOSE',
  ENV = 'ENV',
  ADD = 'ADD',
  COPY = 'COPY',
  ENTRYPOINT = 'ENTRYPOINT',
  VOLUME = 'VOLUME',
  USER = 'USER',
  WORKDIR = 'WORKDIR',
  ARG = 'ARG',
  ONBUILD = 'ONBUILD',
  STOPSIGNAL = 'STOPSIGNAL',
  HEALTHCHECK = 'HEALTHCHECK',
  SHELL = 'SHELL',

  // Other tokens
  COMMENT = 'COMMENT',
  DIRECTIVE = 'DIRECTIVE',
  STRING = 'STRING',
  QUOTED_STRING = 'QUOTED_STRING',
  JSON_ARRAY = 'JSON_ARRAY',
  NEWLINE = 'NEWLINE',
  WHITESPACE = 'WHITESPACE',
  CONTINUATION = 'CONTINUATION',
  FLAG = 'FLAG',
  EQUALS = 'EQUALS',
  EOF = 'EOF',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Token interface
 */
export interface Token {
  type: TokenType;
  value: string;
  range: Range;
}

/**
 * Instruction keywords
 */
const INSTRUCTIONS = new Set([
  'FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE', 'ENV',
  'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR',
  'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL'
]);

/**
 * Dockerfile Lexer
 */
export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 0;
  private escapeChar: string = '\\';
  private atLineStart: boolean = true;

  constructor(input: string) {
    this.input = input;
  }

  /**
   * Set the escape character (from parser directive)
   */
  setEscapeChar(char: string): void {
    if (char === '\\' || char === '`') {
      this.escapeChar = char;
    }
  }

  /**
   * Get current position
   */
  private getPosition(): Position {
    return {
      line: this.line,
      column: this.column,
      offset: this.pos
    };
  }

  /**
   * Peek at current character
   */
  private peek(offset: number = 0): string {
    return this.input[this.pos + offset] || '';
  }

  /**
   * Advance position by one character
   */
  private advance(): string {
    const char = this.input[this.pos];
    this.pos++;
    if (char === '\n') {
      this.line++;
      this.column = 0;
      this.atLineStart = true;
    } else {
      this.column++;
      if (char !== ' ' && char !== '\t') {
        this.atLineStart = false;
      }
    }
    return char;
  }

  /**
   * Check if at end of input
   */
  private isAtEnd(): boolean {
    return this.pos >= this.input.length;
  }

  /**
   * Skip whitespace (not newlines)
   */
  private skipWhitespace(): void {
    while (!this.isAtEnd() && (this.peek() === ' ' || this.peek() === '\t')) {
      this.advance();
    }
  }

  /**
   * Read until end of line, handling continuations
   */
  private readToEndOfLine(): string {
    let result = '';
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === '\n') {
        break;
      }
      if (char === '\r') {
        this.advance();
        continue;
      }
      if (char === this.escapeChar && (this.peek(1) === '\n' || this.peek(1) === '\r')) {
        // Line continuation
        this.advance(); // escape char
        if (this.peek() === '\r') this.advance();
        if (this.peek() === '\n') this.advance();
        result += ' ';
        continue;
      }
      result += this.advance();
    }
    return result;
  }

  /**
   * Read a quoted string
   */
  private readQuotedString(quote: string): string {
    let result = quote;
    this.advance(); // opening quote
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === quote) {
        result += this.advance();
        break;
      }
      if (char === '\\' && this.peek(1) === quote) {
        result += this.advance(); // backslash
        result += this.advance(); // escaped quote
        continue;
      }
      if (char === '\n') {
        break;
      }
      result += this.advance();
    }
    return result;
  }

  /**
   * Read a JSON array
   */
  private readJsonArray(): string {
    let result = '';
    let depth = 0;
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === '[') {
        depth++;
        result += this.advance();
      } else if (char === ']') {
        depth--;
        result += this.advance();
        if (depth === 0) break;
      } else if (char === '"') {
        result += this.readQuotedString('"');
      } else if (char === '\n' && depth === 0) {
        break;
      } else {
        result += this.advance();
      }
    }
    return result;
  }

  /**
   * Read an identifier/word
   */
  private readWord(): string {
    let result = '';
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '=') {
        break;
      }
      if (char === this.escapeChar && (this.peek(1) === '\n' || this.peek(1) === '\r')) {
        // Line continuation
        this.advance();
        if (this.peek() === '\r') this.advance();
        if (this.peek() === '\n') this.advance();
        continue;
      }
      result += this.advance();
    }
    return result;
  }

  /**
   * Check if this looks like a parser directive
   */
  private isDirective(): boolean {
    if (this.peek() !== '#') return false;
    // Look ahead for directive pattern: # directive=value
    let i = 1;
    while (this.peek(i) === ' ' || this.peek(i) === '\t') i++;
    let word = '';
    while (this.peek(i) && /[a-zA-Z]/.test(this.peek(i))) {
      word += this.peek(i);
      i++;
    }
    while (this.peek(i) === ' ' || this.peek(i) === '\t') i++;
    return this.peek(i) === '=' && (word.toLowerCase() === 'escape' || word.toLowerCase() === 'syntax');
  }

  /**
   * Read until end of line without handling continuations
   * Used for directive values where we don't want escape handling
   */
  private readToEndOfLineRaw(): string {
    let result = '';
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === '\n' || char === '\r') {
        break;
      }
      result += this.advance();
    }
    return result;
  }

  /**
   * Read a flag, including its `=value` if present
   *
   * Unlike readWord, this does not stop at `=`: a flag's value is part of the
   * flag (`--mount=type=cache,id=store`, `--from=builder`). Stopping at the
   * first `=` leaves the value behind as free text, where an instruction parser
   * reads it as the start of the command.
   */
  private readFlag(): string {
    let result = '';
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        break;
      }
      if (char === this.escapeChar && (this.peek(1) === '\n' || this.peek(1) === '\r')) {
        // Line continuation
        this.advance();
        if (this.peek() === '\r') this.advance();
        if (this.peek() === '\n') this.advance();
        continue;
      }
      result += this.advance();
    }
    return result;
  }

  /**
   * Read a comment or directive
   */
  private readComment(): Token {
    const start = this.getPosition();
    this.advance(); // #
    
    // Check for directive
    this.skipWhitespace();
    const wordStart = this.pos;
    let word = '';
    while (!this.isAtEnd() && /[a-zA-Z]/.test(this.peek())) {
      word += this.advance();
    }
    
    this.skipWhitespace();
    
    if (this.peek() === '=' && (word.toLowerCase() === 'escape' || word.toLowerCase() === 'syntax')) {
      this.advance(); // =
      this.skipWhitespace();
      // Use raw read for directive values to avoid escape character issues
      const value = this.readToEndOfLineRaw().trim();
      const end = this.getPosition();
      return {
        type: TokenType.DIRECTIVE,
        value: `${word.toLowerCase()}=${value}`,
        range: { start, end }
      };
    }
    
    // Regular comment - reset and read the whole line
    this.pos = wordStart;
    const value = this.readToEndOfLine();
    const end = this.getPosition();
    return {
      type: TokenType.COMMENT,
      value: value.trim(),
      range: { start, end }
    };
  }

  /**
   * Get next token
   */
  nextToken(): Token {
    // Skip whitespace at start of line
    if (this.atLineStart) {
      this.skipWhitespace();
    }

    if (this.isAtEnd()) {
      return {
        type: TokenType.EOF,
        value: '',
        range: { start: this.getPosition(), end: this.getPosition() }
      };
    }

    const start = this.getPosition();
    const char = this.peek();

    // Newline
    if (char === '\n') {
      this.advance();
      return {
        type: TokenType.NEWLINE,
        value: '\n',
        range: { start, end: this.getPosition() }
      };
    }

    // Carriage return
    if (char === '\r') {
      this.advance();
      if (this.peek() === '\n') {
        this.advance();
      }
      return {
        type: TokenType.NEWLINE,
        value: '\n',
        range: { start, end: this.getPosition() }
      };
    }

    // Comment or directive (only at line start)
    if (char === '#' && this.atLineStart) {
      return this.readComment();
    }

    // Whitespace
    if (char === ' ' || char === '\t') {
      let value = '';
      while (!this.isAtEnd() && (this.peek() === ' ' || this.peek() === '\t')) {
        value += this.advance();
      }
      return {
        type: TokenType.WHITESPACE,
        value,
        range: { start, end: this.getPosition() }
      };
    }

    // JSON array
    if (char === '[') {
      const value = this.readJsonArray();
      return {
        type: TokenType.JSON_ARRAY,
        value,
        range: { start, end: this.getPosition() }
      };
    }

    // Quoted string
    if (char === '"' || char === "'") {
      const value = this.readQuotedString(char);
      return {
        type: TokenType.QUOTED_STRING,
        value,
        range: { start, end: this.getPosition() }
      };
    }

    // Flag (--something, or --something=value)
    if (char === '-' && this.peek(1) === '-') {
      const value = this.readFlag();
      return {
        type: TokenType.FLAG,
        value,
        range: { start, end: this.getPosition() }
      };
    }

    // Equals
    if (char === '=') {
      this.advance();
      return {
        type: TokenType.EQUALS,
        value: '=',
        range: { start, end: this.getPosition() }
      };
    }

    // Word (instruction or string)
    // Save atLineStart before reading the word since readWord will change it
    const wasAtLineStart = this.atLineStart;
    const word = this.readWord();
    const upperWord = word.toUpperCase();
    
    if (INSTRUCTIONS.has(upperWord) && wasAtLineStart) {
      return {
        type: TokenType[upperWord as keyof typeof TokenType] || TokenType.STRING,
        value: word,
        range: { start, end: this.getPosition() }
      };
    }

    return {
      type: TokenType.STRING,
      value: word,
      range: { start, end: this.getPosition() }
    };
  }

  /**
   * Tokenize entire input
   */
  tokenize(): Token[] {
    const tokens: Token[] = [];
    let token: Token;
    do {
      token = this.nextToken();
      tokens.push(token);
    } while (token.type !== TokenType.EOF);
    return tokens;
  }
}
