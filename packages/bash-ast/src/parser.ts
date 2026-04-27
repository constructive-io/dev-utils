import { Lexer, Token, TokenType } from './lexer';
import {
  AssignmentWord,
  CaseClause,
  CaseItem,
  Command,
  CompoundList,
  ForClause,
  FunctionDefinition,
  IfClause,
  Redirect,
  RedirectOp,
  Script,
  SimpleCommand,
  Subshell,
  UntilClause,
  WhileClause,
  Word,
} from './types';

/**
 * Parser options
 */
export interface ParserOptions {
  // Reserved for future options
}

/**
 * Bash Parser
 */
export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private options: ParserOptions;

  constructor(options: ParserOptions = {}) {
    this.options = options;
  }

  /**
   * Parse bash source into AST
   */
  parse(source: string): Script {
    const lexer = new Lexer(source);
    this.tokens = lexer.tokenize();
    this.pos = 0;

    const commands: Command[] = [];

    this.skipNewlines();

    while (!this.isAtEnd()) {
      const command = this.parseCommand();
      if (command) {
        commands.push(command);
      }
      this.skipNewlinesAndSeparators();
    }

    return {
      type: 'Script',
      commands
    };
  }

  /**
   * Check if at end of tokens
   */
  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length || this.peek().type === TokenType.EOF;
  }

  /**
   * Peek at current token
   */
  private peek(offset: number = 0): Token {
    const idx = this.pos + offset;
    if (idx >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1];
    }
    return this.tokens[idx];
  }

  /**
   * Advance to next token
   */
  private advance(): Token {
    if (!this.isAtEnd()) {
      this.pos++;
    }
    return this.tokens[this.pos - 1];
  }

  /**
   * Check if current token matches type
   */
  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  /**
   * Consume token if it matches, otherwise error
   */
  private expect(type: TokenType): Token {
    if (this.check(type)) {
      return this.advance();
    }
    throw new Error(`Expected ${type}, got ${this.peek().type} at position ${this.pos}`);
  }

  /**
   * Skip newlines
   */
  private skipNewlines(): void {
    while (this.check(TokenType.NEWLINE)) {
      this.advance();
    }
  }

  /**
   * Skip newlines and separators
   */
  private skipNewlinesAndSeparators(): void {
    while (this.check(TokenType.NEWLINE) || this.check(TokenType.SEMI) || this.check(TokenType.AMP)) {
      this.advance();
    }
  }

  /**
   * Parse a command (handles logical operators)
   */
  private parseCommand(): Command | null {
    return this.parseLogicalOr();
  }

  /**
   * Parse logical OR (||)
   */
  private parseLogicalOr(): Command | null {
    let left = this.parseLogicalAnd();
    if (!left) return null;

    while (this.check(TokenType.OR_IF)) {
      this.advance();
      this.skipNewlines();
      const right = this.parseLogicalAnd();
      if (!right) {
        throw new Error('Expected command after ||');
      }
      left = {
        type: 'LogicalExpression',
        op: '||',
        left,
        right
      };
    }

    return left;
  }

  /**
   * Parse logical AND (&&)
   */
  private parseLogicalAnd(): Command | null {
    let left = this.parsePipeline();
    if (!left) return null;

    while (this.check(TokenType.AND_IF)) {
      this.advance();
      this.skipNewlines();
      const right = this.parsePipeline();
      if (!right) {
        throw new Error('Expected command after &&');
      }
      left = {
        type: 'LogicalExpression',
        op: '&&',
        left,
        right
      };
    }

    return left;
  }

  /**
   * Parse pipeline (|)
   */
  private parsePipeline(): Command | null {
    let bang = false;
    if (this.check(TokenType.BANG)) {
      bang = true;
      this.advance();
    }

    const first = this.parseCompoundCommand();
    if (!first) return null;

    const commands: Command[] = [first];

    while (this.check(TokenType.PIPE)) {
      this.advance();
      this.skipNewlines();
      const next = this.parseCompoundCommand();
      if (!next) {
        throw new Error('Expected command after |');
      }
      commands.push(next);
    }

    if (commands.length === 1 && !bang) {
      return first;
    }

    return {
      type: 'Pipeline',
      commands,
      bang: bang || undefined
    };
  }

  /**
   * Parse compound command or simple command
   */
  private parseCompoundCommand(): Command | null {
    const token = this.peek();

    switch (token.type) {
    case TokenType.IF:
      return this.parseIf();
    case TokenType.WHILE:
      return this.parseWhile();
    case TokenType.UNTIL:
      return this.parseUntil();
    case TokenType.FOR:
      return this.parseFor();
    case TokenType.CASE:
      return this.parseCase();
    case TokenType.LPAREN:
      return this.parseSubshell();
    case TokenType.LBRACE:
      return this.parseBraceGroup();
    case TokenType.FUNCTION:
      return this.parseFunction();
    default:
      // Check for function definition (name () { ... })
      if (token.type === TokenType.WORD && this.peek(1).type === TokenType.LPAREN && this.peek(2).type === TokenType.RPAREN) {
        return this.parseFunctionShorthand();
      }
      return this.parseSimpleCommand();
    }
  }

  /**
   * Parse simple command
   */
  private parseSimpleCommand(): SimpleCommand | null {
    const prefix: AssignmentWord[] = [];
    const suffix: (Word | Redirect)[] = [];
    let name: Word | undefined;

    // Parse prefix (assignments before command name)
    while (this.check(TokenType.ASSIGNMENT_WORD)) {
      const token = this.advance();
      prefix.push({
        type: 'AssignmentWord',
        text: token.value,
        range: token.range
      });
    }

    // Parse redirections before command name
    while (this.isRedirectOp()) {
      const redirect = this.parseRedirect();
      if (redirect) suffix.push(redirect);
    }

    // Parse command name
    if (this.check(TokenType.WORD)) {
      const token = this.advance();
      name = {
        type: 'Word',
        text: token.value,
        range: token.range
      };
    }

    // Parse suffix (arguments and redirections)
    while (true) {
      if (this.isRedirectOp()) {
        const redirect = this.parseRedirect();
        if (redirect) suffix.push(redirect);
      } else if (this.check(TokenType.WORD)) {
        const token = this.advance();
        suffix.push({
          type: 'Word',
          text: token.value,
          range: token.range
        });
      } else {
        break;
      }
    }

    if (!name && prefix.length === 0 && suffix.length === 0) {
      return null;
    }

    return {
      type: 'SimpleCommand',
      name,
      prefix: prefix.length > 0 ? prefix : undefined,
      suffix: suffix.length > 0 ? suffix : undefined
    };
  }

  /**
   * Check if current token is a redirect operator
   */
  private isRedirectOp(): boolean {
    const type = this.peek().type;
    return type === TokenType.LESS ||
      type === TokenType.GREAT ||
      type === TokenType.DLESS ||
      type === TokenType.DGREAT ||
      type === TokenType.LESSAND ||
      type === TokenType.GREATAND ||
      type === TokenType.LESSGREAT ||
      type === TokenType.DLESSDASH ||
      type === TokenType.CLOBBER ||
      type === TokenType.TLESS ||
      type === TokenType.IO_NUMBER;
  }

  /**
   * Parse redirect
   */
  private parseRedirect(): Redirect | null {
    let numberIo: number | undefined;

    // Check for IO number
    if (this.check(TokenType.IO_NUMBER)) {
      numberIo = parseInt(this.advance().value, 10);
    }

    const opToken = this.peek();
    let op: RedirectOp;

    switch (opToken.type) {
    case TokenType.LESS:
      op = '<';
      break;
    case TokenType.GREAT:
      op = '>';
      break;
    case TokenType.DLESS:
      op = '<<';
      break;
    case TokenType.DGREAT:
      op = '>>';
      break;
    case TokenType.LESSAND:
      op = '<&';
      break;
    case TokenType.GREATAND:
      op = '>&';
      break;
    case TokenType.LESSGREAT:
      op = '<>';
      break;
    case TokenType.DLESSDASH:
      op = '<<-';
      break;
    case TokenType.CLOBBER:
      op = '>|';
      break;
    case TokenType.TLESS:
      op = '<<<';
      break;
    default:
      return null;
    }

    this.advance();

    // Parse file/word
    if (this.check(TokenType.WORD)) {
      const fileToken = this.advance();
      return {
        type: 'Redirect',
        op,
        file: {
          type: 'Word',
          text: fileToken.value,
          range: fileToken.range
        },
        numberIo,
        range: opToken.range
      };
    }

    return {
      type: 'Redirect',
      op,
      numberIo,
      range: opToken.range
    };
  }

  /**
   * Parse if clause
   */
  private parseIf(): IfClause {
    const start = this.expect(TokenType.IF);
    this.skipNewlines();

    const condition = this.parseCompoundList();

    this.expect(TokenType.THEN);
    this.skipNewlines();

    const then = this.parseCompoundList();

    let elseClause: CompoundList | IfClause | undefined;

    if (this.check(TokenType.ELIF)) {
      elseClause = this.parseElif();
    } else if (this.check(TokenType.ELSE)) {
      this.advance();
      this.skipNewlines();
      elseClause = this.parseCompoundList();
    }

    this.expect(TokenType.FI);

    return {
      type: 'IfClause',
      condition,
      then,
      else: elseClause,
      range: start.range
    };
  }

  /**
   * Parse elif as nested if
   */
  private parseElif(): IfClause {
    this.expect(TokenType.ELIF);
    this.skipNewlines();

    const condition = this.parseCompoundList();

    this.expect(TokenType.THEN);
    this.skipNewlines();

    const then = this.parseCompoundList();

    let elseClause: CompoundList | IfClause | undefined;

    if (this.check(TokenType.ELIF)) {
      elseClause = this.parseElif();
    } else if (this.check(TokenType.ELSE)) {
      this.advance();
      this.skipNewlines();
      elseClause = this.parseCompoundList();
    }

    return {
      type: 'IfClause',
      condition,
      then,
      else: elseClause
    };
  }

  /**
   * Parse while clause
   */
  private parseWhile(): WhileClause {
    const start = this.expect(TokenType.WHILE);
    this.skipNewlines();

    const condition = this.parseCompoundList();

    this.expect(TokenType.DO);
    this.skipNewlines();

    const body = this.parseCompoundList();

    this.expect(TokenType.DONE);

    return {
      type: 'WhileClause',
      condition,
      body,
      range: start.range
    };
  }

  /**
   * Parse until clause
   */
  private parseUntil(): UntilClause {
    const start = this.expect(TokenType.UNTIL);
    this.skipNewlines();

    const condition = this.parseCompoundList();

    this.expect(TokenType.DO);
    this.skipNewlines();

    const body = this.parseCompoundList();

    this.expect(TokenType.DONE);

    return {
      type: 'UntilClause',
      condition,
      body,
      range: start.range
    };
  }

  /**
   * Parse for clause
   */
  private parseFor(): ForClause {
    const start = this.expect(TokenType.FOR);

    const nameToken = this.expect(TokenType.WORD);
    const name = nameToken.value;

    this.skipNewlines();

    let wordlist: Word[] | undefined;

    if (this.check(TokenType.IN)) {
      this.advance();
      wordlist = [];
      while (this.check(TokenType.WORD)) {
        const token = this.advance();
        wordlist.push({
          type: 'Word',
          text: token.value,
          range: token.range
        });
      }
    }

    this.skipNewlinesAndSeparators();
    this.expect(TokenType.DO);
    this.skipNewlines();

    const body = this.parseCompoundList();

    this.expect(TokenType.DONE);

    return {
      type: 'ForClause',
      name,
      wordlist,
      body,
      range: start.range
    };
  }

  /**
   * Parse case clause
   */
  private parseCase(): CaseClause {
    const start = this.expect(TokenType.CASE);

    const wordToken = this.expect(TokenType.WORD);
    const word: Word = {
      type: 'Word',
      text: wordToken.value,
      range: wordToken.range
    };

    this.skipNewlines();
    this.expect(TokenType.IN);
    this.skipNewlines();

    const cases: CaseItem[] = [];

    while (!this.check(TokenType.ESAC)) {
      const caseItem = this.parseCaseItem();
      if (caseItem) {
        cases.push(caseItem);
      }
      this.skipNewlines();
    }

    this.expect(TokenType.ESAC);

    return {
      type: 'CaseClause',
      word,
      cases,
      range: start.range
    };
  }

  /**
   * Parse case item
   */
  private parseCaseItem(): CaseItem | null {
    // Skip optional (
    if (this.check(TokenType.LPAREN)) {
      this.advance();
    }

    const pattern: Word[] = [];

    // Parse pattern
    while (this.check(TokenType.WORD)) {
      const token = this.advance();
      pattern.push({
        type: 'Word',
        text: token.value,
        range: token.range
      });

      if (this.check(TokenType.PIPE)) {
        this.advance();
      } else {
        break;
      }
    }

    if (pattern.length === 0) {
      return null;
    }

    this.expect(TokenType.RPAREN);
    this.skipNewlines();

    let body: CompoundList | undefined;

    if (!this.check(TokenType.DSEMI) && !this.check(TokenType.ESAC)) {
      body = this.parseCompoundList();
    }

    if (this.check(TokenType.DSEMI)) {
      this.advance();
    }

    return {
      type: 'CaseItem',
      pattern,
      body
    };
  }

  /**
   * Parse subshell
   */
  private parseSubshell(): Subshell {
    const start = this.expect(TokenType.LPAREN);
    this.skipNewlines();

    const list = this.parseCompoundList();

    this.expect(TokenType.RPAREN);

    return {
      type: 'Subshell',
      list,
      range: start.range
    };
  }

  /**
   * Parse brace group
   */
  private parseBraceGroup(): CompoundList {
    this.expect(TokenType.LBRACE);
    this.skipNewlines();

    const list = this.parseCompoundList();

    this.expect(TokenType.RBRACE);

    return list;
  }

  /**
   * Parse function definition (function name { ... })
   */
  private parseFunction(): FunctionDefinition {
    const start = this.expect(TokenType.FUNCTION);

    const nameToken = this.expect(TokenType.WORD);
    const name = nameToken.value;

    // Optional ()
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      this.expect(TokenType.RPAREN);
    }

    this.skipNewlines();

    const body = this.parseFunctionBody();

    return {
      type: 'FunctionDefinition',
      name,
      body,
      range: start.range
    };
  }

  /**
   * Parse function shorthand (name () { ... })
   */
  private parseFunctionShorthand(): FunctionDefinition {
    const nameToken = this.expect(TokenType.WORD);
    const name = nameToken.value;

    this.expect(TokenType.LPAREN);
    this.expect(TokenType.RPAREN);

    this.skipNewlines();

    const body = this.parseFunctionBody();

    return {
      type: 'FunctionDefinition',
      name,
      body,
      range: nameToken.range
    };
  }

  /**
   * Parse function body
   */
  private parseFunctionBody(): CompoundList | Subshell {
    if (this.check(TokenType.LPAREN)) {
      return this.parseSubshell();
    }

    return this.parseBraceGroup();
  }

  /**
   * Parse compound list (list of commands)
   */
  private parseCompoundList(): CompoundList {
    const commands: Command[] = [];

    while (true) {
      this.skipNewlines();

      // Check for terminators
      if (this.isAtEnd() ||
        this.check(TokenType.THEN) ||
        this.check(TokenType.ELSE) ||
        this.check(TokenType.ELIF) ||
        this.check(TokenType.FI) ||
        this.check(TokenType.DO) ||
        this.check(TokenType.DONE) ||
        this.check(TokenType.ESAC) ||
        this.check(TokenType.RPAREN) ||
        this.check(TokenType.RBRACE) ||
        this.check(TokenType.DSEMI)) {
        break;
      }

      const command = this.parseCommand();
      if (command) {
        commands.push(command);
      } else {
        break;
      }

      // Check for separator
      if (this.check(TokenType.SEMI) || this.check(TokenType.AMP) || this.check(TokenType.NEWLINE)) {
        this.advance();
      } else {
        break;
      }
    }

    return {
      type: 'CompoundList',
      commands
    };
  }
}

/**
 * Parse bash source into AST
 */
export function parse(source: string, options?: ParserOptions): Script {
  const parser = new Parser(options);
  return parser.parse(source);
}
