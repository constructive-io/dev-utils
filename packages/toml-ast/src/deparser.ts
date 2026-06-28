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
  RootItem,
  StringValue,
  Table,
  TableItem,
  TomlDocument,
  Value,
} from './types';

export interface DeparseOptions {
  indent?: string;
  newline?: string;
}

const DEFAULT_OPTIONS: Required<DeparseOptions> = {
  indent: '  ',
  newline: '\n',
};

export class Deparser {
  private options: Required<DeparseOptions>;

  constructor(options?: DeparseOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  deparse(ast: TomlDocument): string {
    const sections: string[] = [];

    for (const item of ast.body) {
      sections.push(this.deparseRootItem(item));
    }

    return this.joinSections(sections);
  }

  private joinSections(sections: string[]): string {
    const result: string[] = [];
    let prevWasTable = false;

    for (const section of sections) {
      if (section.startsWith('[') && result.length > 0 && !prevWasTable) {
        result.push('');
      }
      result.push(section);
      prevWasTable = section.startsWith('[');
      if (prevWasTable) prevWasTable = false;
    }

    return result.join(this.options.newline);
  }

  private deparseRootItem(item: RootItem): string {
    switch (item.type) {
    case 'Comment':
      return this.deparseComment(item);
    case 'KeyValue':
      return this.deparseKeyValue(item);
    case 'Table':
      return this.deparseTable(item);
    case 'ArrayOfTables':
      return this.deparseArrayOfTables(item);
    default:
      return '';
    }
  }

  private deparseComment(comment: Comment): string {
    return `# ${comment.value}`;
  }

  private deparseKeyValue(kv: KeyValue): string {
    const key = this.deparseKey(kv.key);
    const value = this.deparseValue(kv.value);
    return `${key} = ${value}`;
  }

  private deparseTable(table: Table): string {
    const header = `[${this.deparseKey(table.key)}]`;
    const body = this.deparseTableBody(table.body);
    if (body) {
      return `${header}${this.options.newline}${body}`;
    }
    return header;
  }

  private deparseArrayOfTables(aot: ArrayOfTables): string {
    const header = `[[${this.deparseKey(aot.key)}]]`;
    const body = this.deparseTableBody(aot.body);
    if (body) {
      return `${header}${this.options.newline}${body}`;
    }
    return header;
  }

  private deparseTableBody(items: TableItem[]): string {
    const lines: string[] = [];
    for (const item of items) {
      switch (item.type) {
      case 'Comment':
        lines.push(this.deparseComment(item));
        break;
      case 'KeyValue':
        lines.push(this.deparseKeyValue(item));
        break;
      }
    }
    return lines.join(this.options.newline);
  }

  private deparseKey(key: Key): string {
    return key.parts.map((p) => this.deparseKeyPart(p)).join('.');
  }

  private deparseKeyPart(part: KeyPart): string {
    switch (part.style) {
    case 'bare':
      return part.value;
    case 'basic':
      return `"${this.escapeBasicString(part.value)}"`;
    case 'literal':
      return `'${part.value}'`;
    default:
      return part.value;
    }
  }

  private deparseValue(value: Value): string {
    switch (value.type) {
    case 'StringValue':
      return this.deparseString(value);
    case 'IntegerValue':
      return this.deparseInteger(value);
    case 'FloatValue':
      return this.deparseFloat(value);
    case 'BooleanValue':
      return this.deparseBoolean(value);
    case 'DateTimeValue':
      return this.deparseDateTime(value);
    case 'ArrayValue':
      return this.deparseArray(value);
    case 'InlineTable':
      return this.deparseInlineTable(value);
    default:
      return '';
    }
  }

  private deparseString(str: StringValue): string {
    switch (str.style) {
    case 'basic':
      return `"${this.escapeBasicString(str.value)}"`;
    case 'literal':
      return `'${str.value}'`;
    case 'basic-multiline':
      return `"""${this.options.newline}${this.escapeBasicString(str.value)}"""`;
    case 'literal-multiline':
      return `'''${this.options.newline}${str.value}'''`;
    default:
      return `"${this.escapeBasicString(str.value)}"`;
    }
  }

  private deparseInteger(int: IntegerValue): string {
    return int.raw;
  }

  private deparseFloat(float: FloatValue): string {
    return float.raw;
  }

  private deparseBoolean(bool: BooleanValue): string {
    return bool.value ? 'true' : 'false';
  }

  private deparseDateTime(dt: DateTimeValue): string {
    return dt.value;
  }

  private deparseArray(arr: ArrayValue): string {
    if (arr.elements.length === 0) return '[]';

    const hasComplex = arr.elements.some(
      (e) => e.type === 'ArrayValue' || e.type === 'InlineTable'
    );

    if (hasComplex || arr.elements.length > 3) {
      const items = arr.elements.map((e) => `${this.options.indent}${this.deparseValue(e)},`);
      return `[${this.options.newline}${items.join(this.options.newline)}${this.options.newline}]`;
    }

    const items = arr.elements.map((e) => this.deparseValue(e));
    return `[${items.join(', ')}]`;
  }

  private deparseInlineTable(table: InlineTable): string {
    if (table.entries.length === 0) return '{}';

    const items = table.entries.map((kv) => {
      const key = this.deparseKey(kv.key);
      const value = this.deparseValue(kv.value);
      return `${key} = ${value}`;
    });

    return `{ ${items.join(', ')} }`;
  }

  private escapeBasicString(str: string): string {
    let result = '';
    for (const char of str) {
      switch (char) {
      case '\\': result += '\\\\'; break;
      case '"': result += '\\"'; break;
      case '\b': result += '\\b'; break;
      case '\t': result += '\\t'; break;
      case '\n': result += '\\n'; break;
      case '\f': result += '\\f'; break;
      case '\r': result += '\\r'; break;
      default: result += char; break;
      }
    }
    return result;
  }
}

export function deparse(ast: TomlDocument, options?: DeparseOptions): string {
  const deparser = new Deparser(options);
  return deparser.deparse(ast);
}
