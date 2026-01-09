import type { Position, Range } from './types';

/**
 * Token types for nginx configuration
 */
export enum TokenType {
  // Structural
  LBRACE = 'LBRACE',           // {
  RBRACE = 'RBRACE',           // }
  SEMICOLON = 'SEMICOLON',     // ;
  
  // Values
  WORD = 'WORD',               // unquoted word/identifier
  QUOTED_STRING = 'QUOTED_STRING', // "..." or '...'
  VARIABLE = 'VARIABLE',       // $variable
  
  // Comments
  COMMENT = 'COMMENT',         // # comment
  
  // Special
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
}

/**
 * Token represents a single lexical unit
 */
export interface Token {
  type: TokenType;
  value: string;
  range: Range;
}

/**
 * Lexer for nginx configuration files
 */
export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input;
  }

  /**
   * Tokenize the entire input
   */
  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.scanToken();
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      range: this.makeRange(this.pos, this.pos),
    });

    return this.tokens;
  }

  private scanToken(): void {
    this.skipWhitespace();

    if (this.isAtEnd()) {
      return;
    }

    const char = this.peek();

    // Comments
    if (char === '#') {
      this.scanComment();
      return;
    }

    // Structural tokens
    if (char === '{') {
      this.addToken(TokenType.LBRACE, '{');
      this.advance();
      return;
    }

    if (char === '}') {
      this.addToken(TokenType.RBRACE, '}');
      this.advance();
      return;
    }

    if (char === ';') {
      this.addToken(TokenType.SEMICOLON, ';');
      this.advance();
      return;
    }

    // Quoted strings
    if (char === '"' || char === "'") {
      this.scanQuotedString(char);
      return;
    }

    // Variables or words
    if (char === '$') {
      this.scanVariable();
      return;
    }

    // Regular words
    if (this.isWordChar(char)) {
      this.scanWord();
      return;
    }

    // Skip unknown characters
    this.advance();
  }

  private scanComment(): void {
    const start = this.pos;
    this.advance(); // skip #

    let value = '';
    while (!this.isAtEnd() && this.peek() !== '\n') {
      value += this.advance();
    }

    this.tokens.push({
      type: TokenType.COMMENT,
      value: value.trim(),
      range: this.makeRange(start, this.pos),
    });
  }

  private scanQuotedString(quote: string): void {
    const start = this.pos;
    this.advance(); // skip opening quote

    let value = '';
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\' && this.peekNext() === quote) {
        this.advance(); // skip backslash
        value += this.advance(); // add escaped quote
      } else if (this.peek() === '\\' && this.peekNext() === '\\') {
        this.advance(); // skip first backslash
        value += this.advance(); // add second backslash
      } else if (this.peek() === '\n') {
        value += this.advance();
      } else {
        value += this.advance();
      }
    }

    if (!this.isAtEnd()) {
      this.advance(); // skip closing quote
    }

    this.tokens.push({
      type: TokenType.QUOTED_STRING,
      value,
      range: this.makeRange(start, this.pos),
    });
  }

  private scanVariable(): void {
    const start = this.pos;
    this.advance(); // skip $

    let value = '$';

    // Handle ${var} syntax
    if (this.peek() === '{') {
      value += this.advance(); // add {
      while (!this.isAtEnd() && this.peek() !== '}') {
        value += this.advance();
      }
      if (!this.isAtEnd()) {
        value += this.advance(); // add }
      }
    } else {
      // Handle $var syntax
      while (!this.isAtEnd() && this.isVariableChar(this.peek())) {
        value += this.advance();
      }
    }

    this.tokens.push({
      type: TokenType.VARIABLE,
      value,
      range: this.makeRange(start, this.pos),
    });
  }

  private scanWord(): void {
    const start = this.pos;
    let value = '';

    while (!this.isAtEnd() && this.isWordChar(this.peek())) {
      value += this.advance();
    }

    this.tokens.push({
      type: TokenType.WORD,
      value,
      range: this.makeRange(start, this.pos),
    });
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else if (char === '\n') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private isWordChar(char: string): boolean {
    // Nginx words can contain many characters
    return (
      char !== ' ' &&
      char !== '\t' &&
      char !== '\n' &&
      char !== '\r' &&
      char !== '{' &&
      char !== '}' &&
      char !== ';' &&
      char !== '#' &&
      char !== '"' &&
      char !== "'"
    );
  }

  private isVariableChar(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.input[this.pos];
  }

  private peekNext(): string {
    if (this.pos + 1 >= this.input.length) return '\0';
    return this.input[this.pos + 1];
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

  private isAtEnd(): boolean {
    return this.pos >= this.input.length;
  }

  private addToken(type: TokenType, value: string): void {
    const start = this.pos;
    this.tokens.push({
      type,
      value,
      range: this.makeRange(start, start + value.length),
    });
  }

  private makeRange(start: number, end: number): Range {
    // Calculate line/column for start position
    let startLine = 1;
    let startColumn = 1;
    for (let i = 0; i < start && i < this.input.length; i++) {
      if (this.input[i] === '\n') {
        startLine++;
        startColumn = 1;
      } else {
        startColumn++;
      }
    }

    // Calculate line/column for end position
    let endLine = startLine;
    let endColumn = startColumn;
    for (let i = start; i < end && i < this.input.length; i++) {
      if (this.input[i] === '\n') {
        endLine++;
        endColumn = 1;
      } else {
        endColumn++;
      }
    }

    return {
      start: { line: startLine, column: startColumn },
      end: { line: endLine, column: endColumn },
    };
  }

  /**
   * Get current position for error reporting
   */
  getPosition(): Position {
    return { line: this.line, column: this.column };
  }
}
