/**
 * ViewportRenderer - Terminal rendering with scrollback preservation
 * 
 * This module implements a terminal UI renderer that:
 * - Renders to a fixed "viewport" region at the bottom of the terminal
 * - Uses cursor positioning to update content in-place
 * - Preserves native terminal scrollback for committed output
 * - Supports terminal resize handling
 * 
 * Based on the terminal UI spec for building claude-code style interfaces.
 */

import { Writable } from 'stream';
import stringWidth from 'string-width';

/**
 * Truncate a string to fit within a given display width
 * Handles ANSI escape codes and wide characters correctly
 */
function truncateToWidth(str: string, maxWidth: number): string {
  // Quick check - if no ANSI codes and ASCII only, use simple truncation
  const hasAnsi = /\x1B\[/.test(str);
  if (!hasAnsi && stringWidth(str) <= maxWidth) {
    return str;
  }
  
  // For strings with ANSI codes or wide chars, we need to be careful
  let result = '';
  let currentWidth = 0;
  let inEscape = false;
  let escapeBuffer = '';
  
  for (const char of str) {
    if (inEscape) {
      escapeBuffer += char;
      // Check if escape sequence is complete (ends with letter)
      if (/[a-zA-Z]/.test(char)) {
        result += escapeBuffer;
        escapeBuffer = '';
        inEscape = false;
      }
      continue;
    }
    
    if (char === '\x1B') {
      inEscape = true;
      escapeBuffer = char;
      continue;
    }
    
    const charWidth = stringWidth(char);
    if (currentWidth + charWidth > maxWidth) {
      break;
    }
    
    result += char;
    currentWidth += charWidth;
  }
  
  // Reset any open ANSI styles at the end
  if (hasAnsi) {
    result += '\x1B[0m';
  }
  
  return result;
}

/**
 * ANSI escape codes for terminal control
 */
const ANSI = {
  // Cursor visibility
  hideCursor: '\x1B[?25l',
  showCursor: '\x1B[?25h',
  
  // Cursor position
  saveCursor: '\x1B7',
  restoreCursor: '\x1B8',
  cursorTo: (row: number, col: number) => `\x1B[${row};${col}H`,
  cursorUp: (n: number) => n > 0 ? `\x1B[${n}A` : '',
  cursorDown: (n: number) => n > 0 ? `\x1B[${n}B` : '',
  cursorToColumn: (col: number) => `\x1B[${col}G`,
  cursorToStart: '\r',
  
  // Line clearing (does NOT affect scrollback)
  clearLine: '\x1B[2K',
  clearToEndOfLine: '\x1B[0K',
  clearToEndOfScreen: '\x1B[0J',
  
  // Scrolling region (for advanced use)
  setScrollRegion: (top: number, bottom: number) => `\x1B[${top};${bottom}r`,
  resetScrollRegion: '\x1B[r',
};

export interface ViewportRendererOptions {
  /** Output stream (defaults to process.stdout) */
  output?: Writable;
  /** Number of rows to reserve for the viewport */
  viewportHeight?: number;
  /** Whether to hide the cursor during rendering */
  hideCursor?: boolean;
}

export interface ViewportState {
  /** Lines to render in the viewport */
  lines: string[];
  /** Current cursor position within viewport (0-indexed row) */
  cursorRow?: number;
  /** Current cursor position within viewport (0-indexed column) */
  cursorCol?: number;
}

/**
 * ViewportRenderer - Renders to a fixed region at the bottom of the terminal
 * 
 * Key concepts:
 * - "Committed output" is written normally and becomes part of scrollback
 * - "Live viewport" is a reserved region that gets updated in-place
 * - Uses cursor positioning to redraw content efficiently
 */
export class ViewportRenderer {
  private output: Writable;
  private viewportHeight: number;
  private hideCursorEnabled: boolean;
  private isRunning: boolean = false;
  private terminalWidth: number;
  private terminalHeight: number;
  private resizeHandler: (() => void) | null = null;
  private hasRenderedOnce: boolean = false;
  
  constructor(options: ViewportRendererOptions = {}) {
    this.output = options.output ?? process.stdout;
    this.viewportHeight = options.viewportHeight ?? 10;
    this.hideCursorEnabled = options.hideCursor ?? true;
    
    // Get terminal dimensions
    const tty = this.output as NodeJS.WriteStream;
    this.terminalWidth = tty.columns ?? 80;
    this.terminalHeight = tty.rows ?? 24;
  }
  
  /**
   * Get the current terminal dimensions
   */
  getTerminalSize(): { width: number; height: number } {
    return {
      width: this.terminalWidth,
      height: this.terminalHeight,
    };
  }
  
  /**
   * Get the viewport height
   */
  getViewportHeight(): number {
    return this.viewportHeight;
  }
  
  /**
   * Set the viewport height
   */
  setViewportHeight(height: number): void {
    this.viewportHeight = height;
  }
  
  /**
   * Start the viewport renderer
   * - Sets up resize handling
   * - Hides cursor if configured
   */
  start(): this {
    if (this.isRunning) return this;
    this.isRunning = true;
    
    // Setup resize handler
    this.resizeHandler = () => {
      const tty = this.output as NodeJS.WriteStream;
      this.terminalWidth = tty.columns ?? 80;
      this.terminalHeight = tty.rows ?? 24;
    };
    
    if (typeof (this.output as NodeJS.WriteStream).on === 'function') {
      (this.output as NodeJS.WriteStream).on('resize', this.resizeHandler);
    }
    
    // Hide cursor if enabled
    if (this.hideCursorEnabled) {
      this.write(ANSI.hideCursor);
    }
    
    return this;
  }
  
  /**
   * Write committed output that becomes part of scrollback
   * This should be used for completed messages, not live updates
   */
  commit(text: string): this {
    // First, clear the current viewport by moving up and clearing lines
    if (this.hasRenderedOnce) {
      this.write(ANSI.cursorUp(this.viewportHeight));
      for (let i = 0; i < this.viewportHeight; i++) {
        this.write(ANSI.clearLine + '\n');
      }
      this.write(ANSI.cursorUp(this.viewportHeight));
    }
    
    // Write the committed text (this becomes scrollback)
    this.write(text);
    if (!text.endsWith('\n')) {
      this.write('\n');
    }
    
    this.hasRenderedOnce = false;
    
    return this;
  }
  
  /**
   * Render the viewport with the given state
   * Uses cursor positioning to redraw content in-place
   */
  render(state: ViewportState): this {
    if (!this.isRunning) {
      this.start();
    }
    
    // Build the viewport content
    const lines = state.lines.slice(0, this.viewportHeight);
    
    // Pad with empty lines if needed
    while (lines.length < this.viewportHeight) {
      lines.push('');
    }
    
    // On first render, reserve space by printing empty lines
    // This establishes the viewport region at the bottom of the terminal
    if (!this.hasRenderedOnce) {
      // Print viewportHeight newlines to reserve space
      for (let i = 0; i < this.viewportHeight; i++) {
        this.write('\n');
      }
      this.hasRenderedOnce = true;
      // After first render, cursor is at bottom. Move up viewportHeight to get to top.
      this.write(ANSI.cursorUp(this.viewportHeight));
    } else {
      // On subsequent renders, cursor is on the last viewport row (since we don't emit trailing newline)
      // Move up (viewportHeight - 1) to get back to the first viewport row
      this.write(ANSI.cursorUp(this.viewportHeight - 1));
    }
    this.write(ANSI.cursorToStart);
    
    // Clear and redraw each line
    // Truncate lines to terminal width to prevent soft-wrap which desyncs cursor position
    for (let i = 0; i < lines.length; i++) {
      this.write(ANSI.clearLine);
      this.write(truncateToWidth(lines[i], this.terminalWidth));
      if (i < lines.length - 1) {
        this.write('\n');
      }
    }
    
    // Position cursor at end of last line (do NOT emit newline to avoid scroll)
    // The next render will move cursor back up anyway
    
    return this;
  }
  
  /**
   * Clear the viewport
   */
  clear(): this {
    const emptyLines = Array(this.viewportHeight).fill('');
    return this.render({ lines: emptyLines });
  }
  
  /**
   * Stop the viewport renderer
   * - Removes resize handler
   * - Shows cursor
   */
  stop(): this {
    if (!this.isRunning) return this;
    this.isRunning = false;
    
    // Remove resize handler
    if (this.resizeHandler && typeof (this.output as NodeJS.WriteStream).off === 'function') {
      (this.output as NodeJS.WriteStream).off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    
    // Show cursor
    if (this.hideCursorEnabled) {
      this.write(ANSI.showCursor);
    }
    
    return this;
  }
  
  /**
   * Write directly to output
   */
  private write(text: string): void {
    this.output.write(text);
  }
}

/**
 * Create a viewport renderer
 */
export function createViewport(options?: ViewportRendererOptions): ViewportRenderer {
  return new ViewportRenderer(options);
}

export { ANSI as ViewportANSI };
