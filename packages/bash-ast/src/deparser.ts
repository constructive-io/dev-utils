import {
  AssignmentWord,
  BraceGroup,
  CaseClause,
  CaseItem,
  Command,
  Comment,
  CompoundList,
  ForClause,
  FunctionDefinition,
  HereDoc,
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
 * A deparsed list of commands. `multiline` is set when the list cannot be
 * collapsed onto one line — because a statement is backgrounded, carries a
 * here-document body, or is a comment.
 */
interface DeparsedList {
  text: string;
  multiline: boolean;
}

/**
 * Bash Deparser - converts AST back to source
 */
export class Deparser {
  private options: DeparserOptions;

  /**
   * Here-document bodies owed by the statement currently being deparsed. They
   * are emitted after the line that opened them.
   */
  private heredocs: string[] = [];

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
      case 'Word':
        return this.deparseWord(node as Word);
      case 'AssignmentWord':
        return (node as AssignmentWord).text;
      case 'Redirect':
        return this.deparseRedirect(node as Redirect);
      case 'CaseItem':
        return this.deparseCaseItem(node as CaseItem);
      case 'HereDoc': {
        const heredoc = node as HereDoc;
        return heredoc.content + heredoc.delimiter;
      }
      default:
        return this.emitStatement(node as Command);
      }
    }
    throw new Error('Invalid node');
  }

  /**
   * Deparse script
   */
  private deparseScript(script: Script): string {
    return script.commands
      .map(cmd => this.emitStatement(cmd))
      .join(this.options.newline);
  }

  /**
   * Deparse one statement: the command itself, its `&`, and the bodies of any
   * here-documents it opened.
   */
  private emitStatement(command: Command): string {
    const owed = this.heredocs;
    this.heredocs = [];

    let text = this.deparseCommand(command);
    if (command.async) {
      text += ' &';
    }
    if (this.heredocs.length > 0) {
      text += '\n' + this.heredocs.join('\n');
    }

    this.heredocs = owed;
    return text;
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
    case 'BraceGroup':
      return this.deparseBraceGroup(command);
    case 'CompoundList':
      return this.deparseList(command).text;
    case 'Comment':
      return this.deparseComment(command);
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
      throw new Error(`Unknown command type: ${(command as { type: string }).type}`);
    }
  }

  /**
   * Deparse a list of commands, keeping it on one line when that is safe
   */
  private deparseList(list: CompoundList): DeparsedList {
    const parts = list.commands.map(cmd => this.emitStatement(cmd));
    const multiline = parts.some(part => part.includes('\n') || part.endsWith('&')) ||
      list.commands.some(cmd => cmd.type === 'Comment');
    return {
      text: parts.join(multiline ? '\n' : '; '),
      multiline
    };
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
        if (item.type === 'Word' || item.type === 'AssignmentWord') {
          parts.push(item.text);
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
   * Deparse comment
   */
  private deparseComment(comment: Comment): string {
    return `#${comment.text}`;
  }

  /**
   * Deparse redirect. A here-document's body is owed to the end of the
   * statement, so it is buffered rather than returned.
   */
  private deparseRedirect(redirect: Redirect): string {
    let result = '';

    if (redirect.numberIo !== undefined) {
      result += redirect.numberIo;
    }

    result += redirect.op;

    if (redirect.file) {
      result += this.deparseWord(redirect.file);
    } else if (redirect.heredoc) {
      result += redirect.heredoc.quoted
        ? `'${redirect.heredoc.delimiter}'`
        : redirect.heredoc.delimiter;
    }

    if (redirect.heredoc) {
      this.heredocs.push(redirect.heredoc.content + redirect.heredoc.delimiter);
    }

    return result;
  }

  /**
   * Deparse the redirections attached to a compound command
   */
  private deparseRedirects(redirects?: Redirect[]): string {
    if (!redirects || redirects.length === 0) {
      return '';
    }
    return ' ' + redirects.map(redirect => this.deparseRedirect(redirect)).join(' ');
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
    const list = this.deparseList(subshell.list);
    const body = list.multiline ? `(\n${list.text}\n)` : `(${list.text})`;
    return body + this.deparseRedirects(subshell.redirects);
  }

  /**
   * Deparse brace group. The braces are always emitted: they are what keeps
   * the group a single command inside a pipeline or after `&&`/`||`.
   */
  private deparseBraceGroup(group: BraceGroup): string {
    const list = this.deparseList(group.list);
    const body = list.multiline ? `{\n${list.text}\n}` : `{ ${list.text}; }`;
    return body + this.deparseRedirects(group.redirects);
  }

  /**
   * Render `<keyword> <list><separator><terminator>`, breaking the line when
   * the list cannot be inlined
   */
  private clause(keyword: string, list: DeparsedList, terminator: string): string {
    if (list.multiline) {
      return `${keyword} ${list.text}\n${terminator}`;
    }
    return `${keyword} ${list.text}; ${terminator}`;
  }

  /**
   * Deparse if clause
   */
  private deparseIf(ifClause: IfClause, keyword: string = 'if'): string {
    const condition = this.deparseList(ifClause.condition);
    const then = this.deparseList(ifClause.then);

    let elseText: string | undefined;
    let elseMultiline = false;

    if (ifClause.else) {
      if (ifClause.else.type === 'IfClause') {
        elseText = this.deparseIf(ifClause.else, 'elif');
        elseMultiline = elseText.includes('\n');
      } else {
        const elseList = this.deparseList(ifClause.else);
        elseText = elseList.text;
        elseMultiline = elseList.multiline;
      }
    }

    const multiline = condition.multiline || then.multiline || elseMultiline;
    const isElif = keyword === 'elif';

    if (!multiline) {
      const parts = [`${this.clause(keyword, condition, 'then')} ${then.text}`];
      if (elseText !== undefined) {
        parts.push(ifClause.else!.type === 'IfClause' ? elseText : `else ${elseText}`);
      }
      const body = parts.join('; ');
      return isElif ? body : `${body}; fi`;
    }

    const parts = [`${this.clause(keyword, condition, 'then')}\n${then.text}`];
    if (elseText !== undefined) {
      parts.push(ifClause.else!.type === 'IfClause' ? elseText : `else\n${elseText}`);
    }
    const body = parts.join('\n');
    return isElif ? body : `${body}\nfi`;
  }

  /**
   * Deparse while clause
   */
  private deparseWhile(whileClause: WhileClause): string {
    return this.deparseLoop('while', whileClause.condition, whileClause.body) +
      this.deparseRedirects(whileClause.redirects);
  }

  /**
   * Deparse until clause
   */
  private deparseUntil(untilClause: UntilClause): string {
    return this.deparseLoop('until', untilClause.condition, untilClause.body) +
      this.deparseRedirects(untilClause.redirects);
  }

  /**
   * Deparse `while`/`until`
   */
  private deparseLoop(keyword: string, conditionList: CompoundList, bodyList: CompoundList): string {
    const condition = this.deparseList(conditionList);
    const body = this.deparseList(bodyList);

    if (!condition.multiline && !body.multiline) {
      return `${keyword} ${condition.text}; do ${body.text}; done`;
    }

    return `${this.clause(keyword, condition, 'do')}\n${body.text}\ndone`;
  }

  /**
   * Deparse for clause
   */
  private deparseFor(forClause: ForClause): string {
    let head = `for ${forClause.name}`;

    if (forClause.wordlist && forClause.wordlist.length > 0) {
      head += ` in ${forClause.wordlist.map(word => this.deparseWord(word)).join(' ')}`;
    }

    const body = this.deparseList(forClause.body);
    const text = body.multiline
      ? `${head}; do\n${body.text}\ndone`
      : `${head}; do ${body.text}; done`;

    return text + this.deparseRedirects(forClause.redirects);
  }

  /**
   * Deparse case clause
   */
  private deparseCase(caseClause: CaseClause): string {
    const items = caseClause.cases.map(item => this.deparseCaseItem(item));
    const multiline = items.some(item => item.includes('\n'));
    const head = `case ${this.deparseWord(caseClause.word)} in`;

    const text = multiline
      ? `${head}\n${items.join('\n')}\nesac`
      : [head, ...items, 'esac'].join(' ');

    return text + this.deparseRedirects(caseClause.redirects);
  }

  /**
   * Deparse case item
   */
  private deparseCaseItem(caseItem: CaseItem): string {
    const pattern = caseItem.pattern.map(word => this.deparseWord(word)).join('|');
    let result = `${pattern})`;

    if (caseItem.body) {
      const body = this.deparseList(caseItem.body);
      result += body.multiline ? `\n${body.text}\n` : ` ${body.text} `;
    } else {
      result += ' ';
    }

    result += ';;';

    return result;
  }

  /**
   * Deparse function definition
   */
  private deparseFunction(func: FunctionDefinition): string {
    const body = func.body.type === 'Subshell'
      ? this.deparseSubshell(func.body)
      : this.deparseBraceGroup(func.body);

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
