/**
 * Progress Bar Component
 * 
 * Visual progress indicator for operations with known completion
 */

import { Writable } from 'stream';
import { green, cyan, dim, white } from 'yanse';
import { ProgressConfig } from './types';

interface ProgressState {
  value: number;
  text: string;
  status: 'active' | 'complete' | 'error';
}

/**
 * Progress bar that can be controlled externally
 */
export class ProgressBar {
  private width: number;
  private showPercentage: boolean;
  private state: ProgressState;
  private output: Writable;
  private isRunning: boolean = false;

  constructor(config: ProgressConfig, output: Writable = process.stdout) {
    this.width = config.width ?? 40;
    this.showPercentage = config.showPercentage ?? true;
    this.output = output;
    this.state = {
      value: 0,
      text: config.text,
      status: 'active',
    };
  }

  /**
   * Start the progress bar
   */
  start(): this {
    if (this.isRunning) return this;
    this.isRunning = true;
    
    // Hide cursor
    this.output.write('\x1B[?25l');
    
    // Initial render
    this.render();
    
    return this;
  }

  /**
   * Update progress (0-1)
   */
  update(value: number, text?: string): this {
    this.state.value = Math.max(0, Math.min(1, value));
    if (text) {
      this.state.text = text;
    }
    if (this.isRunning) {
      this.render();
    }
    return this;
  }

  /**
   * Increment progress
   */
  increment(amount: number = 0.1): this {
    return this.update(this.state.value + amount);
  }

  /**
   * Complete the progress bar
   */
  complete(text?: string): this {
    this.state.value = 1;
    this.state.status = 'complete';
    if (text) {
      this.state.text = text;
    }
    this.render();
    
    // Show cursor and newline
    this.output.write('\x1B[?25h\n');
    this.isRunning = false;
    
    return this;
  }

  /**
   * Mark as error
   */
  error(text?: string): this {
    this.state.status = 'error';
    if (text) {
      this.state.text = text;
    }
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
    const { value, text, status } = this.state;
    
    const filled = Math.round(value * this.width);
    const empty = this.width - filled;
    
    let bar: string;
    let icon: string;
    
    switch (status) {
      case 'complete':
        bar = green('█'.repeat(this.width));
        icon = green('✔');
        break;
      case 'error':
        bar = dim('█'.repeat(filled) + '░'.repeat(empty));
        icon = '\x1B[31m✖\x1B[0m'; // red
        break;
      default:
        bar = cyan('█'.repeat(filled)) + dim('░'.repeat(empty));
        icon = cyan('◐');
    }
    
    let line = `${icon} ${text} [${bar}]`;
    
    if (this.showPercentage) {
      const percent = Math.round(value * 100);
      line += ` ${white(percent.toString().padStart(3))}%`;
    }
    
    // Clear line and write
    this.output.write('\r\x1B[2K' + line);
  }
}

/**
 * Create and start a progress bar
 */
export function createProgress(text: string, options?: Partial<ProgressConfig>): ProgressBar {
  return new ProgressBar({ text, ...options });
}
