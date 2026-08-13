import { execFileSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { cleanTree, deparse, parse } from '../src';

/**
 * Real `run:` blocks extracted from the GitHub Actions workflows of
 * constructive-io/constructive-db. Every one of them is valid Bash
 * (`bash -n`), so a parse failure or a changed AST is a bug in this package.
 */
const CORPUS_DIR = join(__dirname, '..', '__fixtures__', 'workflows');

/**
 * Hard budget per parse: a pathological input must fail, not hang.
 */
const TIMEOUT_MS = 5000;

const files = readdirSync(CORPUS_DIR).filter(file => file.endsWith('.sh')).sort();

/**
 * `bash -n` is the only impartial judge of whether emitted text is still
 * shell. Where bash is unavailable that check is skipped rather than faked.
 */
const hasBash = (() => {
  try {
    execFileSync('bash', ['-n'], { input: ':\n', stdio: ['pipe', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
})();

function expectValidBash(source: string): void {
  if (!hasBash) return;
  execFileSync('bash', ['-n'], { input: source, stdio: ['pipe', 'ignore', 'pipe'] });
}

describe('workflow corpus', () => {
  it('has the extracted blocks', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  describe.each(files)('%s', file => {
    const source = readFileSync(join(CORPUS_DIR, file), 'utf8');

    it('round trips without changing the AST, and deparses idempotently', () => {
      const first = parse(source, { keepComments: true, timeoutMs: TIMEOUT_MS });
      const deparsed = deparse(first);
      expectValidBash(deparsed);

      const second = parse(deparsed, { keepComments: true, timeoutMs: TIMEOUT_MS });

      expect(cleanTree(second)).toEqual(cleanTree(first));
      expect(deparse(second)).toEqual(deparsed);
    });
  });
});
