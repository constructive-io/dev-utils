/**
 * Spinner Component
 * 
 * Animated loading spinner for async operations
 */

import { Writable } from 'stream';
import { cyan,green, red, yellow } from 'yanse';

import { UIEngine } from './engine';
import { SpinnerConfig } from './types';

/**
 * Default spinner frames (dots style)
 */
const DEFAULT_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Alternative spinner styles
 */
export const SPINNER_STYLES = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['-', '\\', '|', '/'],
  arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
  circle: ['◐', '◓', '◑', '◒'],
  square: ['◰', '◳', '◲', '◱'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  clock: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
  moon: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
  dots2: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
};

interface SpinnerState {
  frame: number;
  text: string;
  status: 'spinning' | 'success' | 'error' | 'warning' | 'info';
  finalText?: string;
}

/**
 * Create a spinner that can be controlled externally
 */
export class Spinner {
  private engine: UIEngine;
  private frames: string[];
  private interval: number;
  private state: SpinnerState;
  private tickTimer: NodeJS.Timeout | null = null;
  private output: Writable;
  private lastLineCount: number = 0;
  private isRunning: boolean = false;

  constructor(config: SpinnerConfig, output: Writable = process.stdout) {
    this.engine = new UIEngine({ output });
    this.frames = config.frames ?? DEFAULT_FRAMES;
    this.interval = config.interval ?? 80;
    this.output = output;
    this.state = {
      frame: 0,
      text: config.text,
      status: 'spinning',
    };
  }

  /**
   * Start the spinner
   */
  start(): this {
    if (this.isRunning) return this;
    this.isRunning = true;
    
    // Hide cursor
    this.output.write('\x1B[?25l');
    
    // Initial render
    this.render();
    
    // Start animation
    this.tickTimer = setInterval(() => {
      this.state.frame = (this.state.frame + 1) % this.frames.length;
      this.render();
    }, this.interval);
    
    return this;
  }

  /**
   * Update the spinner text
   */
  text(text: string): this {
    this.state.text = text;
    if (this.isRunning) {
      this.render();
    }
    return this;
  }

  /**
   * Stop with success
   */
  succeed(text?: string): this {
    return this.stop('success', text);
  }

  /**
   * Stop with error
   */
  fail(text?: string): this {
    return this.stop('error', text);
  }

  /**
   * Stop with warning
   */
  warn(text?: string): this {
    return this.stop('warning', text);
  }

  /**
   * Stop with info
   */
  info(text?: string): this {
    return this.stop('info', text);
  }

  /**
   * Stop the spinner
   */
  stop(status: 'success' | 'error' | 'warning' | 'info' = 'success', text?: string): this {
    if (!this.isRunning) return this;
    
    // Clear timer
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    
    this.state.status = status;
    if (text) {
      this.state.finalText = text;
    }
    
    // Final render
    this.render();
    
    // Show cursor and newline
    this.output.write('\x1B[?25h\n');
    
    this.isRunning = false;
    return this;
  }

  /**
   * Render the current state
   */
  private render(): void {
    const { frame, text, status, finalText } = this.state;
    
    let icon: string;
    let displayText = finalText ?? text;
    
    switch (status) {
    case 'success':
      icon = green('✔');
      displayText = green(displayText);
      break;
    case 'error':
      icon = red('✖');
      displayText = red(displayText);
      break;
    case 'warning':
      icon = yellow('⚠');
      displayText = yellow(displayText);
      break;
    case 'info':
      icon = cyan('ℹ');
      displayText = cyan(displayText);
      break;
    default:
      icon = cyan(this.frames[frame]);
    }
    
    // Clear line and write
    this.output.write('\r\x1B[2K' + icon + ' ' + displayText);
  }
}

/**
 * Create and start a spinner
 */
export function createSpinner(text: string, options?: Partial<SpinnerConfig>): Spinner {
  return new Spinner({ text, ...options });
}
