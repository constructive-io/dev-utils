/**
 * Position in source code
 */
export interface Position {
  line: number;
  column: number;
  offset: number;
}

/**
 * Range in source code
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * Base node interface
 */
export interface BaseNode {
  type: string;
  range?: Range;
  /**
   * Set when the command is terminated by `&` and therefore runs in the
   * background. Only meaningful on command nodes.
   */
  async?: boolean;
}

/**
 * Script - root node containing a list of commands
 */
export interface Script extends BaseNode {
  type: 'Script';
  commands: Command[];
}

/**
 * Union type for all command types
 */
export type Command =
  | SimpleCommand
  | Pipeline
  | LogicalExpression
  | Subshell
  | BraceGroup
  | CompoundList
  | Comment
  | IfClause
  | WhileClause
  | UntilClause
  | ForClause
  | CaseClause
  | FunctionDefinition;

/**
 * Simple command (e.g., `echo hello`)
 */
export interface SimpleCommand extends BaseNode {
  type: 'SimpleCommand';
  name?: Word;
  prefix?: AssignmentWord[];
  suffix?: (Word | AssignmentWord | Redirect)[];
}

/**
 * Comment (`# ...`), retained only when the parser runs with `keepComments`
 */
export interface Comment extends BaseNode {
  type: 'Comment';
  text: string;
}

/**
 * Word - a token that can be expanded
 */
export interface Word extends BaseNode {
  type: 'Word';
  text: string;
  expansion?: Expansion[];
}

/**
 * Assignment word (e.g., `VAR=value`)
 */
export interface AssignmentWord extends BaseNode {
  type: 'AssignmentWord';
  text: string;
  expansion?: Expansion[];
}

/**
 * Union type for all expansion types
 */
export type Expansion =
  | ParameterExpansion
  | CommandSubstitution
  | ArithmeticExpansion;

/**
 * Parameter expansion (e.g., `$VAR`, `${VAR}`, `${VAR:-default}`)
 */
export interface ParameterExpansion extends BaseNode {
  type: 'ParameterExpansion';
  parameter: string;
  kind?: 'default' | 'assign' | 'error' | 'alternative' | 'length' | 'prefix' | 'suffix';
  word?: Word;
  op?: string;
}

/**
 * Command substitution (e.g., `$(command)` or `` `command` ``)
 */
export interface CommandSubstitution extends BaseNode {
  type: 'CommandSubstitution';
  command: Script;
  backtick?: boolean;
}

/**
 * Arithmetic expansion (e.g., `$((1 + 2))`)
 */
export interface ArithmeticExpansion extends BaseNode {
  type: 'ArithmeticExpansion';
  expression: string;
}

/**
 * Redirect (e.g., `> file`, `2>&1`, `< input`)
 */
export interface Redirect extends BaseNode {
  type: 'Redirect';
  op: RedirectOp;
  file?: Word;
  numberIo?: number;
  heredoc?: HereDoc;
}

/**
 * Redirect operators
 */
export type RedirectOp =
  | '>'
  | '>>'
  | '<'
  | '<<'
  | '<<-'
  | '<<<'
  | '<>'
  | '>&'
  | '<&'
  | '>|';

/**
 * Here document
 */
export interface HereDoc extends BaseNode {
  type: 'HereDoc';
  delimiter: string;
  content: string;
  quoted?: boolean;
}

/**
 * Pipeline (e.g., `cmd1 | cmd2 | cmd3`)
 */
export interface Pipeline extends BaseNode {
  type: 'Pipeline';
  commands: Command[];
  bang?: boolean;
}

/**
 * Logical expression (e.g., `cmd1 && cmd2`, `cmd1 || cmd2`)
 */
export interface LogicalExpression extends BaseNode {
  type: 'LogicalExpression';
  op: '&&' | '||';
  left: Command;
  right: Command;
}

/**
 * Subshell (e.g., `(cmd1; cmd2)`)
 */
export interface Subshell extends BaseNode {
  type: 'Subshell';
  list: CompoundList;
  redirects?: Redirect[];
}

/**
 * Brace group (e.g., `{ cmd1; cmd2; }`) — a single compound command, so it
 * survives pipelines, `&&`/`||`, `&` and redirection as one unit
 */
export interface BraceGroup extends BaseNode {
  type: 'BraceGroup';
  list: CompoundList;
  redirects?: Redirect[];
}

/**
 * Compound list - a list of commands
 */
export interface CompoundList extends BaseNode {
  type: 'CompoundList';
  commands: Command[];
}

/**
 * If clause
 */
export interface IfClause extends BaseNode {
  type: 'IfClause';
  condition: CompoundList;
  then: CompoundList;
  else?: CompoundList | IfClause;
  redirects?: Redirect[];
}

/**
 * While clause
 */
export interface WhileClause extends BaseNode {
  type: 'WhileClause';
  condition: CompoundList;
  body: CompoundList;
  redirects?: Redirect[];
}

/**
 * Until clause
 */
export interface UntilClause extends BaseNode {
  type: 'UntilClause';
  condition: CompoundList;
  body: CompoundList;
  redirects?: Redirect[];
}

/**
 * For clause
 */
export interface ForClause extends BaseNode {
  type: 'ForClause';
  name: string;
  wordlist?: Word[];
  body: CompoundList;
  redirects?: Redirect[];
}

/**
 * Case clause
 */
export interface CaseClause extends BaseNode {
  type: 'CaseClause';
  word: Word;
  cases: CaseItem[];
  redirects?: Redirect[];
}

/**
 * Case item
 */
export interface CaseItem extends BaseNode {
  type: 'CaseItem';
  pattern: Word[];
  body?: CompoundList;
}

/**
 * Function definition
 */
export interface FunctionDefinition extends BaseNode {
  type: 'FunctionDefinition';
  name: string;
  body: BraceGroup | Subshell;
}

/**
 * Union type for all AST nodes
 */
export type Node =
  | Script
  | Command
  | Word
  | AssignmentWord
  | Redirect
  | HereDoc
  | CompoundList
  | CaseItem;
