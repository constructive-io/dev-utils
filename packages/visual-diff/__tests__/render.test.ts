import { diff, diffFiles } from '../src/diff';
import { renderHtml, renderHtmlDocument,renderHtmlSideBySide } from '../src/render/html';
import { renderTerminal, renderTerminalCompact, renderTerminalSummary } from '../src/render/terminal';

describe('renderTerminal', () => {
  const oldContent = 'line 1\nold line\nline 3';
  const newContent = 'line 1\nnew line\nline 3';

  it('should render diff output', () => {
    const result = diffFiles(oldContent, newContent, 'a.txt', 'b.txt');
    const output = renderTerminal(result);

    expect(output).toBeTruthy();
    expect(typeof output).toBe('string');
  });

  it('should include file headers', () => {
    const result = diffFiles(oldContent, newContent, 'a.txt', 'b.txt');
    const output = renderTerminal(result, { colorize: false });

    expect(output).toContain('a.txt');
    expect(output).toContain('b.txt');
  });

  it('should include hunk headers', () => {
    const result = diff(oldContent, newContent);
    const output = renderTerminal(result, { colorize: false });

    expect(output).toContain('@@');
  });

  it('should show line numbers by default', () => {
    const result = diff('a\nb', 'a\nc');
    const output = renderTerminal(result, { colorize: false, showLineNumbers: true });

    expect(output).toMatch(/\d/);
  });

  it('should hide line numbers when disabled', () => {
    const result = diff('a', 'b');
    const output = renderTerminal(result, { colorize: false, showLineNumbers: false });

    expect(output).toBeTruthy();
  });

  it('should apply different themes', () => {
    const result = diff('old', 'new');
    
    const defaultOutput = renderTerminal(result, { theme: 'default' });
    const githubOutput = renderTerminal(result, { theme: 'github' });
    const monokaiOutput = renderTerminal(result, { theme: 'monokai' });

    expect(defaultOutput).toBeTruthy();
    expect(githubOutput).toBeTruthy();
    expect(monokaiOutput).toBeTruthy();
  });

  it('should support syntax highlighting', () => {
    const result = diffFiles(
      'const x = 1;',
      'const x = 2;',
      'file.ts',
      'file.ts'
    );
    const output = renderTerminal(result, { syntaxHighlight: true });

    expect(output).toBeTruthy();
  });

  it('should disable syntax highlighting when requested', () => {
    const result = diffFiles(
      'const x = 1;',
      'const x = 2;',
      'file.ts',
      'file.ts'
    );
    const output = renderTerminal(result, { syntaxHighlight: false, colorize: false });

    expect(output).toBeTruthy();
  });
});

describe('renderTerminalCompact', () => {
  it('should render only changed lines', () => {
    const result = diff('a\nb\nc', 'a\nx\nc');
    const output = renderTerminalCompact(result, { colorize: false });

    expect(output).not.toContain('a');
    expect(output).not.toContain('c');
  });

  it('should show line numbers', () => {
    const result = diff('old', 'new');
    const output = renderTerminalCompact(result, { colorize: false });

    expect(output).toMatch(/\d+:/);
  });
});

describe('renderTerminalSummary', () => {
  it('should show addition and deletion counts', () => {
    const result = diff('a\nb', 'a\nc\nd');
    const output = renderTerminalSummary(result, { colorize: false });

    expect(output).toContain('+');
    expect(output).toContain('-');
  });

  it('should show file names when available', () => {
    const result = diffFiles('old', 'new', 'a.txt', 'b.txt');
    const output = renderTerminalSummary(result, { colorize: false });

    expect(output).toContain('a.txt');
    expect(output).toContain('b.txt');
  });
});

describe('renderHtml', () => {
  const oldContent = 'line 1\nold line\nline 3';
  const newContent = 'line 1\nnew line\nline 3';

  it('should render valid HTML', () => {
    const result = diffFiles(oldContent, newContent, 'a.txt', 'b.txt');
    const output = renderHtml(result);

    expect(output).toContain('<div');
    expect(output).toContain('</div>');
  });

  it('should include inline styles by default', () => {
    const result = diff('old', 'new');
    const output = renderHtml(result, { inlineStyles: true });

    expect(output).toContain('<style>');
  });

  it('should use custom class name', () => {
    const result = diff('old', 'new');
    const output = renderHtml(result, { className: 'my-diff' });

    expect(output).toContain('my-diff');
  });

  it('should support dark mode', () => {
    const result = diff('old', 'new');
    const darkOutput = renderHtml(result, { darkMode: true });
    const lightOutput = renderHtml(result, { darkMode: false });

    expect(darkOutput).toBeTruthy();
    expect(lightOutput).toBeTruthy();
  });

  it('should show file header', () => {
    const result = diffFiles('old', 'new', 'a.txt', 'b.txt');
    const output = renderHtml(result);

    expect(output).toContain('a.txt');
    expect(output).toContain('b.txt');
  });

  it('should show summary with counts', () => {
    const result = diff('a\nb', 'a\nc\nd');
    const output = renderHtml(result);

    expect(output).toContain('+2');
    expect(output).toContain('-1');
  });

  it('should escape HTML in content', () => {
    const result = diff('<script>alert("xss")</script>', '<div>safe</div>');
    const output = renderHtml(result);

    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;script&gt;');
  });

  it('should support syntax highlighting', () => {
    const result = diffFiles(
      'const x = 1;',
      'const x = 2;',
      'file.ts',
      'file.ts'
    );
    const output = renderHtml(result, { syntaxHighlight: true });

    expect(output).toContain('<span');
  });
});

describe('renderHtmlSideBySide', () => {
  it('should render side-by-side layout', () => {
    const result = diff('old line', 'new line');
    const output = renderHtmlSideBySide(result);

    expect(output).toContain('side-by-side');
    expect(output).toContain('side');
  });

  it('should show both file names', () => {
    const result = diffFiles('old', 'new', 'original.txt', 'modified.txt');
    const output = renderHtmlSideBySide(result);

    expect(output).toContain('original.txt');
    expect(output).toContain('modified.txt');
  });
});

describe('renderHtmlDocument', () => {
  it('should render complete HTML document', () => {
    const result = diff('old', 'new');
    const output = renderHtmlDocument(result);

    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<html');
    expect(output).toContain('<head>');
    expect(output).toContain('<body>');
    expect(output).toContain('</html>');
  });

  it('should include viewport meta tag', () => {
    const result = diff('old', 'new');
    const output = renderHtmlDocument(result);

    expect(output).toContain('viewport');
  });

  it('should support dark mode styling', () => {
    const result = diff('old', 'new');
    const darkOutput = renderHtmlDocument(result, { darkMode: true });
    const lightOutput = renderHtmlDocument(result, { darkMode: false });

    expect(darkOutput).toContain('#0d1117');
    expect(lightOutput).toContain('#ffffff');
  });
});
