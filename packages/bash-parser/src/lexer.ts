import { Position, Range } from './types';

/**
 * Token types for bash lexer
 */
export enum TokenType {
  // Words and identifiers
  WORD = 'WORD',
  NAME = 'NAME',
  ASSIGNMENT_WORD = 'ASSIGNMENT_WORD',

  // Operators
  PIPE = 'PIPE',
  AND_IF = 'AND_IF',
  OR_IF = 'OR_IF',
  DSEMI = 'DSEMI',
  SEMI = 'SEMI',
  AMP = 'AMP',
  NEWLINE = 'NEWLINE',

  // Redirections
  LESS = 'LESS',
  GREAT = 'GREAT',
  DLESS = 'DLESS',
  DGREAT = 'DGREAT',
  LESSAND = 'LESSAND',
  GREATAND = 'GREATAND',
  LESSGREAT = 'LESSGREAT',
  DLESSDASH = 'DLESSDASH',
  CLOBBER = 'CLOBBER',
  TLESS = 'TLESS',

  // Reserved words
  IF = 'IF',
  THEN = 'THEN',
  ELSE = 'ELSE',
  ELIF = 'ELIF',
  FI = 'FI',
  DO = 'DO',
  DONE = 'DONE',
  CASE = 'CASE',
  ESAC = 'ESAC',
  WHILE = 'WHILE',
  UNTIL = 'UNTIL',
  FOR = 'FOR',
  IN = 'IN',
  FUNCTION = 'FUNCTION',
  BANG = 'BANG',

  // Grouping
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',

  // Special
  IO_NUMBER = 'IO_NUMBER',
  EOF = 'EOF',
  WHITESPACE = 'WHITESPACE',
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
 * Reserved words mapping
 */
const RESERVED_WORDS: Record<string, TokenType> = {
  if: TokenType.IF,
  then: TokenType.THEN,
  else: TokenType.ELSE,
  elif: TokenType.ELIF,
  fi: TokenType.FI,
  do: TokenType.DO,
  done: TokenType.DONE,
  case: TokenType.CASE,
  esac: TokenType.ESAC,
  while: TokenType.WHILE,
  until: TokenType.UNTIL,
  for: TokenType.FOR,
  in: TokenType.IN,
  function: TokenType.FUNCTION,
  '!': TokenType.BANG,
};

/**
 * Bash Lexer
 */
export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 0;

  constructor(input: string) {
    this.input = input;
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
    } else {
      this.column++;
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
   * Check if character is whitespace (not newline)
   */
  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t';
  }

  /**
   * Check if character is a digit
   */
  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  /**
   * Check if character can start a word
   */
  private isWordChar(char: string): boolean {
    return char !== '' &&
      !this.isWhitespace(char) &&
      char !== '\n' &&
      char !== '|' &&
      char !== '&' &&
      char !== ';' &&
      char !== '(' &&
      char !== ')' &&
      char !== '<' &&
      char !== '>' &&
      char !== '{' &&
      char !== '}';
  }

  /**
   * Skip whitespace (not newlines)
   */
  private skipWhitespace(): void {
    while (!this.isAtEnd() && this.isWhitespace(this.peek())) {
      this.advance();
    }
  }

  /**
   * Read a single-quoted string
   */
  private readSingleQuoted(): string {
    let result = "'";
    this.advance(); // opening quote
    while (!this.isAtEnd() && this.peek() !== "'") {
      result += this.advance();
    }
    if (this.peek() === "'") {
      result += this.advance();
    }
    return result;
  }

