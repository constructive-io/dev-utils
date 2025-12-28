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
import { cyan, dim, green, white, yellow, blue, inverse, magenta } from 'yanse';
import { TerminalKeypress, KEY_CODES } from '../keypress';
import { ViewportRenderer, createViewport } from './viewport';
import stringWidth from 'string-width';
import { cleanAnsi } from 'clean-ansi';

// Box drawing characters
const BOX = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  verticalRight: '├',
  verticalLeft: '┤',
};

// Spinner frames for streaming indicator
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Display width helper (strips ANSI and calculates visual width)
function displayWidth(str: string): number {
  return stringWidth(cleanAnsi(str));
}

// Pad string to target display width
function padRight(str: string, targetWidth: number): string {
  const currentWidth = displayWidth(str);
  if (currentWidth >= targetWidth) return str;
  return str + ' '.repeat(targetWidth - currentWidth);
}

// Truncate string to target display width
function truncate(str: string, maxWidth: number): string {
  const clean = cleanAnsi(str);
  if (stringWidth(clean) <= maxWidth) return str;
  
  let result = '';
  let width = 0;
  for (const char of clean) {
    const charWidth = stringWidth(char);
    if (width + charWidth > maxWidth - 1) break;
    result += char;
    width += charWidth;
  }
  return result + '…';
}

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
 * Supports multiline input with logical lines (hard returns)
 */
interface LineEditorState {
  lines: string[];      // Array of logical lines (hard returns)
  lineIndex: number;    // Current line index
  cursorPos: number;    // Cursor position within current line
}

/**
 * Keybinding action type
 */
type KeyAction = () => void;

/**
 * Keybinding configuration for extensibility
 */
export interface KeyBinding {
  keys: string[];       // Key codes that trigger this action
  action: KeyAction;    // Action to perform
  description?: string; // Optional description for help
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
  /** Custom keybindings to add or override */
  customBindings?: KeyBinding[];
}

