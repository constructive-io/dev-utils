import type {
  DiffResult,
  DiffLine,
  DiffHunk,
  Theme,
  ColorConfig,
  SyntaxToken,
  HtmlRenderOptions,
  Language
} from '../types';
import { getTheme } from '../themes';
import { highlightLine } from '../highlight';

const colorToHex: Record<string, string> = {
  black: '#000000',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#abb2bf',
  gray: '#5c6370',
  grey: '#5c6370',
  blackBright: '#4b5263',
  redBright: '#be5046',
  greenBright: '#98c379',
  yellowBright: '#d19a66',
  blueBright: '#61afef',
  magentaBright: '#c678dd',
  cyanBright: '#56b6c2',
  whiteBright: '#ffffff',
  bgBlack: '#282c34',
  bgRed: '#3e1f1f',
  bgGreen: '#1f3e1f',
  bgYellow: '#3e3e1f',
  bgBlue: '#1f1f3e',
  bgMagenta: '#3e1f3e',
  bgCyan: '#1f3e3e',
  bgWhite: '#abb2bf'
};

const darkModeColors: Record<string, string> = {
  ...colorToHex,
  bgBlack: '#1e1e1e',
  bgRed: '#4a2020',
  bgGreen: '#204a20',
  white: '#d4d4d4',
  gray: '#808080'
};