  /**
   * Read a double-quoted string
   */
  private readDoubleQuoted(): string {
    let result = '"';
    this.advance(); // opening quote
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\\' && (this.peek(1) === '"' || this.peek(1) === '\\' || this.peek(1) === '$' || this.peek(1) === '`')) {
        result += this.advance(); // backslash
        result += this.advance(); // escaped char
      } else {
        result += this.advance();
      }
    }
    if (this.peek() === '"') {
      result += this.advance();
    }
    return result;
  }

  /**
   * Read a word token
   */
  private readWord(): string {
    let result = '';
    while (!this.isAtEnd() && this.isWordChar(this.peek())) {
      const char = this.peek();
      if (char === "'") {
        result += this.readSingleQuoted();
      } else if (char === '"') {
        result += this.readDoubleQuoted();
      } else if (char === '\\') {
        result += this.advance(); // backslash
        if (!this.isAtEnd()) {
          result += this.advance(); // escaped char
        }
      } else if (char === '$') {
        result += this.readExpansion();
      } else if (char === '`') {
        result += this.readBacktickSubstitution();
      } else {
        result += this.advance();
      }
    }
    return result;
  }

  /**
   * Read an expansion ($VAR, ${VAR}, $(cmd), $((expr)))
   */
  private readExpansion(): string {
    let result = this.advance(); // $
    if (this.peek() === '(') {
      if (this.peek(1) === '(') {
        // Arithmetic expansion $((expr))
        result += this.advance(); // (
        result += this.advance(); // (
        let depth = 2;
        while (!this.isAtEnd() && depth > 0) {
          if (this.peek() === '(') depth++;
          if (this.peek() === ')') depth--;
          result += this.advance();
        }
      } else {
        // Command substitution $(cmd)
        result += this.advance(); // (
        let depth = 1;
        while (!this.isAtEnd() && depth > 0) {
          if (this.peek() === '(') depth++;
          if (this.peek() === ')') depth--;
          result += this.advance();
        }
      }
    } else if (this.peek() === '{') {
      // Parameter expansion ${VAR}
      result += this.advance(); // {
      let depth = 1;
      while (!this.isAtEnd() && depth > 0) {
        if (this.peek() === '{') depth++;
        if (this.peek() === '}') depth--;
        result += this.advance();
      }
    } else {
      // Simple variable $VAR
      while (!this.isAtEnd() && /[a-zA-Z0-9_]/.test(this.peek())) {
        result += this.advance();
      }
    }
    return result;
  }

  /**
   * Read backtick command substitution
   */
  private readBacktickSubstitution(): string {
    let result = this.advance(); // `
    while (!this.isAtEnd() && this.peek() !== '`') {
      if (this.peek() === '\\') {
        result += this.advance();
        if (!this.isAtEnd()) {
          result += this.advance();
        }
      } else {
        result += this.advance();
      }
    }
    if (this.peek() === '`') {
      result += this.advance();
    }
    return result;
  }

  /**
   * Read a comment
   */
  private readComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  /**
   * Get next token
   */
  nextToken(): Token {
    this.skipWhitespace();

    if (this.isAtEnd()) {
      return {
        type: TokenType.EOF,
        value: '',
        range: { start: this.getPosition(), end: this.getPosition() }
      };
    }

    const start = this.getPosition();
    const char = this.peek();

    // Comment
    if (char === '#') {
      this.readComment();
      return this.nextToken();
    }

    // Newline
    if (char === '\n') {
      this.advance();
      return {
        type: TokenType.NEWLINE,
        value: '\n',
        range: { start, end: this.getPosition() }
      };
    }

    // Operators
    if (char === '|') {
      this.advance();
      if (this.peek() === '|') {
        this.advance();
        return { type: TokenType.OR_IF, value: '||', range: { start, end: this.getPosition() } };
      }
      return { type: TokenType.PIPE, value: '|', range: { start, end: this.getPosition() } };
    }

    if (char === '&') {
      this.advance();
      if (this.peek() === '&') {
        this.advance();
        return { type: TokenType.AND_IF, value: '&&', range: { start, end: this.getPosition() } };
      }
      return { type: TokenType.AMP, value: '&', range: { start, end: this.getPosition() } };
    }

    if (char === ';') {
      this.advance();
      if (this.peek() === ';') {
        this.advance();
        return { type: TokenType.DSEMI, value: ';;', range: { start, end: this.getPosition() } };
      }
      return { type: TokenType.SEMI, value: ';', range: { start, end: this.getPosition() } };
    }

    // Redirections
    if (char === '<') {
      this.advance();
      if (this.peek() === '<') {
        this.advance();
        if (this.peek() === '-') {
          this.advance();
          return { type: TokenType.DLESSDASH, value: '<<-', range: { start, end: this.getPosition() } };
        }
        if (this.peek() === '<') {
          this.advance();
          return { type: TokenType.TLESS, value: '<<<', range: { start, end: this.getPosition() } };
        }
        return { type: TokenType.DLESS, value: '<<', range: { start, end: this.getPosition() } };
      }
      if (this.peek() === '&') {
        this.advance();
        return { type: TokenType.LESSAND, value: '<&', range: { start, end: this.getPosition() } };
      }
      if (this.peek() === '>') {
        this.advance();
        return { type: TokenType.LESSGREAT, value: '<>', range: { start, end: this.getPosition() } };
      }
      return { type: TokenType.LESS, value: '<', range: { start, end: this.getPosition() } };
    }

    if (char === '>') {
      this.advance();
      if (this.peek() === '>') {
        this.advance();
        return { type: TokenType.DGREAT, value: '>>', range: { start, end: this.getPosition() } };
      }
      if (this.peek() === '&') {
        this.advance();
        return { type: TokenType.GREATAND, value: '>&', range: { start, end: this.getPosition() } };
      }
      if (this.peek() === '|') {
        this.advance();
        return { type: TokenType.CLOBBER, value: '>|', range: { start, end: this.getPosition() } };
      }
      return { type: TokenType.GREAT, value: '>', range: { start, end: this.getPosition() } };
    }

    // Grouping
    if (char === '(') {
      this.advance();
      return { type: TokenType.LPAREN, value: '(', range: { start, end: this.getPosition() } };
    }

    if (char === ')') {
      this.advance();
      return { type: TokenType.RPAREN, value: ')', range: { start, end: this.getPosition() } };
    }

    if (char === '{') {
      this.advance();
      return { type: TokenType.LBRACE, value: '{', range: { start, end: this.getPosition() } };
    }

    if (char === '}') {
      this.advance();
      return { type: TokenType.RBRACE, value: '}', range: { start, end: this.getPosition() } };
    }

    // IO number (digit followed by < or >)
    if (this.isDigit(char) && (this.peek(1) === '<' || this.peek(1) === '>')) {
      const num = this.advance();
      return { type: TokenType.IO_NUMBER, value: num, range: { start, end: this.getPosition() } };
    }

    // Word
    const word = this.readWord();
    const end = this.getPosition();

    // Check for reserved words
    if (word in RESERVED_WORDS) {
      return { type: RESERVED_WORDS[word], value: word, range: { start, end } };
    }

    // Check for assignment word (NAME=VALUE)
    if (word.includes('=') && /^[a-zA-Z_][a-zA-Z0-9_]*=/.test(word)) {
      return { type: TokenType.ASSIGNMENT_WORD, value: word, range: { start, end } };
    }

    return { type: TokenType.WORD, value: word, range: { start, end } };
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
