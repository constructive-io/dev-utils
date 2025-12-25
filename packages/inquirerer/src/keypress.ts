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
  activeStack: TerminalKeypress[];  // Stack of active instances, top is current owner
  rawModeSet: boolean;
}

const sharedInputStates = new WeakMap<Readable, SharedInputState>();

function getOrCreateSharedState(input: Readable): SharedInputState {
  let state = sharedInputStates.get(input);
  if (!state) {
    const dataHandler = (key: string) => {
      const currentState = sharedInputStates.get(input);
      if (!currentState) return;
      
      // Only dispatch to the top of the active stack (current owner)
      const owner = currentState.activeStack[currentState.activeStack.length - 1];
      if (owner) {
        owner.handleKey(key);
        
        // Handle Ctrl+C via the current owner's process wrapper
        if (key === KEY_CODES.CTRL_C) {
          owner.exitProcess(0);
        }
      }
    };
    
    state = {
      dataHandler,
      instances: new Set(),
      activeStack: [],
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
  
  // Remove from active stack as well
  const stackIndex = state.activeStack.indexOf(instance);
  if (stackIndex !== -1) {
    state.activeStack.splice(stackIndex, 1);
  }
  
  // If stack is now empty, disable raw mode
  if (state.activeStack.length === 0 && state.rawModeSet) {
    if (typeof (input as any).setRawMode === 'function') {
      (input as any).setRawMode(false);
    }
    state.rawModeSet = false;
  }
  
  if (state.instances.size === 0) {
    input.removeListener('data', state.dataHandler);
    sharedInputStates.delete(input);
  }
}

export class TerminalKeypress {
  private listeners: Record<string, KeyHandler[]> = {};
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
    const state = getOrCreateSharedState(this.input);
    state.instances.add(this);
  }

  isTTY() {
    return !this.noTty;
  }

  isActive(): boolean {
    if (this.destroyed) return false;
    const state = sharedInputStates.get(this.input);
    if (!state) return false;
    // Active only if this instance is the current owner (top of stack)
    return state.activeStack[state.activeStack.length - 1] === this;
  }

  exitProcess(code?: number): void {
    this.proc.exit(code);
  }

  handleKey(key: string): void {
    if (this.destroyed) return;
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
    const state = sharedInputStates.get(this.input);
    if (!state) return;
    
    // Remove from active stack (from anywhere, not just top)
    const stackIndex = state.activeStack.indexOf(this);
    if (stackIndex !== -1) {
      state.activeStack.splice(stackIndex, 1);
    }
    
    // If stack is now empty, disable raw mode
    if (state.activeStack.length === 0 && state.rawModeSet) {
      if (this.isTTY() && typeof (this.input as any).setRawMode === 'function') {
        (this.input as any).setRawMode(false);
      }
      state.rawModeSet = false;
    }
  }

  resume(): void {
    if (this.destroyed) return;
    
    const state = sharedInputStates.get(this.input);
    if (!state) return;
    
    // Move-to-top semantics: remove from anywhere in stack, then push to top
    const existingIndex = state.activeStack.indexOf(this);
    if (existingIndex !== -1) {
      state.activeStack.splice(existingIndex, 1);
    }
    state.activeStack.push(this);
    
    // Enable raw mode if TTY
    if (this.isTTY() && typeof (this.input as any).setRawMode === 'function') {
      (this.input as any).setRawMode(true);
      state.rawModeSet = true;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
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
