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
 */
export function humanizeKeySequences(data: string): string {
  const keyMap: Record<string, string> = {
    '\u000d': '<ENTER>',
    '\u001b[A': '<UP_ARROW>',
    '\u001b[B': '<DOWN_ARROW>',
    '\u001b[C': '<RIGHT_ARROW>',
    '\u001b[D': '<LEFT_ARROW>',
    ' ': '<SPACE>',
    '\t': '<TAB>',
    '\u001b': '<ESCAPE>',
    '\u007f': '<BACKSPACE>',
    '\u001b[3~': '<DELETE>',
    '\u0003': '<CTRL_C>',
    '\u0004': '<CTRL_D>',
  };

  let result = data;
  for (const [seq, name] of Object.entries(keyMap)) {
    result = result.split(seq).join(name);
  }
  return result;
}
