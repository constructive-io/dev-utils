/**
 * AICodeUI - Interactive AI coding assistant terminal interface
 * 
 * This module provides a claude-code style terminal UI with:
 * - Two-channel output: committed messages (scrollback) + live viewport
 * - Streaming text display for AI responses
 * - Line editor for user input
 * - Status bar and input prompt
 * - In-app scrolling for chat history
 * 
 * Based on the terminal UI spec for building interactive coding tools.
 */

import { Readable, Writable } from 'stream';
import { cyan, dim, green, white, yellow, blue } from 'yanse';
import { TerminalKeypress, KEY_CODES } from '../keypress';
import { ViewportRenderer, createViewport } from './viewport';

/**
 * Message types in the chat
 */
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
}

/**
 * Line editor state for user input
 */
interface LineEditorState {
  text: string;
  cursorPos: number;
}

/**
 * AICodeUI configuration
 */
export interface AICodeUIOptions {
  /** Input stream (defaults to process.stdin) */
  input?: Readable;
  /** Output stream (defaults to process.stdout) */
  output?: Writable;
  /** Existing keypress instance to reuse */
  keypress?: TerminalKeypress;
  /** Height of the viewport (defaults to 12) */
  viewportHeight?: number;
  /** Prompt prefix for user input */
  promptPrefix?: string;
  /** Title shown in status bar */
  title?: string;
  /** Callback when user submits input */
  onSubmit?: (input: string) => void | Promise<void>;
  /** Callback when user presses Ctrl+C */
  onExit?: () => void;
}

/**
 * AICodeUI - Main class for the AI coding assistant interface
 */
export class AICodeUI {
  private input: Readable;
  private output: Writable;
  private keypress: TerminalKeypress;
  private ownsKeypress: boolean;
  private viewport: ViewportRenderer;
  private viewportHeight: number;
  private promptPrefix: string;
  private title: string;
  
  // State
  private isRunning: boolean = false;
  private messages: ChatMessage[] = [];
  private lineEditor: LineEditorState = { text: '', cursorPos: 0 };
  private streamingContent: string = '';
  private isStreaming: boolean = false;
  private scrollOffset: number = 0; // For in-app scrolling
  private cursorVisible: boolean = true;
  private cursorTimer: NodeJS.Timeout | null = null;
  
  // Callbacks
  private onSubmit?: (input: string) => void | Promise<void>;
  private onExit?: () => void;
  
  constructor(options: AICodeUIOptions = {}) {
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
    this.viewportHeight = options.viewportHeight ?? 12;
    this.promptPrefix = options.promptPrefix ?? '> ';
    this.title = options.title ?? 'AI Code Assistant';
    this.onSubmit = options.onSubmit;
    this.onExit = options.onExit;
    
    // Setup keypress handler
    if (options.keypress) {
      this.keypress = options.keypress;
      this.ownsKeypress = false;
    } else {
      this.keypress = new TerminalKeypress(false, this.input);
      this.ownsKeypress = true;
    }
    
    // Create viewport renderer
    this.viewport = createViewport({
      output: this.output,
      viewportHeight: this.viewportHeight,
      hideCursor: true,
    });
  }
  
