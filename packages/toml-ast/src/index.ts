export type {
  AstNode,
  ArrayOfTables,
  ArrayValue,
  BaseNode,
  BooleanValue,
  Comment,
  DateTimeValue,
  FloatValue,
  InlineTable,
  IntegerValue,
  Key,
  KeyPart,
  KeyValue,
  Position,
  Range,
  RootItem,
  StringValue,
  Table,
  TableItem,
  TomlDocument,
  Value,
} from './types';

export type { Token } from './lexer';
export { Lexer, TokenType } from './lexer';

export { parse, Parser } from './parser';

export type { DeparseOptions } from './deparser';
export { deparse, Deparser } from './deparser';

export { astEqual, cleanTree, printAst } from './clean';
