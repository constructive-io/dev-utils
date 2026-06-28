export interface Range {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  column: number;
}

export interface BaseNode {
  type: string;
  range?: Range;
}

export interface Comment extends BaseNode {
  type: 'Comment';
  value: string;
}

export interface TomlDocument extends BaseNode {
  type: 'TomlDocument';
  body: RootItem[];
}

export interface KeyValue extends BaseNode {
  type: 'KeyValue';
  key: Key;
  value: Value;
}

export interface Key extends BaseNode {
  type: 'Key';
  parts: KeyPart[];
}

export interface KeyPart extends BaseNode {
  type: 'KeyPart';
  value: string;
  style: 'bare' | 'basic' | 'literal';
}

export interface Table extends BaseNode {
  type: 'Table';
  key: Key;
  body: TableItem[];
}

export interface ArrayOfTables extends BaseNode {
  type: 'ArrayOfTables';
  key: Key;
  body: TableItem[];
}

export interface StringValue extends BaseNode {
  type: 'StringValue';
  value: string;
  style: 'basic' | 'literal' | 'basic-multiline' | 'literal-multiline';
}

export interface IntegerValue extends BaseNode {
  type: 'IntegerValue';
  value: number;
  raw: string;
}

export interface FloatValue extends BaseNode {
  type: 'FloatValue';
  value: number;
  raw: string;
}

export interface BooleanValue extends BaseNode {
  type: 'BooleanValue';
  value: boolean;
}

export interface DateTimeValue extends BaseNode {
  type: 'DateTimeValue';
  value: string;
  style: 'offset-datetime' | 'local-datetime' | 'local-date' | 'local-time';
}

export interface ArrayValue extends BaseNode {
  type: 'ArrayValue';
  elements: Value[];
}

export interface InlineTable extends BaseNode {
  type: 'InlineTable';
  entries: KeyValue[];
}

export type Value =
  | StringValue
  | IntegerValue
  | FloatValue
  | BooleanValue
  | DateTimeValue
  | ArrayValue
  | InlineTable;

export type TableItem = KeyValue | Comment;

export type RootItem = KeyValue | Table | ArrayOfTables | Comment;

export type AstNode =
  | TomlDocument
  | RootItem
  | TableItem
  | Value
  | Key
  | KeyPart;
