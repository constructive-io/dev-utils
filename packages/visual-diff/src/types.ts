export type DiffLineType = 'added' | 'removed' | 'unchanged' | 'header';

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffResult {
  oldFile?: string;
  newFile?: string;
  hunks: DiffHunk[];
  language?: string;
}

export interface DiffOptions {
  context?: number;
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
}

export type Language =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'json'
  | 'html'
  | 'css'
  | 'sql'
  | 'yaml'
  | 'markdown'
  | 'go'
  | 'rust'
  | 'java'
  | 'c'
  | 'cpp'
  | 'shell'
  | 'plaintext';

export interface SyntaxToken {
  type: TokenType;
  value: string;
}

export type TokenType =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'operator'
  | 'punctuation'
  | 'function'
  | 'variable'
  | 'type'
  | 'property'
  | 'constant'
  | 'tag'
  | 'attribute'
  | 'text';

export interface Theme {
  name: string;
  colors: ThemeColors;
}

export interface ThemeColors {
  added: ColorConfig;
  removed: ColorConfig;
  unchanged: ColorConfig;
  lineNumber: ColorConfig;
  header: ColorConfig;
  syntax: SyntaxColors;
}

export interface ColorConfig {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
}

export interface SyntaxColors {
  keyword: ColorConfig;
  string: ColorConfig;
  number: ColorConfig;
  comment: ColorConfig;
  operator: ColorConfig;
  punctuation: ColorConfig;
  function: ColorConfig;
  variable: ColorConfig;
  type: ColorConfig;
  property: ColorConfig;
  constant: ColorConfig;
  tag: ColorConfig;
  attribute: ColorConfig;
  text: ColorConfig;
}

export interface RenderOptions {
  theme?: Theme | string;
  showLineNumbers?: boolean;
  lineNumberWidth?: number;
  tabSize?: number;
  wrapLines?: boolean;
  maxWidth?: number;
  unified?: boolean;
  sideBySide?: boolean;
  syntaxHighlight?: boolean;
  language?: Language;
}

export interface TerminalRenderOptions extends RenderOptions {
  colorize?: boolean;
}

export interface HtmlRenderOptions extends RenderOptions {
  className?: string;
  inlineStyles?: boolean;
  darkMode?: boolean;
}

export interface PartialThemeColors {
  added?: ColorConfig;
  removed?: ColorConfig;
  unchanged?: ColorConfig;
  lineNumber?: ColorConfig;
  header?: ColorConfig;
  syntax?: Partial<SyntaxColors>;
}
