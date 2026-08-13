import { HereDoc, Position, Range } from './types';

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
  COMMENT = 'COMMENT',
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
  /**
   * Body of the here-document introduced by this token. Only ever set on
   * `<<` / `<<-` tokens, and only once the delimiter line has been read.
   */
  heredoc?: HereDoc;
}

/**
 * Lexer options
 */
export interface LexerOptions {
  /**
   * Emit COMMENT tokens instead of discarding comments.
   */
  keepComments?: boolean;

  /**
   * Wall-clock budget for tokenizing, in milliseconds. Exceeding it throws
   * instead of letting a pathological input run unbounded.
   */
  timeoutMs?: number;
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
 * Builtins whose operands are assignments (`export FOO=bar`)
 */
const DECLARATION_BUILTINS = new Set([
  'export',
  'local',
  'declare',
  'readonly',
  'typeset',
]);

const ASSIGNMENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\[[^\]]*\])?\+?=/;

/**
 * A here-document whose delimiter has been seen but whose body has not been
 * read yet. The body starts on the line following the operator, so the token
 * is kept around and filled in once the newline is consumed.
 */
interface PendingHereDoc {
  token: Token;
  dash: boolean;
  delimiter?: string;
  quoted?: boolean;
}

/**
 * Bash Lexer
 */
