/**
 * Streaming Text Component
 * 
 * For displaying streaming output like AI chat responses
 */

import { Writable } from 'stream';
import { cyan } from 'yanse';
import { StreamConfig } from './types';

interface StreamState {
  lines: string[];
  currentLine: string;
  showCursor: boolean;
  isComplete: boolean;
}

/**
 * Streaming text display for AI-style output
 */
export class StreamingText {
  private prefix: string;
  private showCursor: boolean;
  private state: StreamState;
  private output: Writable;
  private isRunning: boolean = false;
  private cursorTimer: NodeJS.Timeout | null = null;
  private cursorVisible: boolean = true;

  constructor(config: StreamConfig = {}, output: Writable = process.stdout) {
    this.prefix = config.prefix ?? '';
    this.showCursor = config.showCursor ?? true;
    this.output = output;
    this.state = {
      lines: [],
      currentLine: '',
      showCursor: this.showCursor,
      isComplete: false,
    };
  }

  /**
   * Start the stream display
   */
  start(): this {
    if (this.isRunning) return this;
    this.isRunning = true;
    
    // Hide terminal cursor
    this.output.write('\x1B[?25l');
    
    // Start cursor blink if enabled
    if (this.showCursor) {
      this.cursorTimer = setInterval(() => {
        this.cursorVisible = !this.cursorVisible;
        this.render();
      }, 530);
    }
    
    // Initial render
    this.render();
    
    return this;
  }

  /**
   * Append text to the stream
   */
  append(text: string): this {
    for (const char of text) {
      if (char === '\n') {
        this.state.lines.push(this.state.currentLine);
        this.state.currentLine = '';
      } else {
        this.state.currentLine += char;
      }
    }
    
    if (this.isRunning) {
      this.render();
    }
    
    return this;
  }

  /**
   * Append a complete line
   */
  appendLine(line: string): this {
    if (this.state.currentLine) {
      this.state.lines.push(this.state.currentLine + line);
      this.state.currentLine = '';
    } else {
      this.state.lines.push(line);
    }
    
    if (this.isRunning) {
      this.render();
    }
    
    return this;
  }

  /**
   * Clear all content
   */
  clear(): this {
    this.state.lines = [];
    this.state.currentLine = '';
    
    if (this.isRunning) {
      this.render();
    }
    
    return this;
  }

  /**
   * Mark stream as complete
   */
  done(): this {
    this.state.isComplete = true;
    
    // Stop cursor blink
    if (this.cursorTimer) {
      clearInterval(this.cursorTimer);
      this.cursorTimer = null;
    }
    
    // Final render without cursor
    this.cursorVisible = false;
    this.render();
    
    // Show terminal cursor and newline
    this.output.write('\x1B[?25h\n');
    this.isRunning = false;
    
    return this;
  }

  /**
   * Get the current content
   */
  getContent(): string {
    const allLines = [...this.state.lines];
    if (this.state.currentLine) {
      allLines.push(this.state.currentLine);
    }
    return allLines.join('\n');
  }

  /**
   * Render the current state
   */
  private render(): void {
    const { lines, currentLine, isComplete } = this.state;
    
    // Build output
    const allLines = [...lines];
    
    // Add current line with optional cursor
    let lastLine = currentLine;
    if (this.showCursor && !isComplete && this.cursorVisible) {
      lastLine += cyan('▋');
    } else if (this.showCursor && !isComplete) {
      lastLine += ' ';
    }
    
    if (lastLine || allLines.length === 0) {
      allLines.push(lastLine);
    }
    
    // Add prefix to each line
    const prefixedLines = allLines.map((line, i) => {
      if (i === 0 && this.prefix) {
        return this.prefix + line;
      }
      return (this.prefix ? ' '.repeat(this.prefix.length) : '') + line;
    });
    
    // Clear previous output and write new
    // Move cursor to start of output area
    const totalLines = prefixedLines.length;
    
    // For simplicity, just clear and rewrite
    // In a more sophisticated implementation, we'd track line count
    this.output.write('\r\x1B[2K');
    
    // Write all lines
    for (let i = 0; i < prefixedLines.length; i++) {
      if (i > 0) {
        this.output.write('\n\x1B[2K');
      }
      this.output.write(prefixedLines[i]);
    }
    
    // Move cursor back to end of last line
    if (prefixedLines.length > 1) {
      this.output.write(`\x1B[${prefixedLines.length - 1}A`);
      this.output.write(`\x1B[${prefixedLines[0].length}G`);
    }
  }
}

/**
 * Create a streaming text display
 */
export function createStream(options?: StreamConfig): StreamingText {
  return new StreamingText(options);
}
