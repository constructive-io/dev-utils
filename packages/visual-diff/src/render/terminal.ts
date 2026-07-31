import yanse from 'yanse';

import { highlightLine } from '../highlight';
import {getTheme } from '../themes';
import type {
  ColorConfig,
  DiffHunk,
  DiffLine,
  DiffResult,
  Language,
  SyntaxToken,
  TerminalRenderOptions,
  Theme} from '../types';

type YanseColor = (str: string) => string;

function applyColor(config: ColorConfig, text: string): string {
  if (!config || Object.keys(config).length === 0) {
    return text;
  }

  let result = text;
  const y = yanse as any;

  if (config.bold) result = y.bold(result);
  if (config.dim) result = y.dim(result);
  if (config.italic) result = y.italic(result);
  if (config.fg && y[config.fg]) result = y[config.fg](result);
  if (config.bg && y[config.bg]) result = y[config.bg](result);

  return result;
}

function applyTokenColor(token: SyntaxToken, theme: Theme): string {
  const syntaxColors = theme.colors.syntax;
  const colorConfig = syntaxColors[token.type] || syntaxColors.text;
  return applyColor(colorConfig, token.value);
}

function highlightContent(content: string, language: Language, theme: Theme): string {
  const tokens = highlightLine(content, language);
  return tokens.map(token => applyTokenColor(token, theme)).join('');
}

function padLineNumber(num: number | undefined, width: number): string {
  if (num === undefined) {
    return ' '.repeat(width);
  }
  return String(num).padStart(width, ' ');
}

function renderLineUnified(
  line: DiffLine,
  theme: Theme,
  options: TerminalRenderOptions,
  language: Language
): string {
  const { showLineNumbers = true, lineNumberWidth = 4, syntaxHighlight = true } = options;

  let prefix: string;
  let lineColor: ColorConfig;

  switch (line.type) {
  case 'added':
    prefix = '+';
    lineColor = theme.colors.added;
    break;
  case 'removed':
    prefix = '-';
    lineColor = theme.colors.removed;
    break;
  case 'unchanged':
  default:
    prefix = ' ';
    lineColor = theme.colors.unchanged;
    break;
  }

  const parts: string[] = [];

  if (showLineNumbers) {
    const oldNum = padLineNumber(line.oldLineNumber, lineNumberWidth);
    const newNum = padLineNumber(line.newLineNumber, lineNumberWidth);
    const lineNumStr = `${oldNum} ${newNum}`;
    parts.push(applyColor(theme.colors.lineNumber, lineNumStr));
    parts.push(' ');
  }

  parts.push(applyColor(lineColor, prefix));
  parts.push(' ');

  let content = line.content;
  if (syntaxHighlight && language !== 'plaintext') {
    content = highlightContent(content, language, theme);
    const coloredContent = applyColor(
      { bg: lineColor.bg },
      content
    );
    parts.push(coloredContent);
  } else {
    parts.push(applyColor(lineColor, content));
  }

  return parts.join('');
}

function renderLineSideBySide(
  oldLine: DiffLine | null,
  newLine: DiffLine | null,
  theme: Theme,
  options: TerminalRenderOptions,
  language: Language
): string {
  const { lineNumberWidth = 4, maxWidth = 80, syntaxHighlight = true } = options;
  const halfWidth = Math.floor((maxWidth - 3) / 2);
  const contentWidth = halfWidth - lineNumberWidth - 3;

  const formatSide = (line: DiffLine | null, isOld: boolean): string => {
    if (!line) {
      return ' '.repeat(halfWidth);
    }

    const lineNum = isOld ? line.oldLineNumber : line.newLineNumber;
    const numStr = padLineNumber(lineNum, lineNumberWidth);

    let prefix: string;
    let lineColor: ColorConfig;

    if (isOld && line.type === 'removed') {
      prefix = '-';
      lineColor = theme.colors.removed;
    } else if (!isOld && line.type === 'added') {
      prefix = '+';
      lineColor = theme.colors.added;
    } else {
      prefix = ' ';
      lineColor = theme.colors.unchanged;
    }

    let content = line.content;
    if (content.length > contentWidth) {
      content = content.slice(0, contentWidth - 1) + '\u2026';
    }

    const paddedContent = content.padEnd(contentWidth, ' ');

    let displayContent: string;
    if (syntaxHighlight && language !== 'plaintext') {
      displayContent = highlightContent(paddedContent, language, theme);
    } else {
      displayContent = applyColor(lineColor, paddedContent);
    }

    return [
      applyColor(theme.colors.lineNumber, numStr),
      ' ',
      applyColor(lineColor, prefix),
      ' ',
      displayContent
    ].join('');
  };

  const leftSide = formatSide(oldLine, true);
  const rightSide = formatSide(newLine, false);
  const separator = applyColor({ dim: true }, '\u2502');

  return `${leftSide} ${separator} ${rightSide}`;
}

