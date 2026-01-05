export type {
  DiffLineType,
  DiffLine,
  DiffHunk,
  DiffResult,
  DiffOptions,
  Language,
  SyntaxToken,
  TokenType,
  Theme,
  ThemeColors,
  ColorConfig,
  SyntaxColors,
  RenderOptions,
  TerminalRenderOptions,
  HtmlRenderOptions,
  PartialThemeColors
} from './types';

export {
  diff,
  diffFiles,
  createUnifiedDiff,
  parseUnifiedDiff,
  hasDifferences,
  countChanges
} from './diff';

export {
  detectLanguage,
  tokenize,
  highlightLine
} from './highlight';

export {
  defaultTheme,
  githubTheme,
  monokaiTheme,
  draculaTheme,
  nordTheme,
  minimalTheme,
  themes,
  getTheme,
  createTheme
} from './themes';

export {
  renderTerminal,
  renderTerminalCompact,
  renderTerminalSummary,
  renderHtml,
  renderHtmlSideBySide,
  renderHtmlDocument
} from './render';

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