/**
 * AICodeUI - Main class for the AI coding assistant interface
 * 
 * Features:
 * - Readline-style editing (Ctrl+A/E, Alt+B/F, Ctrl+W/K/U)
 * - Prompt history (UP/DOWN arrows)
 * - Multiline input (Shift+Enter for newline, Enter to submit)
 * - Message scrolling (PageUp/PageDown)
 * - Extensible keybinding system
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
  private lineEditor: LineEditorState = { lines: [''], lineIndex: 0, cursorPos: 0 };
  private streamingContent: string = '';
  private isStreaming: boolean = false;
  private scrollOffset: number = 0; // For message scrolling
  private cursorVisible: boolean = true;
  private cursorTimer: NodeJS.Timeout | null = null;
  
  // Prompt history
  private history: string[] = [];
  private historyIndex: number = -1;
  private savedInput: string = ''; // Save current input when navigating history
  
  // Kill ring (for Ctrl+K/U)
  private killRing: string = '';
  
  // Preferred column for vertical navigation
  private preferredCol: number = 0;
  
  // Spinner frame for streaming indicator
  private spinnerFrame: number = 0;
  
  // Keybindings
  private bindings: Map<string, KeyAction> = new Map();
  private customBindings: KeyBinding[];
  
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
    this.customBindings = options.customBindings ?? [];
    
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
    this.setupKeyBindings();
    this.registerKeyHandlers();
    this.keypress.resume();
    
    // Start cursor blink and spinner animation
    this.cursorTimer = setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length;
      this.render();
    }, 100); // Faster for smooth spinner animation
    
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
    // If there's a streaming message, end it first
    if (this.isStreaming) {
      this.endStream();
    }
    
    this.messages.push({
      role,
      content,
      timestamp: new Date(),
    });
    
    // Scroll to show the latest message
    this.scrollOffset = 0;
    
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
    }
    
    this.streamingContent = '';
    this.scrollOffset = 0;
    this.render();
    return this;
  }
  
  /**
   * Clear the input
   */
  clearInput(): this {
    this.lineEditor = { lines: [''], lineIndex: 0, cursorPos: 0 };
    this.historyIndex = -1;
    this.render();
    return this;
  }
  
  /**
   * Set the input text
   */
  setInput(text: string): this {
    const lines = text.split('\n');
    this.lineEditor = { 
      lines, 
      lineIndex: lines.length - 1, 
      cursorPos: lines[lines.length - 1].length 
    };
    this.render();
    return this;
  }
  
  /**
   * Get the current input text (joins all lines with newlines)
   */
  getInput(): string {
    return this.lineEditor.lines.join('\n');
  }
  
  /**
   * Get the current line text
   */
  private getCurrentLine(): string {
    return this.lineEditor.lines[this.lineEditor.lineIndex] || '';
  }
  
  /**
   * Set the current line text
   */
  private setCurrentLine(text: string): void {
    this.lineEditor.lines[this.lineEditor.lineIndex] = text;
  }
  
  /**
   * Add a custom keybinding
   */
  addBinding(binding: KeyBinding): this {
    binding.keys.forEach(key => {
      this.bindings.set(key, binding.action);
      this.keypress.on(key, binding.action);
    });
    return this;
  }
  
  /**
   * Remove a keybinding
   */
  removeBinding(key: string): this {
    const action = this.bindings.get(key);
    if (action) {
      this.keypress.off(key, action);
      this.bindings.delete(key);
    }
    return this;
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
   * Setup all keybindings
   */
  private setupKeyBindings(): void {
    this.bindings.clear();
    
    const defaultBindings: KeyBinding[] = [
      { keys: [KEY_CODES.LEFT_ARROW, KEY_CODES.CTRL_B], action: () => this.moveCursorLeft(), description: 'Move cursor left' },
      { keys: [KEY_CODES.RIGHT_ARROW, KEY_CODES.CTRL_F], action: () => this.moveCursorRight(), description: 'Move cursor right' },
      { keys: [KEY_CODES.CTRL_A, KEY_CODES.HOME, KEY_CODES.HOME_ALT, KEY_CODES.HOME_ALT2], action: () => this.moveCursorToStart(), description: 'Move cursor to start of line' },
      { keys: [KEY_CODES.CTRL_E, KEY_CODES.END, KEY_CODES.END_ALT, KEY_CODES.END_ALT2], action: () => this.moveCursorToEnd(), description: 'Move cursor to end of line' },
      { keys: [KEY_CODES.ALT_B, KEY_CODES.ALT_LEFT, KEY_CODES.CTRL_LEFT], action: () => this.moveCursorWordLeft(), description: 'Move cursor word left' },
      { keys: [KEY_CODES.ALT_F, KEY_CODES.ALT_RIGHT, KEY_CODES.CTRL_RIGHT], action: () => this.moveCursorWordRight(), description: 'Move cursor word right' },
      { keys: [KEY_CODES.UP_ARROW, KEY_CODES.CTRL_P], action: () => this.handleUpArrow(), description: 'Move up or previous history' },
      { keys: [KEY_CODES.DOWN_ARROW, KEY_CODES.CTRL_N], action: () => this.handleDownArrow(), description: 'Move down or next history' },
      { keys: [KEY_CODES.PAGE_UP], action: () => this.scrollMessagesUp(), description: 'Scroll messages up' },
      { keys: [KEY_CODES.PAGE_DOWN], action: () => this.scrollMessagesDown(), description: 'Scroll messages down' },
      { keys: [KEY_CODES.BACKSPACE, KEY_CODES.BACKSPACE_LEGACY], action: () => this.deleteCharLeft(), description: 'Delete character left' },
      { keys: [KEY_CODES.DELETE], action: () => this.deleteCharRight(), description: 'Delete character right' },
      { keys: [KEY_CODES.CTRL_W, KEY_CODES.ALT_BACKSPACE], action: () => this.deleteWordLeft(), description: 'Delete word left' },
      { keys: [KEY_CODES.ALT_D], action: () => this.deleteWordRight(), description: 'Delete word right' },
      { keys: [KEY_CODES.CTRL_K], action: () => this.killToEnd(), description: 'Kill to end of line' },
      { keys: [KEY_CODES.CTRL_U], action: () => this.killToStart(), description: 'Kill to start of line' },
      { keys: [KEY_CODES.ENTER], action: () => this.submit(), description: 'Submit input' },
      { keys: [KEY_CODES.SHIFT_ENTER, KEY_CODES.SHIFT_ENTER_ALT, KEY_CODES.CTRL_J], action: () => this.insertNewline(), description: 'Insert newline' },
      { keys: [KEY_CODES.CTRL_C], action: () => this.exit(), description: 'Exit' },
      { keys: [KEY_CODES.CTRL_L], action: () => this.clearScreen(), description: 'Clear screen' },
    ];
    
    defaultBindings.forEach(binding => {
      binding.keys.forEach(key => {
        this.bindings.set(key, binding.action);
      });
    });
    
    this.customBindings.forEach(binding => {
      binding.keys.forEach(key => {
        this.bindings.set(key, binding.action);
      });
    });
  }
  
  private registerKeyHandlers(): void {
    this.bindings.forEach((action, key) => {
      this.keypress.on(key, action);
    });
    
    const printableChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const punctuation = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~ ';
    
    (printableChars + punctuation).split('').forEach(char => {
      if (!this.bindings.has(char)) {
        this.keypress.on(char, () => this.insertChar(char));
      }
    });
  }
  
  private moveCursorLeft(): void {
    if (this.lineEditor.cursorPos > 0) {
      this.lineEditor.cursorPos--;
      this.preferredCol = this.lineEditor.cursorPos;
      this.render();
    } else if (this.lineEditor.lineIndex > 0) {
      this.lineEditor.lineIndex--;
      this.lineEditor.cursorPos = this.getCurrentLine().length;
      this.preferredCol = this.lineEditor.cursorPos;
      this.render();
    }
  }

  private moveCursorRight(): void {
    const line = this.getCurrentLine();
    if (this.lineEditor.cursorPos < line.length) {
      this.lineEditor.cursorPos++;
      this.preferredCol = this.lineEditor.cursorPos;
      this.render();
    } else if (this.lineEditor.lineIndex < this.lineEditor.lines.length - 1) {
      this.lineEditor.lineIndex++;
      this.lineEditor.cursorPos = 0;
      this.preferredCol = 0;
      this.render();
    }
  }

  private moveCursorToStart(): void {
    this.lineEditor.cursorPos = 0;
    this.preferredCol = 0;
    this.render();
  }

  private moveCursorToEnd(): void {
    this.lineEditor.cursorPos = this.getCurrentLine().length;
    this.preferredCol = this.lineEditor.cursorPos;
    this.render();
  }
  
  private moveCursorWordLeft(): void {
    const line = this.getCurrentLine();
    let pos = this.lineEditor.cursorPos;
    while (pos > 0 && /\s/.test(line[pos - 1])) pos--;
    while (pos > 0 && !/\s/.test(line[pos - 1])) pos--;
    this.lineEditor.cursorPos = pos;
    this.preferredCol = pos;
    this.render();
  }
  
  private moveCursorWordRight(): void {
    const line = this.getCurrentLine();
    let pos = this.lineEditor.cursorPos;
    while (pos < line.length && !/\s/.test(line[pos])) pos++;
    while (pos < line.length && /\s/.test(line[pos])) pos++;
    this.lineEditor.cursorPos = pos;
    this.preferredCol = pos;
    this.render();
  }
  
  private historyPrevious(): void {
    if (this.history.length === 0) return;
    if (this.historyIndex === -1) {
      this.savedInput = this.getInput();
    }
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.setInput(this.history[this.history.length - 1 - this.historyIndex]);
    }
  }
  
  private historyNext(): void {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.setInput(this.history[this.history.length - 1 - this.historyIndex]);
    } else if (this.historyIndex === 0) {
      this.historyIndex = -1;
      this.setInput(this.savedInput);
    }
  }

  private handleUpArrow(): void {
    // If on first line, navigate history
    if (this.lineEditor.lineIndex === 0) {
      this.historyPrevious();
      return;
    }
    // Otherwise, move to previous line
    this.lineEditor.lineIndex--;
    const newLine = this.getCurrentLine();
    this.lineEditor.cursorPos = Math.min(this.preferredCol, newLine.length);
    this.render();
  }

  private handleDownArrow(): void {
    // If on last line, navigate history
    if (this.lineEditor.lineIndex >= this.lineEditor.lines.length - 1) {
      this.historyNext();
      return;
    }
    // Otherwise, move to next line
    this.lineEditor.lineIndex++;
    const newLine = this.getCurrentLine();
    this.lineEditor.cursorPos = Math.min(this.preferredCol, newLine.length);
    this.render();
  }

  private scrollMessagesUp(): void {
    if (this.scrollOffset < this.messages.length - 1) {
      this.scrollOffset++;
      this.render();
    }
  }
  
  private scrollMessagesDown(): void {
    if (this.scrollOffset > 0) {
      this.scrollOffset--;
      this.render();
    }
  }
  
  private deleteCharLeft(): void {
    if (this.lineEditor.cursorPos > 0) {
      const line = this.getCurrentLine();
      this.setCurrentLine(line.slice(0, this.lineEditor.cursorPos - 1) + line.slice(this.lineEditor.cursorPos));
      this.lineEditor.cursorPos--;
      this.render();
    } else if (this.lineEditor.lineIndex > 0) {
      const currentLine = this.getCurrentLine();
      this.lineEditor.lines.splice(this.lineEditor.lineIndex, 1);
      this.lineEditor.lineIndex--;
      const prevLine = this.getCurrentLine();
      this.lineEditor.cursorPos = prevLine.length;
      this.setCurrentLine(prevLine + currentLine);
      this.render();
    }
  }
  
  private deleteCharRight(): void {
    const line = this.getCurrentLine();
    if (this.lineEditor.cursorPos < line.length) {
      this.setCurrentLine(line.slice(0, this.lineEditor.cursorPos) + line.slice(this.lineEditor.cursorPos + 1));
      this.render();
    } else if (this.lineEditor.lineIndex < this.lineEditor.lines.length - 1) {
      const nextLine = this.lineEditor.lines[this.lineEditor.lineIndex + 1];
      this.setCurrentLine(line + nextLine);
      this.lineEditor.lines.splice(this.lineEditor.lineIndex + 1, 1);
      this.render();
    }
  }
  
  private deleteWordLeft(): void {
    const line = this.getCurrentLine();
    let pos = this.lineEditor.cursorPos;
    const startPos = pos;
    while (pos > 0 && /\s/.test(line[pos - 1])) pos--;
    while (pos > 0 && !/\s/.test(line[pos - 1])) pos--;
    this.killRing = line.slice(pos, startPos);
    this.setCurrentLine(line.slice(0, pos) + line.slice(startPos));
    this.lineEditor.cursorPos = pos;
    this.render();
  }
  
  private deleteWordRight(): void {
    const line = this.getCurrentLine();
    let pos = this.lineEditor.cursorPos;
    const startPos = pos;
    while (pos < line.length && !/\s/.test(line[pos])) pos++;
    while (pos < line.length && /\s/.test(line[pos])) pos++;
    this.killRing = line.slice(startPos, pos);
    this.setCurrentLine(line.slice(0, startPos) + line.slice(pos));
    this.render();
  }
  
  private killToEnd(): void {
    const line = this.getCurrentLine();
    this.killRing = line.slice(this.lineEditor.cursorPos);
    this.setCurrentLine(line.slice(0, this.lineEditor.cursorPos));
    this.render();
  }
  
  private killToStart(): void {
    const line = this.getCurrentLine();
    this.killRing = line.slice(0, this.lineEditor.cursorPos);
    this.setCurrentLine(line.slice(this.lineEditor.cursorPos));
    this.lineEditor.cursorPos = 0;
    this.render();
  }
  
  private insertChar(char: string): void {
    const line = this.getCurrentLine();
    this.setCurrentLine(line.slice(0, this.lineEditor.cursorPos) + char + line.slice(this.lineEditor.cursorPos));
    this.lineEditor.cursorPos++;
    this.preferredCol = this.lineEditor.cursorPos;
    this.render();
  }
  
  private insertNewline(): void {
    const line = this.getCurrentLine();
    const before = line.slice(0, this.lineEditor.cursorPos);
    const after = line.slice(this.lineEditor.cursorPos);
    this.setCurrentLine(before);
    this.lineEditor.lines.splice(this.lineEditor.lineIndex + 1, 0, after);
    this.lineEditor.lineIndex++;
    this.lineEditor.cursorPos = 0;
    this.render();
  }
  
  private submit(): void {
    const input = this.getInput().trim();
    if (input) {
      if (this.history.length === 0 || this.history[this.history.length - 1] !== input) {
        this.history.push(input);
      }
      this.addMessage('user', input);
      this.clearInput();
      if (this.onSubmit) {
        Promise.resolve(this.onSubmit(input)).catch(err => {
          this.addMessage('system', `Error: ${err.message}`);
        });
      }
    }
  }
  
  private exit(): void {
    this.stop();
    if (this.onExit) {
      this.onExit();
    }
  }
  
  private clearScreen(): void {
    this.scrollOffset = 0;
    this.render();
  }
  
  /**
   * Render the viewport
   */
  private render(): void {
    if (!this.isRunning) return;
    
    const lines: string[] = [];
    const { width } = this.viewport.getTerminalSize();
    
    // Chrome = 3 lines (separator + separator + status bar)
    const chromeLines = 3;
    // Input can grow up to (viewportHeight - chromeLines - 1) to leave at least 1 line for content
    const maxInputLines = Math.max(1, this.viewportHeight - chromeLines - 1);
    const actualInputLines = Math.min(this.lineEditor.lines.length, maxInputLines);
    
    // Calculate available space for content (welcome box or conversation)
    // Clamp to 0 minimum to handle very small terminals
    const availableContentLines = Math.max(0, this.viewportHeight - chromeLines - actualInputLines);
    
    // Show welcome box if no messages, otherwise show conversation
    if (this.messages.length === 0 && !this.isStreaming) {
      const welcomeLines = this.renderWelcomeBox(width);
      lines.push(...welcomeLines.slice(0, availableContentLines));
    } else {
      // Render conversation history with dynamic max lines
      const conversationLines = this.renderConversation(width, availableContentLines);
      lines.push(...conversationLines);
    }
    
    // Fill remaining space to push input to bottom
    while (lines.length < availableContentLines) {
      lines.push('');
    }
    
    // Full-width separator before input
    lines.push(dim(BOX.horizontal.repeat(width)));
    
    // Input prompt (with windowing if needed)
    const inputLines = this.renderInputLines(width, actualInputLines);
    lines.push(...inputLines);
    
    // Full-width separator after input
    lines.push(dim(BOX.horizontal.repeat(width)));
    
    // Status bar at bottom
    const statusBar = this.renderStatusBar(width);
    lines.push(statusBar);
    
    // INVARIANT: lines must be exactly viewportHeight
    // If too many lines, keep the bottom (input/status) - slice from end
    if (lines.length > this.viewportHeight) {
      lines.splice(0, lines.length - this.viewportHeight);
    }
    // If too few lines, pad at top
    while (lines.length < this.viewportHeight) {
      lines.unshift('');
    }
    
    this.viewport.render({ lines });
  }
  
  /**
   * Render the welcome box (Claude Code style)
   */
  private renderWelcomeBox(width: number): string[] {
    const lines: string[] = [];
    const boxWidth = Math.min(width, 80);
    const innerWidth = boxWidth - 2;
    
    // Title bar
    const titleText = ` ${this.title} `;
    const titlePadding = BOX.horizontal.repeat(3);
    const remainingWidth = innerWidth - displayWidth(titlePadding + titleText);
    const titleLine = BOX.topLeft + titlePadding + cyan(titleText) + BOX.horizontal.repeat(Math.max(0, remainingWidth)) + BOX.topRight;
    lines.push(titleLine);
    
    // Two-column layout
    const leftWidth = Math.floor(innerWidth * 0.55);
    const rightWidth = innerWidth - leftWidth - 1; // -1 for divider
    
    // Welcome content (left side)
    const leftContent = [
      '',
      '           Welcome!',
      '',
      '        * ▐▛███▜▌ *',
      '       * ▝▜█████▛▘ *',
      '        *  ▘▘ ▝▝  *',
      '',
      dim('  Ctrl+J: newline, Enter: send'),
    ];
    
    // Tips content (right side)
    const rightContent = [
      cyan('Tips for getting started'),
      dim('Type a message to begin...'),
      BOX.horizontal.repeat(rightWidth),
      cyan('Keybindings'),
      dim('UP/DOWN: history/navigate'),
      dim('PageUp/Down: scroll'),
      dim('Ctrl+C: exit'),
      '',
    ];
    
    // Render rows
    const maxRows = Math.max(leftContent.length, rightContent.length);
    for (let i = 0; i < maxRows; i++) {
      const leftText = leftContent[i] || '';
      const rightText = rightContent[i] || '';
      const leftPadded = padRight(leftText, leftWidth);
      const rightPadded = padRight(rightText, rightWidth);
      lines.push(BOX.vertical + leftPadded + dim(BOX.vertical) + rightPadded + BOX.vertical);
    }
    
    // Bottom border
    lines.push(BOX.bottomLeft + BOX.horizontal.repeat(innerWidth) + BOX.bottomRight);
    
    return lines;
  }
  
  /**
   * Render conversation history
   */
  private renderConversation(width: number, maxLines: number): string[] {
    const lines: string[] = [];
    
    // Collect all message lines
    const allLines: string[] = [];
    
    for (const message of this.messages) {
      // Skip messages that are currently streaming (they're rendered separately below)
      if (message.isStreaming) continue;
      
      if (message.role === 'user') {
        // User messages with > prefix
        const contentLines = message.content.split('\n');
        contentLines.forEach((line, idx) => {
          const prefix = idx === 0 ? cyan('> ') : '  ';
          allLines.push(prefix + line);
        });
      } else if (message.role === 'assistant') {
        // Assistant messages with bullet prefix
        allLines.push('');
        const contentLines = message.content.split('\n');
        contentLines.forEach((line, idx) => {
          const prefix = idx === 0 ? green('⏺ ') : '  ';
          allLines.push(prefix + line);
        });
      } else {
        // System messages
        allLines.push(yellow('! ') + message.content);
      }
      allLines.push(''); // Empty line between messages
    }
    
    // Add streaming content if active
    if (this.isStreaming) {
      const spinner = SPINNER_FRAMES[this.spinnerFrame];
      if (this.streamingContent) {
        const contentLines = this.streamingContent.split('\n');
        contentLines.forEach((line, idx) => {
          const prefix = idx === 0 ? green('⏺ ') : '  ';
          allLines.push(prefix + line);
        });
      } else {
        allLines.push(magenta(spinner) + dim(' Thinking... (esc to interrupt)'));
      }
    }
    
    // Reserve 1 line for scroll indicator if needed
    const hasScrollIndicator = this.scrollOffset > 0;
    const effectiveMaxLines = hasScrollIndicator ? maxLines - 1 : maxLines;
    
    // Apply scroll offset and take last N lines
    const startIdx = Math.max(0, allLines.length - effectiveMaxLines - this.scrollOffset);
    const endIdx = allLines.length - this.scrollOffset;
    const visibleLines = allLines.slice(startIdx, endIdx);
    
    lines.push(...visibleLines);
    
    // Show scroll indicator if needed (already reserved space above)
    if (hasScrollIndicator) {
      lines.push(dim(`  [${this.scrollOffset} more below - PageDown to scroll]`));
    }
    
    return lines;
  }
  
  /**
   * Render the status bar
   */
  private renderStatusBar(width: number): string {
    const leftInfo = dim('  Ctrl+C: exit');
    const rightInfo = this.isStreaming 
      ? yellow('streaming...') 
      : (this.historyIndex >= 0 ? dim(`history: ${this.historyIndex + 1}/${this.history.length}`) : '');
    
    const padding = width - displayWidth(leftInfo) - displayWidth(rightInfo);
    return leftInfo + ' '.repeat(Math.max(0, padding)) + rightInfo;
  }
  
  /**
   * Render the input lines (with windowing when lines exceed maxVisibleLines)
   */
  private renderInputLines(width: number, maxVisibleLines: number): string[] {
    const lines: string[] = [];
    const inputText = this.getInput();
    const hasContent = inputText.length > 0;
    const totalLines = this.lineEditor.lines.length;
    const cursorLine = this.lineEditor.lineIndex;
    
    // Calculate which lines to show (keep cursor line visible)
    let startLine = 0;
    if (totalLines > maxVisibleLines) {
      // Keep cursor visible with some context
      if (cursorLine < Math.floor(maxVisibleLines / 2)) {
        startLine = 0;
      } else if (cursorLine > totalLines - Math.ceil(maxVisibleLines / 2)) {
        startLine = totalLines - maxVisibleLines;
      } else {
        startLine = cursorLine - Math.floor(maxVisibleLines / 2);
      }
    }
    const endLine = Math.min(startLine + maxVisibleLines, totalLines);
    
    for (let idx = startLine; idx < endLine; idx++) {
      const line = this.lineEditor.lines[idx];
      const prefix = idx === 0 ? cyan('> ') : '  ';
      let lineContent: string;
      
      if (idx === this.lineEditor.lineIndex && !this.isStreaming) {
        // Show cursor on current line
        const before = line.slice(0, this.lineEditor.cursorPos);
        const cursorChar = line[this.lineEditor.cursorPos] || ' ';
        const after = line.slice(this.lineEditor.cursorPos + 1);
        // Only show inverse cursor every other frame for blink effect
        const showCursor = Math.floor(this.spinnerFrame / 2) % 2 === 0;
        lineContent = before + (showCursor ? inverse(cursorChar) : cursorChar) + after;
      } else {
        lineContent = line;
      }
      
      // Add info on last visible line if there's content
      if (idx === endLine - 1 && hasContent) {
        // Show line count if scrolling, otherwise show send hint
        const info = totalLines > maxVisibleLines
          ? dim(` ln ${cursorLine + 1}/${totalLines}`)
          : dim(' ↵ send');
        const lineWidth = displayWidth(prefix + lineContent);
        const infoWidth = displayWidth(info);
        if (lineWidth + infoWidth < width - 2) {
          const padding = width - lineWidth - infoWidth - 2;
          lineContent = lineContent + ' '.repeat(Math.max(0, padding)) + info;
        }
      }
      
      lines.push(prefix + lineContent);
    }
    
    return lines;
  }
}

/**
 * Create an AICodeUI instance
 */
export function createAICodeUI(options?: AICodeUIOptions): AICodeUI {
  return new AICodeUI(options);
}
