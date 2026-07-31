import { detectLanguage } from './highlight';
import type { DiffHunk, DiffLine, DiffOptions, DiffResult } from './types';

interface LCSResult {
  oldIndices: number[];
  newIndices: number[];
}

function computeLCS(oldLines: string[], newLines: string[], ignoreWhitespace: boolean, ignoreCase: boolean): LCSResult {
  const normalize = (line: string): string => {
    let result = line;
    if (ignoreWhitespace) {
      result = result.replace(/\s+/g, ' ').trim();
    }
    if (ignoreCase) {
      result = result.toLowerCase();
    }
    return result;
  };

  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (normalize(oldLines[i - 1]) === normalize(newLines[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const oldIndices: number[] = [];
  const newIndices: number[] = [];

  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (normalize(oldLines[i - 1]) === normalize(newLines[j - 1])) {
      oldIndices.unshift(i - 1);
      newIndices.unshift(j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return { oldIndices, newIndices };
}

function createDiffLines(
  oldLines: string[],
  newLines: string[],
  lcs: LCSResult
): DiffLine[] {
  const result: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const nextOldLCS = lcsIdx < lcs.oldIndices.length ? lcs.oldIndices[lcsIdx] : oldLines.length;
    const nextNewLCS = lcsIdx < lcs.newIndices.length ? lcs.newIndices[lcsIdx] : newLines.length;

    while (oldIdx < nextOldLCS) {
      result.push({
        type: 'removed',
        content: oldLines[oldIdx],
        oldLineNumber: oldIdx + 1
      });
      oldIdx++;
    }

    while (newIdx < nextNewLCS) {
      result.push({
        type: 'added',
        content: newLines[newIdx],
        newLineNumber: newIdx + 1
      });
      newIdx++;
    }

    if (lcsIdx < lcs.oldIndices.length) {
      result.push({
        type: 'unchanged',
        content: newLines[newIdx],
        oldLineNumber: oldIdx + 1,
        newLineNumber: newIdx + 1
      });
      oldIdx++;
      newIdx++;
      lcsIdx++;
    }
  }

  return result;
}

function groupIntoHunks(lines: DiffLine[], context: number): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let unchangedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isChange = line.type === 'added' || line.type === 'removed';

    if (isChange) {
      if (!currentHunk) {
        const contextStart = Math.max(0, i - context);
        const contextLines = lines.slice(contextStart, i);

        const firstOldLine = contextLines.find(l => l.oldLineNumber !== undefined);
        const firstNewLine = contextLines.find(l => l.newLineNumber !== undefined);

        currentHunk = {
          oldStart: firstOldLine?.oldLineNumber || line.oldLineNumber || 1,
          oldCount: 0,
          newStart: firstNewLine?.newLineNumber || line.newLineNumber || 1,
          newCount: 0,
          lines: [...contextLines]
        };

        for (const cl of contextLines) {
          if (cl.oldLineNumber !== undefined) currentHunk.oldCount++;
          if (cl.newLineNumber !== undefined) currentHunk.newCount++;
        }
      }

      currentHunk.lines.push(line);
      if (line.oldLineNumber !== undefined) currentHunk.oldCount++;
      if (line.newLineNumber !== undefined) currentHunk.newCount++;
      unchangedCount = 0;
    } else {
      if (currentHunk) {
        unchangedCount++;
        if (unchangedCount <= context * 2) {
          currentHunk.lines.push(line);
          if (line.oldLineNumber !== undefined) currentHunk.oldCount++;
          if (line.newLineNumber !== undefined) currentHunk.newCount++;
        }

        if (unchangedCount > context * 2) {
          const excess = unchangedCount - context;
          for (let j = 0; j < excess - 1; j++) {
            const removed = currentHunk.lines.pop();
            if (removed) {
              if (removed.oldLineNumber !== undefined) currentHunk.oldCount--;
              if (removed.newLineNumber !== undefined) currentHunk.newCount--;
            }
          }
          hunks.push(currentHunk);
          currentHunk = null;
          unchangedCount = 0;
        }
      }
    }
  }

  if (currentHunk && currentHunk.lines.some(l => l.type !== 'unchanged')) {
    while (
      currentHunk.lines.length > 0 &&
      currentHunk.lines[currentHunk.lines.length - 1].type === 'unchanged' &&
      unchangedCount > context
    ) {
      const removed = currentHunk.lines.pop();
      if (removed) {
        if (removed.oldLineNumber !== undefined) currentHunk.oldCount--;
        if (removed.newLineNumber !== undefined) currentHunk.newCount--;
      }
      unchangedCount--;
    }
    hunks.push(currentHunk);
  }

  return hunks;
}

export function diff(
  oldContent: string,
  newContent: string,
  options: DiffOptions = {}
): DiffResult {
  const { context = 3, ignoreWhitespace = false, ignoreCase = false } = options;

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  if (oldLines[oldLines.length - 1] === '') oldLines.pop();
  if (newLines[newLines.length - 1] === '') newLines.pop();

  const lcs = computeLCS(oldLines, newLines, ignoreWhitespace, ignoreCase);
  const diffLines = createDiffLines(oldLines, newLines, lcs);
  const hunks = groupIntoHunks(diffLines, context);

  return { hunks };
}

export function diffFiles(
  oldContent: string,
  newContent: string,
  oldFile: string,
  newFile: string,
  options: DiffOptions = {}
): DiffResult {
  const result = diff(oldContent, newContent, options);
  result.oldFile = oldFile;
  result.newFile = newFile;
  result.language = detectLanguage(newFile) || detectLanguage(oldFile);
  return result;
}

export function createUnifiedDiff(result: DiffResult): string {
  const lines: string[] = [];

  if (result.oldFile || result.newFile) {
    lines.push(`--- ${result.oldFile || 'a'}`);
    lines.push(`+++ ${result.newFile || 'b'}`);
  }

  for (const hunk of result.hunks) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`);

    for (const line of hunk.lines) {
      switch (line.type) {
      case 'added':
        lines.push(`+${line.content}`);
        break;
      case 'removed':
        lines.push(`-${line.content}`);
        break;
      case 'unchanged':
        lines.push(` ${line.content}`);
        break;
      }
    }
  }

  return lines.join('\n');
}

export function parseUnifiedDiff(diffText: string): DiffResult {
  const lines = diffText.split('\n');
  const result: DiffResult = { hunks: [] };
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    if (line.startsWith('---')) {
      result.oldFile = line.slice(4).trim();
    } else if (line.startsWith('+++')) {
      result.newFile = line.slice(4).trim();
      if (result.newFile) {
        result.language = detectLanguage(result.newFile);
      }
    } else if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        if (currentHunk) {
          result.hunks.push(currentHunk);
        }
        currentHunk = {
          oldStart: parseInt(match[1], 10),
          oldCount: parseInt(match[2] || '1', 10),
          newStart: parseInt(match[3], 10),
          newCount: parseInt(match[4] || '1', 10),
          lines: []
        };
        oldLineNum = currentHunk.oldStart;
        newLineNum = currentHunk.newStart;
      }
    } else if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'added',
          content: line.slice(1),
          newLineNumber: newLineNum++
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'removed',
          content: line.slice(1),
          oldLineNumber: oldLineNum++
        });
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'unchanged',
          content: line.slice(1),
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++
        });
      }
    }
  }

  if (currentHunk) {
    result.hunks.push(currentHunk);
  }

  return result;
}

export function hasDifferences(result: DiffResult): boolean {
  return result.hunks.some(hunk =>
    hunk.lines.some(line => line.type === 'added' || line.type === 'removed')
  );
}

export function countChanges(result: DiffResult): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const hunk of result.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') additions++;
      if (line.type === 'removed') deletions++;
    }
  }

  return { additions, deletions };
}
