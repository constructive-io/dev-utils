import { Lexer, Token, TokenType } from './lexer';
import type {
  ArrayOfTables,
  ArrayValue,
  BooleanValue,
  Comment,
  DateTimeValue,
  FloatValue,
  InlineTable,
  IntegerValue,
  Key,
  KeyPart,
  KeyValue,
  Range,
  RootItem,
  StringValue,
  Table,
  TableItem,
  TomlDocument,
  Value,
} from './types';

export class Parser {
  private tokens: Token[] = [];
  private current: number = 0;

  parse(input: string): TomlDocument {
    const lexer = new Lexer(input);
    this.tokens = lexer.tokenize();
    this.current = 0;

    const body: RootItem[] = [];
    const startToken = this.peek();

    this.skipNewlines();

    while (!this.isAtEnd()) {
      const item = this.parseRootItem();
      if (item) body.push(item);
      this.skipNewlines();
    }

    return {
      type: 'TomlDocument',
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseRootItem(): RootItem | null {
    if (this.check(TokenType.COMMENT)) {
      return this.parseComment();
    }

    if (this.check(TokenType.DOUBLE_LBRACKET)) {
      return this.parseArrayOfTables();
    }

    if (this.check(TokenType.LBRACKET)) {
      return this.parseTable();
    }

    if (this.isKeyStart()) {
      return this.parseKeyValue();
    }

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

  private parseTable(): Table {
    const startToken = this.advance(); // consume [
    this.skipInlineWhitespace();
    const key = this.parseKey();
    this.skipInlineWhitespace();
    this.expect(TokenType.RBRACKET);
    this.skipTrailingComment();
    this.skipNewlines();

    const body = this.parseTableBody();

    return {
      type: 'Table',
      key,
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseArrayOfTables(): ArrayOfTables {
    const startToken = this.advance(); // consume [[
    this.skipInlineWhitespace();
    const key = this.parseKey();
    this.skipInlineWhitespace();
    this.expect(TokenType.DOUBLE_RBRACKET);
    this.skipTrailingComment();
    this.skipNewlines();

    const body = this.parseTableBody();

    return {
      type: 'ArrayOfTables',
      key,
      body,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseTableBody(): TableItem[] {
    const items: TableItem[] = [];

    while (
      !this.isAtEnd() &&
      !this.check(TokenType.LBRACKET) &&
      !this.check(TokenType.DOUBLE_LBRACKET)
    ) {
      if (this.check(TokenType.COMMENT)) {
        items.push(this.parseComment());
      } else if (this.isKeyStart()) {
        items.push(this.parseKeyValue());
      } else {
        this.advance();
      }
      this.skipNewlines();
    }

    return items;
  }

  private parseKeyValue(): KeyValue {
    const startToken = this.peek();
    const key = this.parseKey();
    this.skipInlineWhitespace();
    this.expect(TokenType.EQUALS);
    this.skipInlineWhitespace();
    const value = this.parseValue();
    this.skipTrailingComment();

    return {
      type: 'KeyValue',
      key,
      value,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseKey(): Key {
    const startToken = this.peek();
    const parts: KeyPart[] = [];

    parts.push(this.parseKeyPart());

    while (this.check(TokenType.DOT)) {
      this.advance(); // consume .
      this.skipInlineWhitespace();
      parts.push(this.parseKeyPart());
    }

    return {
      type: 'Key',
      parts,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseKeyPart(): KeyPart {
    const token = this.peek();

    if (this.check(TokenType.BARE_KEY)) {
      const t = this.advance();
      return {
        type: 'KeyPart',
        value: t.value,
        style: 'bare',
        range: t.range,
      };
    }

    if (this.check(TokenType.BASIC_STRING)) {
      const t = this.advance();
      return {
        type: 'KeyPart',
        value: this.unescapeBasicString(t.value),
        style: 'basic',
        range: t.range,
      };
    }

    if (this.check(TokenType.LITERAL_STRING)) {
      const t = this.advance();
      return {
        type: 'KeyPart',
        value: t.value,
        style: 'literal',
        range: t.range,
      };
    }

    // integers can be bare keys in TOML
    if (this.check(TokenType.INTEGER)) {
      const t = this.advance();
      return {
        type: 'KeyPart',
        value: t.value,
        style: 'bare',
        range: t.range,
      };
    }

    throw this.error(`Expected key, got ${token.type}`);
  }

  private parseValue(): Value {
    if (this.check(TokenType.BASIC_STRING)) {
      return this.parseBasicString();
    }
    if (this.check(TokenType.LITERAL_STRING)) {
      return this.parseLiteralString();
    }
    if (this.check(TokenType.MULTILINE_BASIC_STRING)) {
      return this.parseMultilineBasicString();
    }
    if (this.check(TokenType.MULTILINE_LITERAL_STRING)) {
      return this.parseMultilineLiteralString();
    }
    if (this.check(TokenType.BOOLEAN)) {
      return this.parseBoolean();
    }
    if (this.check(TokenType.DATETIME)) {
      return this.parseDateTime();
    }
    if (this.check(TokenType.FLOAT)) {
      return this.parseFloat();
    }
    if (this.check(TokenType.INTEGER)) {
      return this.parseInteger();
    }
    if (this.check(TokenType.LBRACKET)) {
      return this.parseArray();
    }
    if (this.check(TokenType.LBRACE)) {
      return this.parseInlineTable();
    }

    throw this.error(`Expected value, got ${this.peek().type}`);
  }

  private parseBasicString(): StringValue {
    const token = this.advance();
    return {
      type: 'StringValue',
      value: this.unescapeBasicString(token.value),
      style: 'basic',
      range: token.range,
    };
  }

  private parseLiteralString(): StringValue {
    const token = this.advance();
    return {
      type: 'StringValue',
      value: token.value,
      style: 'literal',
      range: token.range,
    };
  }

  private parseMultilineBasicString(): StringValue {
    const token = this.advance();
    return {
      type: 'StringValue',
      value: this.unescapeBasicString(token.value),
      style: 'basic-multiline',
      range: token.range,
    };
  }

  private parseMultilineLiteralString(): StringValue {
    const token = this.advance();
    return {
      type: 'StringValue',
      value: token.value,
      style: 'literal-multiline',
      range: token.range,
    };
  }

  private parseBoolean(): BooleanValue {
    const token = this.advance();
    return {
      type: 'BooleanValue',
      value: token.value === 'true',
      range: token.range,
    };
  }

  private parseDateTime(): DateTimeValue {
    const token = this.advance();
    const val = token.value;
    let style: DateTimeValue['style'];

    if (val.includes('T') || val.includes(' ')) {
      if (val.includes('Z') || val.match(/[+-]\d{2}:\d{2}$/)) {
        style = 'offset-datetime';
      } else {
        style = 'local-datetime';
      }
    } else if (val.includes('-')) {
      style = 'local-date';
    } else {
      style = 'local-time';
    }

    return {
      type: 'DateTimeValue',
      value: val,
      style,
      range: token.range,
    };
  }

  private parseInteger(): IntegerValue {
    const token = this.advance();
    const raw = token.value;
    let value: number;

    const cleaned = raw.replace(/_/g, '');
    if (cleaned.startsWith('0x') || cleaned.startsWith('0X')) {
      value = parseInt(cleaned, 16);
    } else if (cleaned.startsWith('0o') || cleaned.startsWith('0O')) {
      value = parseInt(cleaned.slice(2), 8);
    } else if (cleaned.startsWith('0b') || cleaned.startsWith('0B')) {
      value = parseInt(cleaned.slice(2), 2);
    } else {
      value = parseInt(cleaned, 10);
    }

    return {
      type: 'IntegerValue',
      value,
      raw,
      range: token.range,
    };
  }

  private parseFloat(): FloatValue {
    const token = this.advance();
    const raw = token.value;
    const cleaned = raw.replace(/_/g, '');
    let value: number;

    if (cleaned === 'inf' || cleaned === '+inf') {
      value = Infinity;
    } else if (cleaned === '-inf') {
      value = -Infinity;
    } else if (cleaned === 'nan' || cleaned === '+nan' || cleaned === '-nan') {
      value = NaN;
    } else {
      value = parseFloat(cleaned);
    }

    return {
      type: 'FloatValue',
      value,
      raw,
      range: token.range,
    };
  }

  private parseArray(): ArrayValue {
    const startToken = this.advance(); // consume [
    const elements: Value[] = [];

    this.skipWhitespaceAndNewlines();

    while (!this.isAtEnd() && !this.check(TokenType.RBRACKET)) {
      // skip comments inside arrays
      if (this.check(TokenType.COMMENT)) {
        this.advance();
        this.skipWhitespaceAndNewlines();
        continue;
      }

      elements.push(this.parseValue());
      this.skipWhitespaceAndNewlines();

      if (this.check(TokenType.COMMA)) {
        this.advance();
        this.skipWhitespaceAndNewlines();
      }
    }

    this.expect(TokenType.RBRACKET);

    return {
      type: 'ArrayValue',
      elements,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private parseInlineTable(): InlineTable {
    const startToken = this.advance(); // consume {
    const entries: KeyValue[] = [];

    this.skipInlineWhitespace();

    while (!this.isAtEnd() && !this.check(TokenType.RBRACE)) {
      entries.push(this.parseKeyValue());
      this.skipInlineWhitespace();

      if (this.check(TokenType.COMMA)) {
        this.advance();
        this.skipInlineWhitespace();
      }
    }

    this.expect(TokenType.RBRACE);

    return {
      type: 'InlineTable',
      entries,
      range: this.makeRange(startToken, this.previous()),
    };
  }

  private unescapeBasicString(raw: string): string {
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '\\' && i + 1 < raw.length) {
        const next = raw[i + 1];
        switch (next) {
        case 'b': result += '\b'; i++; break;
        case 't': result += '\t'; i++; break;
        case 'n': result += '\n'; i++; break;
        case 'f': result += '\f'; i++; break;
        case 'r': result += '\r'; i++; break;
        case '"': result += '"'; i++; break;
        case '\\': result += '\\'; i++; break;
        case 'u': {
          const hex = raw.slice(i + 2, i + 6);
          result += String.fromCodePoint(parseInt(hex, 16));
          i += 5;
          break;
        }
        case 'U': {
          const hex = raw.slice(i + 2, i + 10);
          result += String.fromCodePoint(parseInt(hex, 16));
          i += 9;
          break;
        }
        case '\n': {
          // line ending backslash — skip whitespace
          i++;
          while (i < raw.length && (raw[i] === ' ' || raw[i] === '\t' || raw[i] === '\n' || raw[i] === '\r')) {
            i++;
          }
          i--; // for loop will increment
          break;
        }
        case '\r': {
          i++;
          if (i + 1 < raw.length && raw[i + 1] === '\n') i++;
          while (i < raw.length && (raw[i] === ' ' || raw[i] === '\t' || raw[i] === '\n' || raw[i] === '\r')) {
            i++;
          }
          i--;
          break;
        }
        default:
          result += '\\' + next;
          i++;
          break;
        }
      } else {
        result += raw[i];
      }
    }
    return result;
  }

  private isKeyStart(): boolean {
    return (
      this.check(TokenType.BARE_KEY) ||
      this.check(TokenType.BASIC_STRING) ||
      this.check(TokenType.LITERAL_STRING) ||
      this.check(TokenType.INTEGER)
    );
  }

  private skipNewlines(): void {
    while (this.check(TokenType.NEWLINE)) {
      this.advance();
    }
  }

  private skipInlineWhitespace(): void {
    // whitespace is already consumed by the lexer, nothing to skip at token level
  }

  private skipWhitespaceAndNewlines(): void {
    while (this.check(TokenType.NEWLINE) || this.check(TokenType.COMMENT)) {
      this.advance();
    }
  }

  private skipTrailingComment(): void {
    if (this.check(TokenType.COMMENT)) {
      this.advance();
    }
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
    return this.tokens[this.current - 1] || this.tokens[0];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private expect(type: TokenType): Token {
    if (this.check(type)) return this.advance();
    throw this.error(`Expected ${type}, got ${this.peek().type}`);
  }

  private error(message: string): Error {
    const pos = this.peek().range.start;
    return new Error(`TOML parse error at line ${pos.line}, column ${pos.column}: ${message}`);
  }

  private makeRange(start: Token, end: Token): Range {
    return {
      start: start.range.start,
      end: end.range.end,
    };
  }
}

export function parse(input: string): TomlDocument {
  const parser = new Parser();
  return parser.parse(input);
}
