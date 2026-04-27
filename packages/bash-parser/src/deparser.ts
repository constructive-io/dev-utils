import {
  AssignmentWord,
  CaseClause,
  CaseItem,
  Command,
  CompoundList,
  ForClause,
  FunctionDefinition,
  IfClause,
  LogicalExpression,
  Node,
  Pipeline,
  Redirect,
  Script,
  SimpleCommand,
  Subshell,
  UntilClause,
  WhileClause,
  Word,
} from './types';

/**
 * Deparser options
 */
export interface DeparserOptions {
  newline?: string;
  indent?: string;
}

/**
 * Bash Deparser - converts AST back to source
 */
export class Deparser {
  private options: DeparserOptions;
  private indentLevel: number = 0;

  constructor(options: DeparserOptions = {}) {
    this.options = {
      newline: '\n',
      indent: '  ',
      ...options
    };
  }

  /**
   * Deparse AST to source string
   */
  deparse(node: Script | Node): string {
    if ('type' in node) {
      switch (node.type) {
      case 'Script':
        return this.deparseScript(node as Script);
      case 'SimpleCommand':
        return this.deparseSimpleCommand(node as SimpleCommand);
      case 'Pipeline':
        return this.deparsePipeline(node as Pipeline);
      case 'LogicalExpression':
        return this.deparseLogicalExpression(node as LogicalExpression);
      case 'Subshell':
        return this.deparseSubshell(node as Subshell);
      case 'CompoundList':
        return this.deparseCompoundList(node as CompoundList);
      case 'IfClause':
        return this.deparseIf(node as IfClause);
      case 'WhileClause':
        return this.deparseWhile(node as WhileClause);
      case 'UntilClause':
        return this.deparseUntil(node as UntilClause);
      case 'ForClause':
        return this.deparseFor(node as ForClause);
      case 'CaseClause':
        return this.deparseCase(node as CaseClause);
      case 'FunctionDefinition':
        return this.deparseFunction(node as FunctionDefinition);
      case 'Word':
        return this.deparseWord(node as Word);
      case 'AssignmentWord':
        return (node as AssignmentWord).text;
      case 'Redirect':
        return this.deparseRedirect(node as Redirect);
      default:
        throw new Error(`Unknown node type: ${(node as any).type}`);
      }
    }
    throw new Error('Invalid node');
  }

  /**
   * Get current indentation
   */
  private getIndent(): string {
    return this.options.indent!.repeat(this.indentLevel);
  }

  /**
   * Deparse script
   */
  private deparseScript(script: Script): string {
    return script.commands
      .map(cmd => this.deparseCommand(cmd))
      .join(this.options.newline);
  }

  /**
   * Deparse any command
   */
  private deparseCommand(command: Command): string {
    switch (command.type) {
    case 'SimpleCommand':
      return this.deparseSimpleCommand(command);
    case 'Pipeline':
      return this.deparsePipeline(command);
    case 'LogicalExpression':
      return this.deparseLogicalExpression(command);
    case 'Subshell':
      return this.deparseSubshell(command);
    case 'CompoundList':
      return this.deparseCompoundList(command);
    case 'IfClause':
      return this.deparseIf(command);
    case 'WhileClause':
      return this.deparseWhile(command);
    case 'UntilClause':
      return this.deparseUntil(command);
    case 'ForClause':
      return this.deparseFor(command);
    case 'CaseClause':
      return this.deparseCase(command);
    case 'FunctionDefinition':
      return this.deparseFunction(command);
    default:
      throw new Error(`Unknown command type: ${(command as any).type}`);
    }
  }

  /**
   * Deparse simple command
   */
  private deparseSimpleCommand(cmd: SimpleCommand): string {
    const parts: string[] = [];

    // Prefix (assignments)
    if (cmd.prefix) {
      for (const assignment of cmd.prefix) {
        parts.push(assignment.text);
      }
    }

    // Command name
    if (cmd.name) {
      parts.push(this.deparseWord(cmd.name));
    }

    // Suffix (arguments and redirections)
    if (cmd.suffix) {
      for (const item of cmd.suffix) {
        if (item.type === 'Word') {
          parts.push(this.deparseWord(item));
        } else if (item.type === 'Redirect') {
          parts.push(this.deparseRedirect(item));
        }
      }
    }

    return parts.join(' ');
  }

  /**
   * Deparse word
   */
  private deparseWord(word: Word): string {
    return word.text;
  }

  /**
   * Deparse redirect
   */
  private deparseRedirect(redirect: Redirect): string {
    let result = '';

    if (redirect.numberIo !== undefined) {
      result += redirect.numberIo;
    }

    result += redirect.op;

    if (redirect.file) {
      result += this.deparseWord(redirect.file);
    }

    return result;
  }