  /**
   * Start the UI
   */
  start(): this {
    if (this.isRunning) return this;
    this.isRunning = true;
    
    // Start viewport
    this.viewport.start();
    
    // Setup keypress handlers
    this.setupKeyHandlers();
    this.keypress.resume();
    
    // Start cursor blink
    this.cursorTimer = setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
      this.render();
    }, 530);
    
    // Initial render
    this.render();
    
    return this;
  }
  
  /**
   * Stop the UI
   */
  stop(): this {
    if (!this.isRunning) return this;
    this.isRunning = false;
    
    // Stop cursor blink
    if (this.cursorTimer) {
      clearInterval(this.cursorTimer);
      this.cursorTimer = null;
    }
    
    // Cleanup keypress
    this.keypress.pause();
    if (this.ownsKeypress) {
      this.keypress.destroy();
    }
    
    // Stop viewport
    this.viewport.stop();
    
    return this;
  }
  
  /**
   * Add a message to the chat
   */
  addMessage(role: MessageRole, content: string): this {
    // If there's a streaming message, commit it first
    if (this.isStreaming) {
      this.endStream();
    }
    
    this.messages.push({
      role,
      content,
      timestamp: new Date(),
    });
    
    // Commit the message to scrollback
    this.commitMessage(this.messages[this.messages.length - 1]);
    
    this.render();
    return this;
  }
  
  /**
   * Start streaming a response
   */
  startStream(role: MessageRole = 'assistant'): this {
    this.isStreaming = true;
    this.streamingContent = '';
    this.messages.push({
      role,
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    });
    this.render();
    return this;
  }
  
  /**
   * Append content to the streaming response
   */
  appendStream(content: string): this {
    if (!this.isStreaming) {
      this.startStream();
    }
    
    this.streamingContent += content;
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage && lastMessage.isStreaming) {
      lastMessage.content = this.streamingContent;
    }
    
    this.render();
    return this;
  }
  
  /**
   * End the streaming response
   */
  endStream(): this {
    if (!this.isStreaming) return this;
    
    this.isStreaming = false;
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage && lastMessage.isStreaming) {
      lastMessage.isStreaming = false;
      lastMessage.content = this.streamingContent;
      
      // Commit the completed message to scrollback
      this.commitMessage(lastMessage);
    }
    
    this.streamingContent = '';
    this.render();
    return this;
  }
  
  /**
   * Clear the input
   */
  clearInput(): this {
    this.lineEditor = { text: '', cursorPos: 0 };
    this.render();
    return this;
  }
  
  /**
   * Set the input text
   */
  setInput(text: string): this {
    this.lineEditor = { text, cursorPos: text.length };
    this.render();
    return this;
  }
  
  /**
   * Get the current input text
   */
  getInput(): string {
    return this.lineEditor.text;
  }
  
  /**
   * Commit a message to scrollback (above the viewport)
   */
  private commitMessage(message: ChatMessage): void {
    const formatted = this.formatMessage(message);
    this.viewport.commit(formatted + '\n');
  }
  
  /**
   * Format a message for display
   */
  private formatMessage(message: ChatMessage): string {
    const rolePrefix = this.getRolePrefix(message.role);
    const lines = message.content.split('\n');
    
    // First line with role prefix
    const firstLine = rolePrefix + lines[0];
    
    // Subsequent lines with padding
    const padding = ' '.repeat(this.getRolePrefixLength(message.role));
    const restLines = lines.slice(1).map(line => padding + line);
    
    return [firstLine, ...restLines].join('\n');
  }
  
  /**
   * Get the role prefix for display
   */
  private getRolePrefix(role: MessageRole): string {
    switch (role) {
      case 'user':
        return cyan('You: ');
      case 'assistant':
        return green('AI: ');
      case 'system':
        return yellow('System: ');
      default:
        return '';
    }
  }
  
  /**
   * Get the length of the role prefix (for padding)
   */
  private getRolePrefixLength(role: MessageRole): number {
    switch (role) {
      case 'user':
        return 5; // "You: "
      case 'assistant':
        return 4; // "AI: "
      case 'system':
        return 8; // "System: "
      default:
        return 0;
    }
  }
  
  /**
   * Setup keypress handlers
   */
  private setupKeyHandlers(): void {
    // Arrow keys for cursor movement
    this.keypress.on(KEY_CODES.LEFT_ARROW, () => {
      if (this.lineEditor.cursorPos > 0) {
        this.lineEditor.cursorPos--;
        this.render();
      }
    });
    
    this.keypress.on(KEY_CODES.RIGHT_ARROW, () => {
      if (this.lineEditor.cursorPos < this.lineEditor.text.length) {
        this.lineEditor.cursorPos++;
        this.render();
      }
    });
    
    // Up/Down for scrolling through history (future: command history)
    this.keypress.on(KEY_CODES.UP_ARROW, () => {
      // Scroll up in chat history
      if (this.scrollOffset < this.messages.length - 1) {
        this.scrollOffset++;
        this.render();
      }
    });
    
    this.keypress.on(KEY_CODES.DOWN_ARROW, () => {
      // Scroll down in chat history
      if (this.scrollOffset > 0) {
        this.scrollOffset--;
        this.render();
      }
    });
    
    // Enter to submit
    this.keypress.on(KEY_CODES.ENTER, () => {
      const input = this.lineEditor.text.trim();
      if (input) {
        // Add user message
        this.addMessage('user', input);
        this.clearInput();
        
        // Call submit handler
        if (this.onSubmit) {
          Promise.resolve(this.onSubmit(input)).catch(err => {
            this.addMessage('system', `Error: ${err.message}`);
          });
        }
      }
    });
    
    // Backspace
    this.keypress.on(KEY_CODES.BACKSPACE, () => {
      if (this.lineEditor.cursorPos > 0) {
        const { text, cursorPos } = this.lineEditor;
        this.lineEditor.text = text.slice(0, cursorPos - 1) + text.slice(cursorPos);
        this.lineEditor.cursorPos--;
        this.render();
      }
    });
    
    // Legacy backspace
    this.keypress.on(KEY_CODES.BACKSPACE_LEGACY, () => {
      if (this.lineEditor.cursorPos > 0) {
        const { text, cursorPos } = this.lineEditor;
        this.lineEditor.text = text.slice(0, cursorPos - 1) + text.slice(cursorPos);
        this.lineEditor.cursorPos--;
        this.render();
      }
    });
    
    // Ctrl+C to exit
    this.keypress.on(KEY_CODES.CTRL_C, () => {
      this.stop();
      if (this.onExit) {
        this.onExit();
      }
    });
    
    // Character input
    const printableChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const punctuation = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~ ';
    
    (printableChars + punctuation).split('').forEach(char => {
      this.keypress.on(char, () => {
        this.insertChar(char);
      });
    });
  }
  
  /**
   * Insert a character at the cursor position
   */
  private insertChar(char: string): void {
    const { text, cursorPos } = this.lineEditor;
    this.lineEditor.text = text.slice(0, cursorPos) + char + text.slice(cursorPos);
    this.lineEditor.cursorPos++;
    this.render();
  }
  
  /**
   * Render the viewport
   */
  private render(): void {
    if (!this.isRunning) return;
    
    const lines: string[] = [];
    const { width } = this.viewport.getTerminalSize();
    
    // Status bar (top of viewport)
    const statusBar = this.renderStatusBar(width);
    lines.push(statusBar);
    
    // Separator
    lines.push(dim('─'.repeat(Math.min(width, 60))));
    
    // Streaming content area (if streaming)
    if (this.isStreaming && this.streamingContent) {
      const streamLines = this.renderStreamingContent();
      lines.push(...streamLines);
    } else {
      // Show recent message preview or empty space
      const previewLines = this.renderMessagePreview();
      lines.push(...previewLines);
    }
    
    // Fill remaining space
    const contentLines = this.viewportHeight - 3; // status + separator + input
    while (lines.length < contentLines) {
      lines.push('');
    }
    
    // Input prompt (bottom of viewport)
    lines.push(dim('─'.repeat(Math.min(width, 60))));
    const inputLine = this.renderInputLine();
    lines.push(inputLine);
    
    // Calculate cursor position
    const cursorRow = this.viewportHeight - 1;
    const cursorCol = this.promptPrefix.length + this.lineEditor.cursorPos;
    
    this.viewport.render({
      lines,
      cursorRow: this.cursorVisible ? cursorRow : undefined,
      cursorCol: this.cursorVisible ? cursorCol : undefined,
    });
  }
  
  /**
   * Render the status bar
   */
  private renderStatusBar(width: number): string {
    const title = white(this.title);
    const status = this.isStreaming ? yellow(' [streaming...]') : green(' [ready]');
    const scrollInfo = this.scrollOffset > 0 ? dim(` [scroll: ${this.scrollOffset}]`) : '';
    
    return title + status + scrollInfo;
  }
  
  /**
   * Render streaming content
   */
  private renderStreamingContent(): string[] {
    const lines: string[] = [];
    const contentLines = this.streamingContent.split('\n');
    const maxLines = this.viewportHeight - 4; // Leave room for status, separators, input
    
    // Show last N lines of streaming content
    const visibleLines = contentLines.slice(-maxLines);
    
    // Add role prefix to first line
    if (visibleLines.length > 0) {
      visibleLines[0] = green('AI: ') + visibleLines[0];
    }
    
    // Add cursor indicator if streaming
    if (this.cursorVisible) {
      const lastIdx = visibleLines.length - 1;
      if (lastIdx >= 0) {
        visibleLines[lastIdx] += cyan('▋');
      }
    }
    
    lines.push(...visibleLines);
    return lines;
  }
  
  /**
   * Render message preview (when not streaming)
   */
  private renderMessagePreview(): string[] {
    const lines: string[] = [];
    const maxLines = this.viewportHeight - 4;
    
    if (this.messages.length === 0) {
      lines.push(dim('No messages yet. Type a message and press Enter.'));
      return lines;
    }
    
    // Show the last message (or scroll offset)
    const messageIdx = Math.max(0, this.messages.length - 1 - this.scrollOffset);
    const message = this.messages[messageIdx];
    
    if (message) {
      const formatted = this.formatMessage(message);
      const messageLines = formatted.split('\n').slice(0, maxLines);
      lines.push(...messageLines);
      
      if (this.scrollOffset > 0) {
        lines.push(dim(`[${this.scrollOffset} more messages above - use UP/DOWN to scroll]`));
      }
    }
    
    return lines;
  }
  
  /**
   * Render the input line
   */
  private renderInputLine(): string {
    const prefix = blue(this.promptPrefix);
    const text = this.lineEditor.text;
    
    // Show cursor position indicator
    if (this.cursorVisible && !this.isStreaming) {
      const before = text.slice(0, this.lineEditor.cursorPos);
      const after = text.slice(this.lineEditor.cursorPos);
      return prefix + before + cyan('▋') + after;
    }
    
    return prefix + text;
  }
}

/**
 * Create an AICodeUI instance
 */
export function createAICodeUI(options?: AICodeUIOptions): AICodeUI {
  return new AICodeUI(options);
}
