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
  ServerBlock,
  Statement,
  StreamBlock,
  TypesBlock,
  UpstreamBlock,
} from './types';

/**
 * Options for deparsing
 */
export interface DeparseOptions {
  indent?: string;
  newline?: string;
}

const DEFAULT_OPTIONS: Required<DeparseOptions> = {
  indent: '    ',
  newline: '\n',
};

/**
 * Deparser for nginx configuration AST
 */
export class Deparser {
  private options: Required<DeparseOptions>;
  private indentLevel: number = 0;

  constructor(options?: DeparseOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Deparse AST back to nginx configuration string
   */
  deparse(ast: NginxConfig): string {
    this.indentLevel = 0;
    return this.deparseStatements(ast.body);
  }

  private deparseStatements(statements: Statement[]): string {
    const lines: string[] = [];

    for (const stmt of statements) {
      const line = this.deparseStatement(stmt);
      if (line !== null) {
        lines.push(line);
      }
    }

    return lines.join(this.options.newline);
  }

  private deparseStatement(stmt: Statement): string | null {
    switch (stmt.type) {
    case 'Comment':
      return this.deparseComment(stmt);
    case 'Directive':
      return this.deparseDirective(stmt);
    case 'Block':
      return this.deparseBlock(stmt);
    case 'IfBlock':
      return this.deparseIfBlock(stmt);
    case 'MapBlock':
      return this.deparseMapBlock(stmt);
    case 'GeoBlock':
      return this.deparseGeoBlock(stmt);
    case 'UpstreamBlock':
      return this.deparseUpstreamBlock(stmt);
    case 'ServerBlock':
      return this.deparseServerBlock(stmt);
    case 'LocationBlock':
      return this.deparseLocationBlock(stmt);
    case 'HttpBlock':
      return this.deparseHttpBlock(stmt);
    case 'EventsBlock':
      return this.deparseEventsBlock(stmt);
    case 'StreamBlock':
      return this.deparseStreamBlock(stmt);
    case 'TypesBlock':
      return this.deparseTypesBlock(stmt);
    case 'LimitExceptBlock':
      return this.deparseLimitExceptBlock(stmt);
    default:
      return null;
    }
  }

  private deparseComment(comment: Comment): string {
    return `${this.getIndent()}# ${comment.value}`;
  }

  private deparseDirective(directive: Directive): string {
    const args = directive.args.length > 0 ? ' ' + this.formatArgs(directive.args) : '';
    return `${this.getIndent()}${directive.name}${args};`;
  }

  private deparseBlock(block: Block): string {
    const args = block.args.length > 0 ? ' ' + this.formatArgs(block.args) : '';
    const header = `${this.getIndent()}${block.name}${args} {`;
    const body = this.deparseBlockBody(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseIfBlock(block: IfBlock): string {
    // The condition already includes parentheses from parsing
    const condition = block.condition.startsWith('(') ? block.condition : `(${block.condition})`;
    const header = `${this.getIndent()}if ${condition} {`;
    const body = this.deparseBlockBody(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseMapBlock(block: MapBlock): string {
    const header = `${this.getIndent()}map ${block.source} ${block.variable} {`;
    const body = this.deparseMapEntries(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseMapEntries(entries: MapEntry[]): string {
    this.indentLevel++;
    const lines = entries.map((entry) => {
      return `${this.getIndent()}${entry.match} ${entry.value};`;
    });
    this.indentLevel--;
    return lines.join(this.options.newline);
  }

  private deparseGeoBlock(block: GeoBlock): string {
    const addressPart = block.address ? `${block.address} ` : '';
    const header = `${this.getIndent()}geo ${addressPart}${block.variable} {`;
    const body = this.deparseMapEntries(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseUpstreamBlock(block: UpstreamBlock): string {
    const header = `${this.getIndent()}upstream ${block.name} {`;
    const body = this.deparseBlockBody(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseServerBlock(block: ServerBlock): string {
    const header = `${this.getIndent()}server {`;
    const body = this.deparseBlockBody(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseLocationBlock(block: LocationBlock): string {
    let locationPart = 'location';
    if (block.modifier && block.modifier !== '@') {
      locationPart += ` ${block.modifier}`;
    }
    locationPart += ` ${block.path}`;

    const header = `${this.getIndent()}${locationPart} {`;
    const body = this.deparseBlockBody(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseHttpBlock(block: HttpBlock): string {
    const header = `${this.getIndent()}http {`;
    const body = this.deparseBlockBody(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseEventsBlock(block: EventsBlock): string {
    const header = `${this.getIndent()}events {`;
    const body = this.deparseBlockBody(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseStreamBlock(block: StreamBlock): string {
    const header = `${this.getIndent()}stream {`;
    const body = this.deparseBlockBody(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseTypesBlock(block: TypesBlock): string {
    const header = `${this.getIndent()}types {`;
    const body = this.deparseBlockBody(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseLimitExceptBlock(block: LimitExceptBlock): string {
    const methods = block.methods.join(' ');
    const header = `${this.getIndent()}limit_except ${methods} {`;
    const body = this.deparseBlockBody(block.body);
    const footer = `${this.getIndent()}}`;

    if (block.body.length === 0) {
      return `${header}${this.options.newline}${footer}`;
    }

    return `${header}${this.options.newline}${body}${this.options.newline}${footer}`;
  }

  private deparseBlockBody(statements: Statement[]): string {
    this.indentLevel++;
    const result = this.deparseStatements(statements);
    this.indentLevel--;
    return result;
  }

  private formatArgs(args: string[]): string {
    return args
      .map((arg) => {
        // Quote strings that contain spaces or special characters
        if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
          // Escape quotes and wrap in quotes
          const escaped = arg.replace(/"/g, '\\"');
          return `"${escaped}"`;
        }
        return arg;
      })
      .join(' ');
  }

  private getIndent(): string {
    return this.options.indent.repeat(this.indentLevel);
  }
}

/**
 * Deparse nginx AST back to configuration string
 */
export function deparse(ast: NginxConfig, options?: DeparseOptions): string {
  const deparser = new Deparser(options);
  return deparser.deparse(ast);
}
