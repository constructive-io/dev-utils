export {
  countChanges,
  createUnifiedDiff,
  diff,
  diffFiles,
  hasDifferences,
  parseUnifiedDiff} from './diff';
export {
  detectLanguage,
  highlightLine,
  tokenize} from './highlight';
export {
  renderHtml,
  renderHtmlDocument,
  renderHtmlSideBySide,
  renderTerminal,
  renderTerminalCompact,
  renderTerminalSummary} from './render';
export {
  createTheme,
  defaultTheme,
  draculaTheme,
  getTheme,
  githubTheme,
  minimalTheme,
  monokaiTheme,
  nordTheme,
  themes} from './themes';
export type {
  ColorConfig,
  DiffHunk,
  DiffLine,
  DiffLineType,
  DiffOptions,
  DiffResult,
  HtmlRenderOptions,
  Language,
  PartialThemeColors,
  RenderOptions,
  SyntaxColors,
  SyntaxToken,
  TerminalRenderOptions,
  Theme,
  ThemeColors,
  TokenType} from './types';

export function visualDiff(
  oldContent: string,
  newContent: string,
  options: {
    oldFile?: string;
    newFile?: string;
    language?: string;
    theme?: string;
    format?: 'terminal' | 'html' | 'unified';
    context?: number;
  } = {}
): string {
  const { diff, diffFiles } = require('./diff');
  const { renderTerminal } = require('./render/terminal');
  const { renderHtml } = require('./render/html');
  const { createUnifiedDiff } = require('./diff');

  const result = options.oldFile || options.newFile
    ? diffFiles(oldContent, newContent, options.oldFile || 'a', options.newFile || 'b', { context: options.context })
    : diff(oldContent, newContent, { context: options.context });

  if (options.language) {
    result.language = options.language;
  }

  switch (options.format) {
  case 'html':
    return renderHtml(result, { theme: options.theme });
  case 'unified':
    return createUnifiedDiff(result);
  case 'terminal':
  default:
    return renderTerminal(result, { theme: options.theme });
  }
}
