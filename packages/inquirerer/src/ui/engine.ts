/**
 * Event-driven UI Engine
 * 
 * A flexible engine for building custom interactive terminal UIs
 * with support for key events, timers, and async updates.
 */

import { Readable, Writable } from 'stream';
import { KEY_CODES, TerminalKeypress } from '../keypress';
import { Key, UIEvent, UIScreenConfig, EventResult } from './types';

/**
 * Maps raw key codes to normalized Key enum
 */
const KEY_MAP: Record<string, Key> = {
  [KEY_CODES.UP_ARROW]: Key.UP,
  [KEY_CODES.DOWN_ARROW]: Key.DOWN,
  [KEY_CODES.LEFT_ARROW]: Key.LEFT,
  [KEY_CODES.RIGHT_ARROW]: Key.RIGHT,
  [KEY_CODES.ENTER]: Key.ENTER,
  [KEY_CODES.SPACE]: Key.SPACE,
  [KEY_CODES.BACKSPACE]: Key.BACKSPACE,
  [KEY_CODES.BACKSPACE_LEGACY]: Key.BACKSPACE,
  [KEY_CODES.CTRL_C]: Key.CTRL_C,
  '\u001b': Key.ESCAPE,
  '\t': Key.TAB,
};

/**
 * ANSI escape codes for terminal control
 */
const ANSI = {
  clearScreen: '\x1Bc',
  hideCursor: '\x1B[?25l',
  showCursor: '\x1B[?25h',
  cursorUp: (n: number) => `\x1B[${n}A`,
  cursorDown: (n: number) => `\x1B[${n}B`,
  cursorTo: (x: number, y: number) => `\x1B[${y};${x}H`,
  clearLine: '\x1B[2K',
  clearToEnd: '\x1B[0J',
  saveCursor: '\x1B[s',
  restoreCursor: '\x1B[u',
};

export interface UIEngineOptions {
  input?: Readable;
  output?: Writable;
  noTty?: boolean;
  /** Existing keypress instance to reuse (avoids multiple listeners on stdin) */
  keypress?: TerminalKeypress;
  /** If true, engine owns the keypress and will destroy it on cleanup. Default: true if keypress not provided */
  ownsKeypress?: boolean;
  /** If true, clear the entire screen on start instead of just overwriting lines */
  clearScreenOnStart?: boolean;
}

export class UIEngine {
  private input: Readable;
  private output: Writable;
  private noTty: boolean;
  private keypress: TerminalKeypress | null = null;
  private ownsKeypress: boolean;
  private clearScreenOnStart: boolean;
  private tickTimer: NodeJS.Timeout | null = null;
  private lastLineCount: number = 0;

  constructor(options: UIEngineOptions = {}) {
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
    this.noTty = options.noTty ?? false;
    this.keypress = options.keypress ?? null;
    this.ownsKeypress = options.ownsKeypress ?? (options.keypress === undefined);
    this.clearScreenOnStart = options.clearScreenOnStart ?? false;
  }

  /**
   * Write to output
   */
  private write(text: string): void {
    this.output.write(text);
  }

  /**
   * Clear the screen
   */
  private clearScreen(): void {
    this.write(ANSI.clearScreen);
  }

  /**
   * Hide the cursor
   */
  private hideCursor(): void {
    this.write(ANSI.hideCursor);
  }

  /**
   * Show the cursor
   */
  private showCursor(): void {
    this.write(ANSI.showCursor);
  }

  /**
   * Render lines to the terminal, clearing previous output
   */
  private render(lines: string[]): void {
    // Move cursor up to overwrite previous output
    if (this.lastLineCount > 0) {
      this.write(ANSI.cursorUp(this.lastLineCount));
    }
    
    // Clear and write each line
    for (const line of lines) {
      this.write(ANSI.clearLine + line + '\n');
    }
    
    // Clear any remaining lines from previous render
    if (lines.length < this.lastLineCount) {
      for (let i = 0; i < this.lastLineCount - lines.length; i++) {
        this.write(ANSI.clearLine + '\n');
      }
      // Move cursor back up
      this.write(ANSI.cursorUp(this.lastLineCount - lines.length));
    }
    
    this.lastLineCount = lines.length;
  }

