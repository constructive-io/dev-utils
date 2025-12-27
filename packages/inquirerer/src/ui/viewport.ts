/**
 * ViewportRenderer - Diff-based terminal rendering with scrollback preservation
 * 
 * This module implements a terminal UI renderer that:
 * - Renders to a fixed "viewport" region at the bottom of the terminal
 * - Uses diff-based updates to minimize flicker and escape sequences
 * - Preserves native terminal scrollback for committed output
 * - Supports terminal resize handling
 * 
 * Based on the terminal UI spec for building claude-code style interfaces.
 */

import { Writable } from 'stream';

// ansi-diff for minimal diff-based rendering
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ansiDiff = require('ansi-diff');

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
  cursorUp: (n: number) => `\x1B[${n}A`,
  cursorDown: (n: number) => `\x1B[${n}B`,
  cursorToColumn: (col: number) => `\x1B[${col}G`,
  
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
 * - Uses ansi-diff for minimal escape sequence output
 */
export class ViewportRenderer {
  private output: Writable;
  private viewportHeight: number;
  private hideCursorEnabled: boolean;
  private diff: ReturnType<typeof ansiDiff>;
  private isRunning: boolean = false;
  private terminalWidth: number;
  private terminalHeight: number;
  private resizeHandler: (() => void) | null = null;
  
  constructor(options: ViewportRendererOptions = {}) {
    this.output = options.output ?? process.stdout;
    this.viewportHeight = options.viewportHeight ?? 10;
    this.hideCursorEnabled = options.hideCursor ?? true;
    
    // Get terminal dimensions
    const tty = this.output as NodeJS.WriteStream;
    this.terminalWidth = tty.columns ?? 80;
    this.terminalHeight = tty.rows ?? 24;
    
    // Initialize ansi-diff with terminal dimensions
    this.diff = ansiDiff({
      width: this.terminalWidth,
      height: this.viewportHeight,
    });
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
    this.diff.resize({ height });
  }
  
  /**
   * Start the viewport renderer
   * - Sets up resize handling
   * - Reserves space for the viewport
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
      this.diff.resize({
        width: this.terminalWidth,
        height: this.viewportHeight,
      });
    };
    
    if (typeof (this.output as NodeJS.WriteStream).on === 'function') {
      (this.output as NodeJS.WriteStream).on('resize', this.resizeHandler);
    }
    
    // Hide cursor if enabled
    if (this.hideCursorEnabled) {
      this.write(ANSI.hideCursor);
    }
    
    // Reserve space for viewport by printing empty lines
    // This ensures we have room to render without scrolling
    this.reserveViewportSpace();
    
    return this;
  }
  
  /**
   * Reserve space for the viewport at the bottom of the terminal
   */
  private reserveViewportSpace(): void {
    // Print empty lines to ensure viewport space exists
    for (let i = 0; i < this.viewportHeight; i++) {
      this.write('\n');
    }
    // Move cursor back up to the start of viewport
    this.write(ANSI.cursorUp(this.viewportHeight));
  }
  
  /**
   * Write committed output that becomes part of scrollback
   * This should be used for completed messages, not live updates
   */
  commit(text: string): this {
    if (!this.isRunning) {
      this.write(text);
      return this;
    }
    
    // Save cursor position
    this.write(ANSI.saveCursor);
    
    // Move to the line above the viewport
    // We need to scroll the viewport content up first
    this.write(ANSI.cursorUp(this.viewportHeight));
    
    // Write the committed text (this will scroll naturally)
    this.write(text);
    if (!text.endsWith('\n')) {
      this.write('\n');
    }
    
    // Re-reserve viewport space
    this.reserveViewportSpace();
    
    // Force a full redraw of the viewport
    this.diff = ansiDiff({
      width: this.terminalWidth,
      height: this.viewportHeight,
    });
    
    return this;
  }
  
  /**
   * Render the viewport with the given state
   * Uses diff-based rendering to minimize escape sequences
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
    
    // Join lines and compute diff
    const content = lines.join('\n');
    const diffOutput = this.diff.update(content);
    
    // Save cursor, move to viewport start, apply diff, restore cursor
    this.write(ANSI.saveCursor);
    this.write(diffOutput);
    
    // Position cursor if specified
    if (state.cursorRow !== undefined && state.cursorCol !== undefined) {
      // Calculate absolute position within viewport
      const row = Math.min(state.cursorRow, this.viewportHeight - 1);
      const col = state.cursorCol;
      this.write(ANSI.cursorUp(this.viewportHeight - 1 - row));
      this.write(ANSI.cursorToColumn(col + 1)); // ANSI columns are 1-indexed
    } else {
      this.write(ANSI.restoreCursor);
    }
    
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
   * - Clears viewport
   */
  stop(): this {
    if (!this.isRunning) return this;
    this.isRunning = false;
    
    // Remove resize handler
    if (this.resizeHandler && typeof (this.output as NodeJS.WriteStream).off === 'function') {
      (this.output as NodeJS.WriteStream).off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    
    // Clear viewport and move cursor to end
    this.clear();
    this.write(ANSI.cursorDown(this.viewportHeight));
    
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
