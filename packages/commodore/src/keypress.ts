import { Readable } from 'stream';

type KeyHandler = () => void;

interface ProcessWrapper {
  exit: (code?: number) => never;
}

const defaultProcessWrapper: ProcessWrapper = {
  exit: (code?: number) => process.exit(code)
};

export const KEY_CODES = {
  UP_ARROW: '\u001b[A',
  DOWN_ARROW: '\u001b[B',
  RIGHT_ARROW: '\u001b[C',
  LEFT_ARROW: '\u001b[D',
  ENTER: '\r',
  SPACE: ' ',
  CTRL_C: '\u0003',
  BACKSPACE: '\x7f',  // Commonly used BACKSPACE key in Unix-like systems
  BACKSPACE_LEGACY: '\x08'  // For compatibility with some systems
};

/**
 * Handles keyboard input for interactive prompts.
 * 
 * **Important**: Only one TerminalKeypress instance should be actively listening
 * on a given input stream at a time. If you need multiple Commodore instances,
 * call `close()` on the first instance before using the second, or reuse a single
 * instance for all prompts.
 * 
 * Multiple instances sharing the same input stream (e.g., process.stdin) will
 * each receive all keypresses, which can cause duplicate or unexpected behavior.
 */
export class TerminalKeypress {
  private listeners: Record<string, KeyHandler[]> = {};
  private active: boolean = true;
  private noTty: boolean;
  private input: Readable;
  private proc: ProcessWrapper;
  private dataHandler: ((key: string) => void) | null = null;

  constructor(
    noTty: boolean = false,
    input: Readable = process.stdin,
    proc: ProcessWrapper = defaultProcessWrapper,
  ) {
    this.noTty = noTty;
    this.input = input;
    this.proc = proc;

    if (this.isTTY()) {
      this.input.resume();
      this.input.setEncoding('utf8');
    }
    this.setupListeners();
  }

  isTTY() {
    return !this.noTty;
  }

  private setupListeners(): void {
    this.dataHandler = (key: string) => {
      if (!this.active) return;
      const handlers = this.listeners[key];
      handlers?.forEach(handler => handler());
      if (key === KEY_CODES.CTRL_C) {
        this.proc.exit(0);
      }
    };
    this.input.on('data', this.dataHandler);
  }

  on(key: string, callback: KeyHandler): void {
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    this.listeners[key].push(callback);
  }

  off(key: string, callback: KeyHandler): void {
    if (this.listeners[key]) {
      const index = this.listeners[key].indexOf(callback);
      if (index !== -1) {
        this.listeners[key].splice(index, 1);
      }
    }
  }

  clearHandlers(): void {
    this.listeners = {};
  }

  pause(): void {
    this.active = false;
    this.clearHandlers();
  }

  resume(): void {
    this.active = true;
    if (this.isTTY() && typeof (this.input as any).setRawMode === 'function') {
      (this.input as any).setRawMode(true);
    }
  }

  destroy(): void {
    if (typeof (this.input as any).setRawMode === 'function') {
      (this.input as any).setRawMode(false);
    }
    this.input.pause();
    if (this.dataHandler) {
      this.input.removeListener('data', this.dataHandler);
      this.dataHandler = null;
    }
  }
}