  /**
   * Deparse pipeline
   */
  private deparsePipeline(pipeline: Pipeline): string {
    const parts: string[] = [];

    if (pipeline.bang) {
      parts.push('!');
    }

    parts.push(
      pipeline.commands
        .map(cmd => this.deparseCommand(cmd))
        .join(' | ')
    );

    return parts.join(' ');
  }

  /**
   * Deparse logical expression
   */
  private deparseLogicalExpression(expr: LogicalExpression): string {
    const left = this.deparseCommand(expr.left);
    const right = this.deparseCommand(expr.right);
    return `${left} ${expr.op} ${right}`;
  }

  /**
   * Deparse subshell
   */
  private deparseSubshell(subshell: Subshell): string {
    const list = this.deparseCompoundListInline(subshell.list);
    return `(${list})`;
  }

  /**
   * Deparse compound list
   */
  private deparseCompoundList(list: CompoundList): string {
    return list.commands
      .map(cmd => this.deparseCommand(cmd))
      .join('; ');
  }

  /**
   * Deparse compound list inline (for subshells, etc.)
   */
  private deparseCompoundListInline(list: CompoundList): string {
    return list.commands
      .map(cmd => this.deparseCommand(cmd))
      .join('; ');
  }

  /**
   * Deparse if clause
   */
  private deparseIf(ifClause: IfClause): string {
    const parts: string[] = [];

    parts.push('if');
    parts.push(this.deparseCompoundListInline(ifClause.condition));
    parts.push('; then');
    parts.push(this.deparseCompoundListInline(ifClause.then));

    if (ifClause.else) {
      if (ifClause.else.type === 'IfClause') {
        // elif
        parts.push('; el' + this.deparseIf(ifClause.else).substring(0));
        return parts.join(' ').replace('; elif', '; elif').replace('; fi; fi', '; fi');
      } else {
        parts.push('; else');
        parts.push(this.deparseCompoundListInline(ifClause.else));
      }
    }

    parts.push('; fi');

    return parts.join(' ');
  }

  /**
   * Deparse while clause
   */
  private deparseWhile(whileClause: WhileClause): string {
    const condition = this.deparseCompoundListInline(whileClause.condition);
    const body = this.deparseCompoundListInline(whileClause.body);
    return `while ${condition}; do ${body}; done`;
  }

  /**
   * Deparse until clause
   */
  private deparseUntil(untilClause: UntilClause): string {
    const condition = this.deparseCompoundListInline(untilClause.condition);
    const body = this.deparseCompoundListInline(untilClause.body);
    return `until ${condition}; do ${body}; done`;
  }

  /**
   * Deparse for clause
   */
  private deparseFor(forClause: ForClause): string {
    const parts: string[] = ['for', forClause.name];

    if (forClause.wordlist && forClause.wordlist.length > 0) {
      parts.push('in');
      parts.push(forClause.wordlist.map(w => this.deparseWord(w)).join(' '));
    }

    parts.push(';');
    parts.push('do');
    parts.push(this.deparseCompoundListInline(forClause.body));
    parts.push(';');
    parts.push('done');

    return parts.join(' ');
  }

  /**
   * Deparse case clause
   */
  private deparseCase(caseClause: CaseClause): string {
    const parts: string[] = [];

    parts.push('case');
    parts.push(this.deparseWord(caseClause.word));
    parts.push('in');

    for (const caseItem of caseClause.cases) {
      parts.push(this.deparseCaseItem(caseItem));
    }

    parts.push('esac');

    return parts.join(' ');
  }

  /**
   * Deparse case item
   */
  private deparseCaseItem(caseItem: CaseItem): string {
    const pattern = caseItem.pattern.map(w => this.deparseWord(w)).join('|');
    let result = `${pattern})`;

    if (caseItem.body) {
      result += ' ' + this.deparseCompoundListInline(caseItem.body);
    }

    result += ' ;;';

    return result;
  }

  /**
   * Deparse function definition
   */
  private deparseFunction(func: FunctionDefinition): string {
    const body = func.body.type === 'Subshell'
      ? this.deparseSubshell(func.body)
      : `{ ${this.deparseCompoundListInline(func.body)}; }`;

    return `${func.name}() ${body}`;
  }
}

/**
 * Deparse AST to source string
 */
export function deparse(node: Script | Node, options?: DeparserOptions): string {
  const deparser = new Deparser(options);
  return deparser.deparse(node);
}

/**
 * Synchronous deparse (same as deparse, for API consistency)
 */
export const deparseSync = deparse;
