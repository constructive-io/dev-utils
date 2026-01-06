import { diff, diffFiles, createUnifiedDiff, parseUnifiedDiff, hasDifferences, countChanges } from '../src/diff';

describe('diff', () => {
  describe('basic diffing', () => {
    it('should detect no changes for identical content', () => {
      const content = 'line 1\nline 2\nline 3';
      const result = diff(content, content);

      expect(result.hunks).toHaveLength(0);
      expect(hasDifferences(result)).toBe(false);
    });

    it('should detect added lines', () => {
      const oldContent = 'line 1\nline 3';
      const newContent = 'line 1\nline 2\nline 3';
      const result = diff(oldContent, newContent);

      expect(hasDifferences(result)).toBe(true);
      const { additions, deletions } = countChanges(result);
      expect(additions).toBe(1);
      expect(deletions).toBe(0);
    });

    it('should detect removed lines', () => {
      const oldContent = 'line 1\nline 2\nline 3';
      const newContent = 'line 1\nline 3';
      const result = diff(oldContent, newContent);

      expect(hasDifferences(result)).toBe(true);
      const { additions, deletions } = countChanges(result);
      expect(additions).toBe(0);
      expect(deletions).toBe(1);
    });

    it('should detect modified lines', () => {
      const oldContent = 'line 1\nold line\nline 3';
      const newContent = 'line 1\nnew line\nline 3';
      const result = diff(oldContent, newContent);

      expect(hasDifferences(result)).toBe(true);
      const { additions, deletions } = countChanges(result);
      expect(additions).toBe(1);
      expect(deletions).toBe(1);
    });

    it('should handle empty content', () => {
      const result = diff('', '');
      expect(result.hunks).toHaveLength(0);
    });

    it('should handle adding content to empty file', () => {
      const result = diff('', 'new content');
      expect(hasDifferences(result)).toBe(true);
      const { additions } = countChanges(result);
      expect(additions).toBe(1);
    });

    it('should handle removing all content', () => {
      const result = diff('old content', '');
      expect(hasDifferences(result)).toBe(true);
      const { deletions } = countChanges(result);
      expect(deletions).toBe(1);
    });
  });

  describe('context lines', () => {
    it('should include context lines around changes', () => {
      const oldContent = 'line 1\nline 2\nline 3\nline 4\nline 5';
      const newContent = 'line 1\nline 2\nmodified\nline 4\nline 5';
      const result = diff(oldContent, newContent, { context: 2 });

      expect(result.hunks).toHaveLength(1);
      const hunk = result.hunks[0];
      const unchangedLines = hunk.lines.filter(l => l.type === 'unchanged');
      expect(unchangedLines.length).toBeGreaterThan(0);
    });

    it('should respect custom context size', () => {
      const oldContent = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
      const newContent = oldContent.replace('line 10', 'modified');
      
      const result1 = diff(oldContent, newContent, { context: 1 });
      const result3 = diff(oldContent, newContent, { context: 3 });

      expect(result1.hunks[0].lines.length).toBeLessThan(result3.hunks[0].lines.length);
    });
  });

  describe('options', () => {
    it('should ignore whitespace when option is set', () => {
      const oldContent = 'line 1\nline 2';
      const newContent = 'line 1\nline   2';
      
      const resultWithWhitespace = diff(oldContent, newContent, { ignoreWhitespace: false });
      const resultIgnoreWhitespace = diff(oldContent, newContent, { ignoreWhitespace: true });

      expect(hasDifferences(resultWithWhitespace)).toBe(true);
      expect(hasDifferences(resultIgnoreWhitespace)).toBe(false);
    });

    it('should ignore case when option is set', () => {
      const oldContent = 'Line 1\nLine 2';
      const newContent = 'line 1\nline 2';
      
      const resultWithCase = diff(oldContent, newContent, { ignoreCase: false });
      const resultIgnoreCase = diff(oldContent, newContent, { ignoreCase: true });

      expect(hasDifferences(resultWithCase)).toBe(true);
      expect(hasDifferences(resultIgnoreCase)).toBe(false);
    });
  });
});

describe('diffFiles', () => {
  it('should include file names in result', () => {
    const result = diffFiles('old', 'new', 'file.ts', 'file.ts');

    expect(result.oldFile).toBe('file.ts');
    expect(result.newFile).toBe('file.ts');
  });

  it('should detect language from file extension', () => {
    const result = diffFiles('const x = 1;', 'const x = 2;', 'file.ts', 'file.ts');
    expect(result.language).toBe('typescript');
  });

  it('should detect JavaScript language', () => {
    const result = diffFiles('var x = 1;', 'var x = 2;', 'file.js', 'file.js');
    expect(result.language).toBe('javascript');
  });

  it('should detect Python language', () => {
    const result = diffFiles('x = 1', 'x = 2', 'file.py', 'file.py');
    expect(result.language).toBe('python');
  });
});

describe('createUnifiedDiff', () => {
  it('should create valid unified diff format', () => {
    const result = diffFiles('line 1\nold line\nline 3', 'line 1\nnew line\nline 3', 'a.txt', 'b.txt');
    const unified = createUnifiedDiff(result);

    expect(unified).toContain('--- a.txt');
    expect(unified).toContain('+++ b.txt');
    expect(unified).toContain('@@');
    expect(unified).toContain('-old line');
    expect(unified).toContain('+new line');
  });

  it('should include hunk headers', () => {
    const result = diff('a\nb\nc', 'a\nx\nc');
    const unified = createUnifiedDiff(result);

    expect(unified).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
  });
});

describe('parseUnifiedDiff', () => {
  it('should parse unified diff format', () => {
    const diffText = `--- a.txt
+++ b.txt
@@ -1,3 +1,3 @@
 line 1
-old line
+new line
 line 3`;

    const result = parseUnifiedDiff(diffText);

    expect(result.oldFile).toBe('a.txt');
    expect(result.newFile).toBe('b.txt');
    expect(result.hunks).toHaveLength(1);
    expect(hasDifferences(result)).toBe(true);
  });

  it('should round-trip through create and parse', () => {
    const original = diffFiles('line 1\nold\nline 3', 'line 1\nnew\nline 3', 'a.txt', 'b.txt');
    const unified = createUnifiedDiff(original);
    const parsed = parseUnifiedDiff(unified);

    expect(parsed.oldFile).toBe(original.oldFile);
    expect(parsed.newFile).toBe(original.newFile);
    expect(countChanges(parsed)).toEqual(countChanges(original));
  });
});

describe('countChanges', () => {
  it('should count additions and deletions correctly', () => {
    const result = diff('a\nb\nc', 'a\nx\ny\nc');
    const { additions, deletions } = countChanges(result);

    expect(additions).toBe(2);
    expect(deletions).toBe(1);
  });

  it('should return zero for identical content', () => {
    const result = diff('same', 'same');
    const { additions, deletions } = countChanges(result);

    expect(additions).toBe(0);
    expect(deletions).toBe(0);
  });
});
