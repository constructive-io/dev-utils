import { Readable } from 'stream';

type KeyHandler = () => void;

interface ProcessWrapper {
  exit: (code?: number) => never;
}

const defaultProcessWrapper: ProcessWrapper = {
  exit: (code?: number) => process.exit(code)
};

export const KEY_CODES = {
  // Arrow keys
  UP_ARROW: '\u001b[A',
  DOWN_ARROW: '\u001b[B',
  RIGHT_ARROW: '\u001b[C',
  LEFT_ARROW: '\u001b[D',
  
  // Basic keys
  ENTER: '\r',
  SPACE: ' ',
  TAB: '\t',
  BACKSPACE: '\x7f',  // Commonly used BACKSPACE key in Unix-like systems
  BACKSPACE_LEGACY: '\x08',  // For compatibility with some systems
  DELETE: '\u001b[3~',
  
  // Control keys
  CTRL_C: '\u0003',
  CTRL_D: '\u0004',
  CTRL_A: '\u0001',  // Start of line
  CTRL_E: '\u0005',  // End of line
  CTRL_K: '\u000b',  // Kill to end of line
  CTRL_U: '\u0015',  // Kill to start of line
  CTRL_W: '\u0017',  // Delete previous word
  CTRL_L: '\u000c',  // Clear screen
  CTRL_N: '\u000e',  // Next (down)
  CTRL_P: '\u0010',  // Previous (up)
  CTRL_F: '\u0006',  // Forward (right)
  CTRL_B: '\u0002',  // Back (left)
  
  // Alt/Meta key combinations (escape sequences)
  // Note: Alt key sends ESC followed by the character
  ALT_B: '\u001bb',  // Word back
  ALT_F: '\u001bf',  // Word forward
  ALT_D: '\u001bd',  // Delete word forward
  ALT_BACKSPACE: '\u001b\x7f',  // Delete word backward
  
  // Shift+Enter (varies by terminal, common sequences)
  SHIFT_ENTER: '\u001b[13;2u',  // CSI u encoding
  SHIFT_ENTER_ALT: '\u001bOM',  // Some terminals
  
  // Home/End keys
  HOME: '\u001b[H',
  HOME_ALT: '\u001bOH',
  HOME_ALT2: '\u001b[1~',
  END: '\u001b[F',
  END_ALT: '\u001bOF',
  END_ALT2: '\u001b[4~',
  
  // Page Up/Down
  PAGE_UP: '\u001b[5~',
  PAGE_DOWN: '\u001b[6~',
  
  // Ctrl+Arrow (word navigation in some terminals)
  CTRL_LEFT: '\u001b[1;5D',
  CTRL_RIGHT: '\u001b[1;5C',
  CTRL_UP: '\u001b[1;5A',
  CTRL_DOWN: '\u001b[1;5B',
  
  // Alt+Arrow (word navigation in some terminals)
  ALT_LEFT: '\u001b[1;3D',
  ALT_RIGHT: '\u001b[1;3C',
  ALT_UP: '\u001b[1;3A',
  ALT_DOWN: '\u001b[1;3B',
};

/**
 * Handles keyboard input for interactive prompts.
 * 
 * **Important**: Only one TerminalKeypress instance should be actively listening
 * on a given input stream at a time. If you need multiple Inquirerer instances,
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
