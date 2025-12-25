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

interface SharedInputState {
  dataHandler: (key: string) => void;
  instances: Set<TerminalKeypress>;
  rawModeSet: boolean;
}

const sharedInputStates = new WeakMap<Readable, SharedInputState>();

function getOrCreateSharedState(input: Readable, proc: ProcessWrapper): SharedInputState {
  let state = sharedInputStates.get(input);
  if (!state) {
    const dataHandler = (key: string) => {
      const currentState = sharedInputStates.get(input);
      if (!currentState) return;
      
      for (const instance of currentState.instances) {
        if (instance.isActive()) {
          instance.handleKey(key);
        }
      }
      
      if (key === KEY_CODES.CTRL_C) {
        proc.exit(0);
      }
    };
    
    state = {
      dataHandler,
      instances: new Set(),
      rawModeSet: false
    };
    
    sharedInputStates.set(input, state);
    input.on('data', dataHandler);
  }
  return state;
}

function removeFromSharedState(input: Readable, instance: TerminalKeypress): void {
  const state = sharedInputStates.get(input);
  if (!state) return;
  
  state.instances.delete(instance);
  
  if (state.instances.size === 0) {
    input.removeListener('data', state.dataHandler);
    sharedInputStates.delete(input);
    
    if (state.rawModeSet && typeof (input as any).setRawMode === 'function') {
      (input as any).setRawMode(false);
    }
  }
}

export class TerminalKeypress {
  private listeners: Record<string, KeyHandler[]> = {};
  private active: boolean = true;
  private noTty: boolean;
  private input: Readable;
  private proc: ProcessWrapper;
  private destroyed: boolean = false;

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
    this.registerWithSharedState();
  }

  private registerWithSharedState(): void {
    const state = getOrCreateSharedState(this.input, this.proc);
    state.instances.add(this);
  }

  isTTY() {
    return !this.noTty;
  }

  isActive(): boolean {
    return this.active && !this.destroyed;
  }

  handleKey(key: string): void {
    if (!this.active || this.destroyed) return;
    const handlers = this.listeners[key];
    handlers?.forEach(handler => handler());
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
      const state = sharedInputStates.get(this.input);
      if (state) {
        state.rawModeSet = true;
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.active = false;
    this.clearHandlers();
    
    removeFromSharedState(this.input, this);
    
    const state = sharedInputStates.get(this.input);
    if (!state || state.instances.size === 0) {
      if (typeof (this.input as any).setRawMode === 'function') {
        (this.input as any).setRawMode(false);
      }
      this.input.pause();
    }
  }
}