function renderHunkHeader(hunk: DiffHunk, theme: Theme): string {
  const header = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`;
  return applyColor(theme.colors.header, header);
}

function renderFileHeader(oldFile: string | undefined, newFile: string | undefined, theme: Theme): string[] {
  const lines: string[] = [];
  if (oldFile) {
    lines.push(applyColor(theme.colors.header, `--- ${oldFile}`));
  }
  if (newFile) {
    lines.push(applyColor(theme.colors.header, `+++ ${newFile}`));
  }
  return lines;
}

export function renderTerminal(result: DiffResult, options: TerminalRenderOptions = {}): string {
  const {
    theme: themeName = 'default',
    unified = true,
    sideBySide = false,
    colorize = true
  } = options;

  if (!colorize) {
    yanse.enabled = false;
  }

  const theme = getTheme(themeName);
  const language = (options.language || result.language || 'plaintext') as Language;
  const lines: string[] = [];

  lines.push(...renderFileHeader(result.oldFile, result.newFile, theme));

  for (const hunk of result.hunks) {
    lines.push('');
    lines.push(renderHunkHeader(hunk, theme));

    if (sideBySide && !unified) {
      let oldIdx = 0;
      let newIdx = 0;
      const oldLines = hunk.lines.filter(l => l.type !== 'added');
      const newLines = hunk.lines.filter(l => l.type !== 'removed');

      while (oldIdx < oldLines.length || newIdx < newLines.length) {
        const oldLine = oldIdx < oldLines.length ? oldLines[oldIdx] : null;
        const newLine = newIdx < newLines.length ? newLines[newIdx] : null;

        if (oldLine?.type === 'unchanged' && newLine?.type === 'unchanged') {
          lines.push(renderLineSideBySide(oldLine, newLine, theme, options, language));
          oldIdx++;
          newIdx++;
        } else {
          if (oldLine?.type === 'removed') {
            const matchingNew = newLine?.type === 'added' ? newLine : null;
            lines.push(renderLineSideBySide(oldLine, matchingNew, theme, options, language));
            oldIdx++;
            if (matchingNew) newIdx++;
          } else if (newLine?.type === 'added') {
            lines.push(renderLineSideBySide(null, newLine, theme, options, language));
            newIdx++;
          } else {
            lines.push(renderLineSideBySide(oldLine, newLine, theme, options, language));
            if (oldLine) oldIdx++;
            if (newLine) newIdx++;
          }
        }
      }
    } else {
      for (const line of hunk.lines) {
        lines.push(renderLineUnified(line, theme, options, language));
      }
    }
  }

  yanse.enabled = true;

  return lines.join('\n');
}

export function renderTerminalCompact(result: DiffResult, options: TerminalRenderOptions = {}): string {
  const theme = getTheme(options.theme || 'default');
  const language = (options.language || result.language || 'plaintext') as Language;
  const lines: string[] = [];

  for (const hunk of result.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'unchanged') continue;

      const prefix = line.type === 'added' ? '+' : '-';
      const lineColor = line.type === 'added' ? theme.colors.added : theme.colors.removed;
      const lineNum = line.type === 'added' ? line.newLineNumber : line.oldLineNumber;

      let content = line.content;
      if (options.syntaxHighlight !== false && language !== 'plaintext') {
        content = highlightContent(content, language, theme);
      }

      lines.push(
        applyColor(theme.colors.lineNumber, `${lineNum}:`.padStart(5, ' ')) +
        ' ' +
        applyColor(lineColor, prefix) +
        ' ' +
        content
      );
    }
  }

  return lines.join('\n');
}

export function renderTerminalSummary(result: DiffResult, options: TerminalRenderOptions = {}): string {
  const theme = getTheme(options.theme || 'default');

  let additions = 0;
  let deletions = 0;

  for (const hunk of result.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') additions++;
      if (line.type === 'removed') deletions++;
    }
  }

  const parts: string[] = [];

  if (result.oldFile && result.newFile) {
    parts.push(applyColor(theme.colors.header, `${result.oldFile} -> ${result.newFile}`));
  } else if (result.newFile) {
    parts.push(applyColor(theme.colors.header, result.newFile));
  }

  parts.push(
    applyColor(theme.colors.added, `+${additions}`) +
    ' ' +
    applyColor(theme.colors.removed, `-${deletions}`)
  );

  return parts.join(' ');
}