  /**
   * Run a custom UI screen
   */
  async run<S, V = unknown, D = unknown>(
    config: UIScreenConfig<S, V, D>
  ): Promise<V | undefined> {
    if (this.noTty) {
      // In non-TTY mode, just return undefined
      return undefined;
    }

    let state = config.initialState;
    let resolved = false;
    let result: V | undefined;
    const createdKeypress = !this.keypress;

    // Setup keypress handler - reuse existing or create new
    if (!this.keypress) {
      this.keypress = new TerminalKeypress(this.noTty, this.input);
    }
    this.keypress.resume();

    // Clear screen on start if requested (matches legacy prompt behavior)
    if (this.clearScreenOnStart) {
      this.clearScreen();
    }

    // Hide cursor if requested
    if (config.hideCursor) {
      this.hideCursor();
    }

    // Call onStart hook
    config.onStart?.(state);

    // Initial render
    const lines = config.render(state);
    this.render(lines);

    // Setup tick timer if interval specified
    if (config.tickInterval && config.tickInterval > 0) {
      this.tickTimer = setInterval(() => {
        if (resolved) return;
        const event: UIEvent<D> = { type: 'tick' };
        const eventResult = config.onEvent(event, state);
        state = eventResult.state;
        this.render(config.render(state));
        
        if (eventResult.done) {
          resolved = true;
          result = eventResult.value;
        }
      }, config.tickInterval);
    }

    return new Promise<V | undefined>((resolve) => {
      const handleEvent = (event: UIEvent<D>) => {
        if (resolved) return;
        
        const eventResult = config.onEvent(event, state);
        state = eventResult.state;
        this.render(config.render(state));
        
        if (eventResult.done) {
          resolved = true;
          result = eventResult.value;
          cleanup();
          resolve(result);
        }
      };

      const cleanup = () => {
        // Clear tick timer
        if (this.tickTimer) {
          clearInterval(this.tickTimer);
          this.tickTimer = null;
        }
        
        // Cleanup keypress - pause clears handlers, which is what we want
        // Only destroy if we created it and own it
        if (this.keypress) {
          this.keypress.pause();
          if (createdKeypress && this.ownsKeypress) {
            this.keypress.destroy();
            this.keypress = null;
          }
        }
        
        // Show cursor
        if (config.hideCursor) {
          this.showCursor();
        }
        
        // Call onExit hook
        config.onExit?.(state, result);
      };

      // Register key handlers
      // Handle special keys - but let TerminalKeypress handle CTRL+C exit
      Object.entries(KEY_MAP).forEach(([code, key]) => {
        this.keypress!.on(code, () => {
          // For CTRL+C, just cleanup - TerminalKeypress will call process.exit
          if (key === Key.CTRL_C) {
            cleanup();
            return;
          }
          handleEvent({ type: 'key', key });
        });
      });

      // Handle alphanumeric characters (lowercase only to match legacy behavior)
      'abcdefghijklmnopqrstuvwxyz0123456789'.split('').forEach(char => {
        this.keypress!.on(char, () => {
          handleEvent({ type: 'char', char });
        });
      });

      // Handle punctuation and special characters
      '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~'.split('').forEach(char => {
        this.keypress!.on(char, () => {
          handleEvent({ type: 'char', char });
        });
      });
    });
  }

  /**
   * Dispatch an external event (for async updates)
   */
  dispatch<S, V, D>(event: UIEvent<D>): void {
    // This would be used for external event dispatch
    // Implementation depends on how we want to handle async updates
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.keypress) {
      this.keypress.destroy();
      this.keypress = null;
    }
    this.showCursor();
  }
}

export { ANSI };
