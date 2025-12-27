/**
 * Common key sequences for simulating user input in CLI tests.
 * These are the escape sequences that terminals send for various keys.
 */
export const KEY_SEQUENCES = {
  /** Enter/Return key */
  ENTER: '\u000d',
  /** Up arrow key */
  UP_ARROW: '\u001b[A',
  /** Down arrow key */
  DOWN_ARROW: '\u001b[B',
  /** Right arrow key */
  RIGHT_ARROW: '\u001b[C',
  /** Left arrow key */
  LEFT_ARROW: '\u001b[D',
  /** Space bar */
  SPACE: ' ',
  /** Tab key */
  TAB: '\t',
  /** Escape key */
  ESCAPE: '\u001b',
  /** Backspace key */
  BACKSPACE: '\u007f',
  /** Delete key */
  DELETE: '\u001b[3~',
  /** Ctrl+C (interrupt) */
  CTRL_C: '\u0003',
  /** Ctrl+D (EOF) */
  CTRL_D: '\u0004',
} as const;

export type KeySequence = typeof KEY_SEQUENCES[keyof typeof KEY_SEQUENCES];

/**
 * Converts key escape sequences to human-readable names for debugging.
 * Useful for making test output more readable.
 * 
 * Note: This function intentionally does NOT replace standalone ESC bytes (\u001b)
 * because they are part of ANSI escape codes used for terminal styling.
 * Use cleanAnsi() after this function to strip ANSI styling codes.
 */
export function humanizeKeySequences(data: string): string {
  // Key sequences to humanize - ordered by length descending to ensure
  // longer sequences are replaced before shorter ones
  const keyMap: [string, string][] = [
    ['\u001b[3~', '<DELETE>'],
    ['\u001b[A', '<UP_ARROW>'],
    ['\u001b[B', '<DOWN_ARROW>'],
    ['\u001b[C', '<RIGHT_ARROW>'],
    ['\u001b[D', '<LEFT_ARROW>'],
    ['\u000d', '<ENTER>'],
    ['\u007f', '<BACKSPACE>'],
    ['\u0003', '<CTRL_C>'],
    ['\u0004', '<CTRL_D>'],
    ['\t', '<TAB>'],
    [' ', '<SPACE>'],
    // Note: Standalone ESC (\u001b) is intentionally NOT replaced here
    // because it conflicts with ANSI escape codes for terminal styling.
    // ANSI codes like \u001b[97m (white text) should be stripped by cleanAnsi().
  ];

  let result = data;
  for (const [seq, name] of keyMap) {
    result = result.split(seq).join(name);
  }
  return result;
}
