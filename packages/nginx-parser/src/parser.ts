import { Lexer, Token, TokenType } from './lexer';
import type {
  Block,
  Comment,
  Directive,
  EventsBlock,
  GeoBlock,
  HttpBlock,
  IfBlock,
  LimitExceptBlock,
  LocationBlock,
  MapBlock,
  MapEntry,
  NginxConfig,
  Range,
  ServerBlock,
  Statement,
  StreamBlock,
  TypesBlock,
  UpstreamBlock,
} from './types';

/**
 * Parser for nginx configuration files
 */
export class Parser {
  private tokens: Token[] = [];
  private current: number = 0;

  /**
   * Parse nginx configuration string into AST
   */
  parse(input: string): NginxConfig {
    const lexer = new Lexer(input);
    this.tokens = lexer.tokenize();
    this.current = 0;

    const body: Statement[] = [];
    const startToken = this.peek();

    while (!this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) {
        body.push(stmt);
      }
    }

    return {
      type: 'NginxConfig',
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseStatement(): Statement | null {
    // Skip comments but include them in AST
    if (this.check(TokenType.COMMENT)) {
      return this.parseComment();
    }

    // Skip stray semicolons
    if (this.check(TokenType.SEMICOLON)) {
      this.advance();
      return null;
    }

    // Skip closing braces (handled by block parsing)
    if (this.check(TokenType.RBRACE)) {
      return null;
    }

    // Parse directive or block
    if (this.check(TokenType.WORD) || this.check(TokenType.VARIABLE)) {
      return this.parseDirectiveOrBlock();
    }

    // Skip unknown tokens
    this.advance();
    return null;
  }

  private parseComment(): Comment {
    const token = this.advance();
    return {
      type: 'Comment',
      value: token.value,
      range: token.range,
    };
  }

  private parseDirectiveOrBlock(): Statement {
    const startToken = this.peek();
    const name = this.advance().value;

    // Collect arguments until we hit { or ;
    const args: string[] = [];
    while (
      !this.isAtEnd() &&
      !this.check(TokenType.LBRACE) &&
      !this.check(TokenType.SEMICOLON) &&
      !this.check(TokenType.COMMENT)
    ) {
      const token = this.advance();
      args.push(token.value);
    }

    // Check if this is a block (has {)
    if (this.check(TokenType.LBRACE)) {
      return this.parseBlock(name, args, startToken);
    }

    // It's a simple directive
    if (this.check(TokenType.SEMICOLON)) {
      this.advance(); // consume ;
    }

    return {
      type: 'Directive',
      name,
      args,
      range: this.makeRange(startToken, this.previous()),
    } as Directive;
  }

  private parseBlock(name: string, args: string[], startToken: Token): Statement {
    this.advance(); // consume {

    // Handle special block types
    switch (name) {
    case 'if':
      return this.parseIfBlock(args, startToken);
    case 'map':
      return this.parseMapBlock(args, startToken);
    case 'geo':
      return this.parseGeoBlock(args, startToken);
    case 'upstream':
      return this.parseUpstreamBlock(args, startToken);
    case 'server':
      return this.parseServerBlock(startToken);
    case 'location':
      return this.parseLocationBlock(args, startToken);
    case 'http':
      return this.parseHttpBlock(startToken);
    case 'events':
      return this.parseEventsBlock(startToken);
    case 'stream':
      return this.parseStreamBlock(startToken);
    case 'types':
      return this.parseTypesBlock(startToken);
    case 'limit_except':
      return this.parseLimitExceptBlock(args, startToken);
    default:
      return this.parseGenericBlock(name, args, startToken);
    }
  }

  private parseIfBlock(args: string[], startToken: Token): IfBlock {
    // Reconstruct the condition from args
    const condition = args.join(' ');
    const body = this.parseBlockBody();

    return {
      type: 'IfBlock',
      condition,
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseMapBlock(args: string[], startToken: Token): MapBlock {
    const source = args[0] || '';
    const variable = args[1] || '';
    const body = this.parseMapEntries();

    return {
      type: 'MapBlock',
      source,
      variable,
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseMapEntries(): MapEntry[] {
    const entries: MapEntry[] = [];

    while (!this.isAtEnd() && !this.check(TokenType.RBRACE)) {
      if (this.check(TokenType.COMMENT)) {
        this.advance(); // skip comments in map blocks
        continue;
      }

      if (this.check(TokenType.WORD) || this.check(TokenType.QUOTED_STRING) || this.check(TokenType.VARIABLE)) {
        const startToken = this.peek();
        const match = this.advance().value;

        let value = '';
        if (this.check(TokenType.WORD) || this.check(TokenType.QUOTED_STRING) || this.check(TokenType.VARIABLE)) {
          value = this.advance().value;
        }

        if (this.check(TokenType.SEMICOLON)) {
          this.advance();
        }

        entries.push({
          type: 'MapEntry',
          match,
          value,
          range: this.makeRange(startToken, this.previous()),
        });
      } else {
        this.advance(); // skip unknown tokens
      }
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance();
    }

    return entries;
  }

  private parseGeoBlock(args: string[], startToken: Token): GeoBlock {
    let address: string | undefined;
    let variable: string;

    if (args.length >= 2) {
      address = args[0];
      variable = args[1];
    } else {
      variable = args[0] || '';
    }

    const body = this.parseMapEntries();

    return {
      type: 'GeoBlock',
      variable,
      address,
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseUpstreamBlock(args: string[], startToken: Token): UpstreamBlock {
    const name = args[0] || '';
    const body = this.parseBlockBody();

    return {
      type: 'UpstreamBlock',
      name,
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseServerBlock(startToken: Token): ServerBlock {
    const body = this.parseBlockBody();

    return {
      type: 'ServerBlock',
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseLocationBlock(args: string[], startToken: Token): LocationBlock {
    let modifier: LocationBlock['modifier'];
    let path: string;

    // Check for location modifiers
    if (args.length >= 2 && ['=', '~', '~*', '^~', '@'].includes(args[0])) {
      modifier = args[0] as LocationBlock['modifier'];
      path = args.slice(1).join(' ');
    } else if (args.length >= 1 && args[0].startsWith('@')) {
      modifier = '@';
      path = args[0];
    } else {
      path = args.join(' ');
    }

    const body = this.parseBlockBody();

    return {
      type: 'LocationBlock',
      modifier,
      path,
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseHttpBlock(startToken: Token): HttpBlock {
    const body = this.parseBlockBody();

    return {
      type: 'HttpBlock',
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseEventsBlock(startToken: Token): EventsBlock {
    const body = this.parseBlockBody();

    return {
      type: 'EventsBlock',
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseStreamBlock(startToken: Token): StreamBlock {
    const body = this.parseBlockBody();

    return {
      type: 'StreamBlock',
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseTypesBlock(startToken: Token): TypesBlock {
    const body = this.parseBlockBody();

    return {
      type: 'TypesBlock',
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseLimitExceptBlock(args: string[], startToken: Token): LimitExceptBlock {
    const methods = args;
    const body = this.parseBlockBody();

    return {
      type: 'LimitExceptBlock',
      methods,
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseGenericBlock(name: string, args: string[], startToken: Token): Block {
    const body = this.parseBlockBody();

    return {
      type: 'Block',
      name,
      args,
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseBlockBody(): Statement[] {
    const body: Statement[] = [];

    while (!this.isAtEnd() && !this.check(TokenType.RBRACE)) {
      const stmt = this.parseStatement();
      if (stmt) {
        body.push(stmt);
      }
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance();
    }

    return body;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private makeRange(start: Token, end: Token): Range {
    return {
      start: start.range.start,
      end: end.range.end,
    };
  }
}

/**
 * Parse nginx configuration string into AST
 */
export function parse(input: string): NginxConfig {
  const parser = new Parser();
  return parser.parse(input);
}
