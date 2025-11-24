import { cleanAnsi, stripAnsi } from '../src';

describe('cleanAnsi', () => {
  it('should return empty string for null or undefined input', () => {
    expect(cleanAnsi('')).toBe('');
    expect(cleanAnsi(null as any)).toBe('');
    expect(cleanAnsi(undefined as any)).toBe('');
  });

  it('should return the same string if no ANSI codes are present', () => {
    const text = 'Hello, World!';
    expect(cleanAnsi(text)).toBe(text);
  });

  it('should remove CSI color codes', () => {
    const text = '\u001b[31mRed text\u001b[0m';
    expect(cleanAnsi(text)).toBe('Red text');
  });

  it('should remove multiple color codes', () => {
    const text = '\u001b[31mRed\u001b[0m \u001b[32mGreen\u001b[0m \u001b[34mBlue\u001b[0m';
    expect(cleanAnsi(text)).toBe('Red Green Blue');
  });

  it('should remove cursor movement codes', () => {
    const text = 'Hello\u001b[AWorld';
    expect(cleanAnsi(text)).toBe('HelloWorld');
  });

  it('should remove clear screen codes', () => {
    const text = 'Before\u001b[2JAfter';
    expect(cleanAnsi(text)).toBe('BeforeAfter');
  });

  it('should remove cursor visibility codes', () => {
    const text = 'Text\u001b[?25hMore text\u001b[?25l';
    expect(cleanAnsi(text)).toBe('TextMore text');
  });

  it('should remove OSC sequences with BEL terminator', () => {
    const text = '\u001b]0;Window Title\u0007Content';
    expect(cleanAnsi(text)).toBe('Content');
  });

  it('should remove OSC sequences with ESC\\ terminator', () => {
    const text = '\u001b]2;Title\u001b\\Content';
    expect(cleanAnsi(text)).toBe('Content');
  });

  it('should remove other escape sequences', () => {
    const text = 'Save\u001b7Position\u001b8Restore';
    expect(cleanAnsi(text)).toBe('SavePositionRestore');
  });

  it('should handle complex strings with multiple ANSI codes', () => {
    const text = '\u001b[31m\u001b[1mBold Red\u001b[0m\u001b[32m Green \u001b[0m\u001b]0;Title\u0007Normal';
    expect(cleanAnsi(text)).toBe('Bold Red Green Normal');
  });

  it('should preserve newlines and other whitespace', () => {
    const text = '\u001b[31mLine 1\u001b[0m\nLine 2\n\tTabbed';
    expect(cleanAnsi(text)).toBe('Line 1\nLine 2\n\tTabbed');
  });

  it('should handle strings with only ANSI codes', () => {
    const text = '\u001b[31m\u001b[0m\u001b[32m\u001b[0m';
    expect(cleanAnsi(text)).toBe('');
  });

  it('should handle complex real-world terminal output', () => {
    const text = '\u001b[?25l\u001b[2J\u001b[H\u001b[31mError:\u001b[0m Something went wrong\u001b[?25h';
    expect(cleanAnsi(text)).toBe('Error: Something went wrong');
  });

  it('should handle 256 color codes', () => {
    const text = '\u001b[38;5;208mOrange text\u001b[0m';
    expect(cleanAnsi(text)).toBe('Orange text');
  });

  it('should handle RGB color codes', () => {
    const text = '\u001b[38;2;255;0;0mRed text\u001b[0m';
    expect(cleanAnsi(text)).toBe('Red text');
  });
});

describe('stripAnsi (alias)', () => {
  it('should work the same as cleanAnsi', () => {
    const text = '\u001b[31mRed text\u001b[0m';
    expect(stripAnsi(text)).toBe('Red text');
    expect(stripAnsi(text)).toBe(cleanAnsi(text));
  });

  it('should be the same function reference', () => {
    expect(stripAnsi).toBe(cleanAnsi);
  });
});