const lightModeColors: Record<string, string> = {
  black: '#24292e',
  red: '#d73a49',
  green: '#22863a',
  yellow: '#b08800',
  blue: '#0366d6',
  magenta: '#6f42c1',
  cyan: '#1b7c83',
  white: '#24292e',
  gray: '#6a737d',
  grey: '#6a737d',
  blackBright: '#586069',
  redBright: '#cb2431',
  greenBright: '#28a745',
  yellowBright: '#dbab09',
  blueBright: '#2188ff',
  magentaBright: '#8a63d2',
  cyanBright: '#3192aa',
  whiteBright: '#24292e',
  bgBlack: '#ffffff',
  bgRed: '#ffeef0',
  bgGreen: '#e6ffed',
  bgYellow: '#fffbdd',
  bgBlue: '#f1f8ff',
  bgMagenta: '#f5f0ff',
  bgCyan: '#e8f7f7',
  bgWhite: '#f6f8fa'
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function colorConfigToStyle(config: ColorConfig, darkMode: boolean): string {
  const colors = darkMode ? darkModeColors : lightModeColors;
  const styles: string[] = [];

  if (config.fg) {
    const color = colors[config.fg] || colorToHex[config.fg] || config.fg;
    styles.push(`color: ${color}`);
  }
  if (config.bg) {
    const bgKey = config.bg.startsWith('bg') ? config.bg : `bg${config.bg.charAt(0).toUpperCase()}${config.bg.slice(1)}`;
    const color = colors[bgKey] || colorToHex[bgKey] || config.bg;
    styles.push(`background-color: ${color}`);
  }
  if (config.bold) styles.push('font-weight: bold');
  if (config.dim) styles.push('opacity: 0.7');
  if (config.italic) styles.push('font-style: italic');

  return styles.join('; ');
}

function tokenToHtml(token: SyntaxToken, theme: Theme, darkMode: boolean): string {
  const syntaxColors = theme.colors.syntax;
  const colorConfig = syntaxColors[token.type] || syntaxColors.text;
  const style = colorConfigToStyle(colorConfig, darkMode);
  const escaped = escapeHtml(token.value);

  if (style) {
    return `<span style="${style}">${escaped}</span>`;
  }
  return escaped;
}

function highlightContentHtml(content: string, language: Language, theme: Theme, darkMode: boolean): string {
  const tokens = highlightLine(content, language);
  return tokens.map(token => tokenToHtml(token, theme, darkMode)).join('');
}

function generateCss(theme: Theme, darkMode: boolean, className: string): string {
  const colors = darkMode ? darkModeColors : lightModeColors;
  const addedBg = darkMode ? '#1a3d1a' : '#e6ffed';
  const removedBg = darkMode ? '#3d1a1a' : '#ffeef0';
  const unchangedBg = darkMode ? '#1e1e1e' : '#ffffff';
  const headerBg = darkMode ? '#2d2d2d' : '#f1f8ff';
  const borderColor = darkMode ? '#404040' : '#e1e4e8';
  const lineNumColor = darkMode ? '#6e7681' : '#959da5';

  return `
.${className} {
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid ${borderColor};
  border-radius: 6px;
  overflow: hidden;
  background: ${unchangedBg};
}

.${className}-header {
  padding: 8px 12px;
  background: ${headerBg};
  border-bottom: 1px solid ${borderColor};
  font-weight: 600;
  color: ${darkMode ? '#e1e4e8' : '#24292e'};
}

.${className}-hunk-header {
  padding: 4px 12px;
  background: ${darkMode ? '#161b22' : '#f1f8ff'};
  color: ${darkMode ? '#79c0ff' : '#0366d6'};
  font-size: 11px;
  border-top: 1px solid ${borderColor};
}

.${className}-line {
  display: flex;
  min-height: 20px;
}

.${className}-line-number {
  flex-shrink: 0;
  width: 50px;
  padding: 0 8px;
  text-align: right;
  color: ${lineNumColor};
  background: ${darkMode ? '#161b22' : '#fafbfc'};
  border-right: 1px solid ${borderColor};
  user-select: none;
}

.${className}-line-content {
  flex: 1;
  padding: 0 12px;
  white-space: pre;
  overflow-x: auto;
}

.${className}-line-added {
  background: ${addedBg};
}

.${className}-line-added .${className}-line-number {
  background: ${darkMode ? '#1a3d1a' : '#cdffd8'};
  color: ${darkMode ? '#7ee787' : '#22863a'};
}

.${className}-line-removed {
  background: ${removedBg};
}

.${className}-line-removed .${className}-line-number {
  background: ${darkMode ? '#3d1a1a' : '#ffdce0'};
  color: ${darkMode ? '#f85149' : '#cb2431'};
}

.${className}-line-unchanged {
  background: ${unchangedBg};
}

.${className}-prefix {
  display: inline-block;
  width: 16px;
  text-align: center;
  user-select: none;
}

.${className}-prefix-added {
  color: ${darkMode ? '#7ee787' : '#22863a'};
}

.${className}-prefix-removed {
  color: ${darkMode ? '#f85149' : '#cb2431'};
}

.${className}-side-by-side {
  display: flex;
}

.${className}-side {
  flex: 1;
  overflow-x: auto;
}

.${className}-side:first-child {
  border-right: 1px solid ${borderColor};
}

.${className}-summary {
  padding: 8px 12px;
  background: ${headerBg};
  border-top: 1px solid ${borderColor};
  font-size: 11px;
}

.${className}-additions {
  color: ${darkMode ? '#7ee787' : '#22863a'};
}

.${className}-deletions {
  color: ${darkMode ? '#f85149' : '#cb2431'};
}
`;
}

function renderLineHtml(
  line: DiffLine,
  theme: Theme,
  options: HtmlRenderOptions,
  language: Language,
  className: string
): string {
  const { showLineNumbers = true, syntaxHighlight = true, darkMode = true } = options;

  let lineClass = `${className}-line`;
  let prefixClass = `${className}-prefix`;
  let prefix = ' ';

  switch (line.type) {
    case 'added':
      lineClass += ` ${className}-line-added`;
      prefixClass += ` ${className}-prefix-added`;
      prefix = '+';
      break;
    case 'removed':
      lineClass += ` ${className}-line-removed`;
      prefixClass += ` ${className}-prefix-removed`;
      prefix = '-';
      break;
    case 'unchanged':
    default:
      lineClass += ` ${className}-line-unchanged`;
      break;
  }

  const parts: string[] = [];
  parts.push(`<div class="${lineClass}">`);

  if (showLineNumbers) {
    const oldNum = line.oldLineNumber !== undefined ? String(line.oldLineNumber) : '';
    const newNum = line.newLineNumber !== undefined ? String(line.newLineNumber) : '';
    parts.push(`<span class="${className}-line-number">${oldNum}</span>`);
    parts.push(`<span class="${className}-line-number">${newNum}</span>`);
  }

  parts.push(`<span class="${className}-line-content">`);
  parts.push(`<span class="${prefixClass}">${prefix}</span>`);

  if (syntaxHighlight && language !== 'plaintext') {
    parts.push(highlightContentHtml(line.content, language, theme, darkMode));
  } else {
    parts.push(escapeHtml(line.content));
  }

  parts.push('</span>');
  parts.push('</div>');

  return parts.join('');
}

function renderHunkHeaderHtml(hunk: DiffHunk, className: string): string {
  const header = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`;
  return `<div class="${className}-hunk-header">${escapeHtml(header)}</div>`;
}

export function renderHtml(result: DiffResult, options: HtmlRenderOptions = {}): string {
  const {
    theme: themeName = 'default',
    className = 'visual-diff',
    inlineStyles = true,
    darkMode = true,
    syntaxHighlight = true
  } = options;

  const theme = getTheme(themeName);
  const language = (options.language || result.language || 'plaintext') as Language;
  const parts: string[] = [];

  if (inlineStyles) {
    parts.push(`<style>${generateCss(theme, darkMode, className)}</style>`);
  }

  parts.push(`<div class="${className}">`);

  if (result.oldFile || result.newFile) {
    const fileInfo = result.oldFile && result.newFile
      ? `${result.oldFile} → ${result.newFile}`
      : result.newFile || result.oldFile;
    parts.push(`<div class="${className}-header">${escapeHtml(fileInfo || '')}</div>`);
  }

  for (const hunk of result.hunks) {
    parts.push(renderHunkHeaderHtml(hunk, className));

    for (const line of hunk.lines) {
      parts.push(renderLineHtml(line, theme, { ...options, syntaxHighlight }, language, className));
    }
  }

  let additions = 0;
  let deletions = 0;
  for (const hunk of result.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') additions++;
      if (line.type === 'removed') deletions++;
    }
  }

  parts.push(`<div class="${className}-summary">`);
  parts.push(`<span class="${className}-additions">+${additions}</span> `);
  parts.push(`<span class="${className}-deletions">-${deletions}</span>`);
  parts.push('</div>');

  parts.push('</div>');

  return parts.join('\n');
}

export function renderHtmlSideBySide(result: DiffResult, options: HtmlRenderOptions = {}): string {
  const {
    theme: themeName = 'default',
    className = 'visual-diff',
    inlineStyles = true,
    darkMode = true,
    syntaxHighlight = true
  } = options;

  const theme = getTheme(themeName);
  const language = (options.language || result.language || 'plaintext') as Language;
  const parts: string[] = [];

  if (inlineStyles) {
    parts.push(`<style>${generateCss(theme, darkMode, className)}</style>`);
  }

  parts.push(`<div class="${className}">`);

  if (result.oldFile || result.newFile) {
    parts.push(`<div class="${className}-header">`);
    parts.push(`<span>${escapeHtml(result.oldFile || 'Original')}</span>`);
    parts.push(' → ');
    parts.push(`<span>${escapeHtml(result.newFile || 'Modified')}</span>`);
    parts.push('</div>');
  }

  for (const hunk of result.hunks) {
    parts.push(renderHunkHeaderHtml(hunk, className));
    parts.push(`<div class="${className}-side-by-side">`);

    const oldLines = hunk.lines.filter(l => l.type !== 'added');
    const newLines = hunk.lines.filter(l => l.type !== 'removed');

    parts.push(`<div class="${className}-side">`);
    for (const line of oldLines) {
      const displayLine = { ...line };
      if (line.type === 'removed') {
        displayLine.newLineNumber = undefined;
      }
      parts.push(renderLineHtml(displayLine, theme, { ...options, syntaxHighlight }, language, className));
    }
    parts.push('</div>');

    parts.push(`<div class="${className}-side">`);
    for (const line of newLines) {
      const displayLine = { ...line };
      if (line.type === 'added') {
        displayLine.oldLineNumber = undefined;
      }
      parts.push(renderLineHtml(displayLine, theme, { ...options, syntaxHighlight }, language, className));
    }
    parts.push('</div>');

    parts.push('</div>');
  }

  parts.push('</div>');

  return parts.join('\n');
}

export function renderHtmlDocument(result: DiffResult, options: HtmlRenderOptions = {}): string {
  const { darkMode = true, className = 'visual-diff' } = options;
  const diffHtml = renderHtml(result, { ...options, inlineStyles: true });

  const bgColor = darkMode ? '#0d1117' : '#ffffff';
  const textColor = darkMode ? '#c9d1d9' : '#24292e';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Diff</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 20px;
      background: ${bgColor};
      color: ${textColor};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="container">
    ${diffHtml}
  </div>
</body>
</html>`;
}