export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 0;
  private options: LexerOptions;

  /**
   * True when the next word would be the command name, i.e. when a leading
   * `NAME=value` word is an assignment rather than an ordinary argument.
   */
  private commandPosition: boolean = true;

  /**
   * True while lexing the arguments of `export`/`local`/`declare`/`readonly`.
   */
  private declarationCommand: boolean = false;

  private pendingHereDocs: PendingHereDoc[] = [];

  constructor(input: string, options: LexerOptions = {}) {
    this.input = input;
    this.options = options;
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
    return char === ' ' || char === '\t' || char === '\r';
  }

  /**
   * Check if character is a digit
   */
  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  /**
   * Check if character can be part of a word
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
      char !== '>';
  }

  /**
   * Check if a character terminates a token. `{` and `}` are reserved words
   * only when they stand alone; elsewhere they are ordinary word characters
   * (`--set jsonpath={.metadata.name}`, `{1..3}`).
   */
  private isTokenDelimiter(char: string): boolean {
    return char === '' ||
      this.isWhitespace(char) ||
      char === '\n' ||
      char === ';' ||
      char === '&' ||
      char === '|' ||
      char === '(' ||
      char === ')' ||
      char === '<' ||
      char === '>';
  }

  /**
   * Skip whitespace and line continuations (not newlines)
   */
  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      if (this.isWhitespace(this.peek())) {
        this.advance();
      } else if (this.peek() === '\\' && this.peek(1) === '\n') {
        this.advance();
        this.advance();
      } else {
        break;
      }
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
        if (this.peek(1) === '\n') {
          // line continuation: removed, the word continues on the next line
          this.advance();
          this.advance();
          continue;
        }
        result += this.advance(); // backslash
        if (!this.isAtEnd()) {
          result += this.advance(); // escaped char
        }
      } else if (char === '$') {
        result += this.readExpansion();
      } else if (char === '`') {
        result += this.readBacktickSubstitution();
      } else if ((char === '{' || char === '}') && result === '' && this.isTokenDelimiter(this.peek(1))) {
        break;
      } else {
        result += this.advance();
      }
    }
    return result;
  }

  /**
   * Read a balanced parenthesised run, including the parens
   */
  private readBalancedParens(): string {
    let result = this.advance(); // (
    let depth = 1;
    while (!this.isAtEnd() && depth > 0) {
      const char = this.peek();
      if (char === "'") {
        result += this.readSingleQuoted();
        continue;
      }
      if (char === '"') {
        result += this.readDoubleQuoted();
        continue;
      }
      if (char === '(') depth++;
      if (char === ')') depth--;
      result += this.advance();
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
        result += this.readBalancedParens();
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
   * Read a comment, excluding the leading `#`
   */
  private readComment(): string {
    this.advance(); // #
    let result = '';
    while (!this.isAtEnd() && this.peek() !== '\n') {
      result += this.advance();
    }
    return result;
  }

  /**
   * Strip one level of quoting from a here-document delimiter
   */
  private unquoteDelimiter(word: string): { delimiter: string; quoted: boolean } {
    if (word.length >= 2 && ((word.startsWith("'") && word.endsWith("'")) || (word.startsWith('"') && word.endsWith('"')))) {
      return { delimiter: word.slice(1, -1), quoted: true };
    }
    if (word.includes('\\')) {
      return { delimiter: word.replace(/\\(.)/g, '$1'), quoted: true };
    }
    return { delimiter: word, quoted: false };
  }

  /**
   * Read one raw line, consuming its terminating newline
   */
  private readRawLine(): { text: string; terminated: boolean } {
    let text = '';
    while (!this.isAtEnd() && this.peek() !== '\n') {
      text += this.advance();
    }
    const terminated = this.peek() === '\n';
    if (terminated) {
      this.advance();
    }
    return { text, terminated };
  }

  /**
   * Read the bodies of every here-document pending on the line just ended.
   * A body is opaque text: it is never fed through the command lexer.
   */
  private readPendingHereDocBodies(): void {
    const pending = this.pendingHereDocs;
    this.pendingHereDocs = [];

    for (const entry of pending) {
      if (entry.delimiter === undefined) continue;

      let content = '';
      for (;;) {
        if (this.isAtEnd()) break;
        const startOfLine = this.pos;
        const { text, terminated } = this.readRawLine();
        const candidate = entry.dash ? text.replace(/^[\t]+/, '') : text;
        if (candidate === entry.delimiter) {
          break;
        }
        if (!terminated && this.isAtEnd() && startOfLine === this.pos) {
          break;
        }
        content += text + '\n';
        if (!terminated) break;
      }

      entry.token.heredoc = {
        type: 'HereDoc',
        delimiter: entry.delimiter,
        content,
        quoted: entry.quoted || undefined
      };
    }
  }

  /**
   * Track whether the next word sits in command (assignment) position. `)` is
   * in the list because it closes a case pattern, whose body starts a command.
   */
  private updateContext(token: Token): void {
    switch (token.type) {
    case TokenType.NEWLINE:
    case TokenType.SEMI:
    case TokenType.DSEMI:
    case TokenType.AMP:
    case TokenType.PIPE:
    case TokenType.AND_IF:
    case TokenType.OR_IF:
    case TokenType.LBRACE:
    case TokenType.LPAREN:
    case TokenType.RPAREN:
    case TokenType.BANG:
    case TokenType.IF:
    case TokenType.THEN:
    case TokenType.ELSE:
    case TokenType.ELIF:
    case TokenType.WHILE:
    case TokenType.UNTIL:
    case TokenType.DO:
      this.commandPosition = true;
      this.declarationCommand = false;
      break;
    case TokenType.ASSIGNMENT_WORD:
    case TokenType.COMMENT:
      break;
    case TokenType.WORD:
      if (this.commandPosition && DECLARATION_BUILTINS.has(token.value)) {
        this.declarationCommand = true;
      }
      this.commandPosition = false;
      break;
    default:
      this.commandPosition = false;
      this.declarationCommand = false;
      break;
    }
  }

  /**
   * Get next token
   */
  nextToken(): Token {
    const token = this.scanToken();
    this.updateContext(token);
    return token;
  }

  private scanToken(): Token {
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
      const text = this.readComment();
      if (this.options.keepComments) {
        return {
          type: TokenType.COMMENT,
          value: text,
          range: { start, end: this.getPosition() }
        };
      }
      return this.scanToken();
    }

    // Newline — here-document bodies start right after it
    if (char === '\n') {
      this.advance();
      const token: Token = {
        type: TokenType.NEWLINE,
        value: '\n',
        range: { start, end: this.getPosition() }
      };
      if (this.pendingHereDocs.length > 0) {
        this.readPendingHereDocBodies();
      }
      return token;
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
      if (this.peek() === '>') {
        // `&>file` — redirect both streams; lexed as a word-carrying redirect
        this.advance();
        if (this.peek() === '>') {
          this.advance();
          return { type: TokenType.WORD, value: '&>>', range: { start, end: this.getPosition() } };
        }
        return { type: TokenType.WORD, value: '&>', range: { start, end: this.getPosition() } };
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

    // Process substitution — a word, not a redirection
    if ((char === '<' || char === '>') && this.peek(1) === '(') {
      const op = this.advance();
      const body = this.readBalancedParens();
      return { type: TokenType.WORD, value: op + body, range: { start, end: this.getPosition() } };
    }

    // Redirections
    if (char === '<') {
      this.advance();
      if (this.peek() === '<') {
        this.advance();
        if (this.peek() === '-') {
          this.advance();
          const token: Token = { type: TokenType.DLESSDASH, value: '<<-', range: { start, end: this.getPosition() } };
          this.pendingHereDocs.push({ token, dash: true });
          return token;
        }
        if (this.peek() === '<') {
          this.advance();
          return { type: TokenType.TLESS, value: '<<<', range: { start, end: this.getPosition() } };
        }
        const token: Token = { type: TokenType.DLESS, value: '<<', range: { start, end: this.getPosition() } };
        this.pendingHereDocs.push({ token, dash: false });
        return token;
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

    // Arithmetic command `((expr))` — a word, not two subshells
    if (char === '(' && this.peek(1) === '(') {
      const text = this.readBalancedParens();
      if (text.startsWith('((') && text.endsWith('))')) {
        return { type: TokenType.WORD, value: text, range: { start, end: this.getPosition() } };
      }
      // not an arithmetic command after all: re-lex what we consumed
      this.pos = start.offset;
      this.line = start.line;
      this.column = start.column;
      this.advance();
      return { type: TokenType.LPAREN, value: '(', range: { start, end: this.getPosition() } };
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

    if (char === '{' && this.isTokenDelimiter(this.peek(1))) {
      this.advance();
      return { type: TokenType.LBRACE, value: '{', range: { start, end: this.getPosition() } };
    }

    if (char === '}' && this.isTokenDelimiter(this.peek(1))) {
      this.advance();
      return { type: TokenType.RBRACE, value: '}', range: { start, end: this.getPosition() } };
    }

    // IO number (digit followed by < or >)
    if (this.isDigit(char) && (this.peek(1) === '<' || this.peek(1) === '>')) {
      const num = this.advance();
      return { type: TokenType.IO_NUMBER, value: num, range: { start, end: this.getPosition() } };
    }

    // Word
    let word = this.readWord();

    // Check for reserved words
    if (word in RESERVED_WORDS) {
      return { type: RESERVED_WORDS[word], value: word, range: { start, end: this.getPosition() } };
    }

    // Assignment words only exist in assignment position: before the command
    // name, or as an operand of export/local/declare/readonly.
    if ((this.commandPosition || this.declarationCommand) && ASSIGNMENT_RE.test(word)) {
      if (word.endsWith('=') && this.peek() === '(') {
        // array assignment: arr=(a b c)
        word += this.readBalancedParens();
      }
      return { type: TokenType.ASSIGNMENT_WORD, value: word, range: { start, end: this.getPosition() } };
    }

    const end = this.getPosition();

    // A here-document delimiter is the word right after the operator
    const awaiting = this.pendingHereDocs.find(entry => entry.delimiter === undefined);
    if (awaiting) {
      const { delimiter, quoted } = this.unquoteDelimiter(word);
      awaiting.delimiter = delimiter;
      awaiting.quoted = quoted;
    }

    return { type: TokenType.WORD, value: word, range: { start, end } };
  }

  /**
   * Tokenize entire input
   */
  tokenize(): Token[] {
    const deadline = this.options.timeoutMs === undefined
      ? undefined
      : Date.now() + this.options.timeoutMs;

    const tokens: Token[] = [];
    let token: Token;
    do {
      if (deadline !== undefined && Date.now() > deadline) {
        throw new Error(`bash-ast: tokenizing exceeded ${this.options.timeoutMs}ms at line ${this.line}, column ${this.column}`);
      }
      token = this.nextToken();
      tokens.push(token);
    } while (token.type !== TokenType.EOF);
    return tokens;
  }
}
