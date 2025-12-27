/**
 * Event-driven UI Engine Types
 * 
 * This module provides types for building custom interactive terminal UIs
 * with support for key events, timers, and async updates.
 */

/**
 * Normalized key events - abstracts raw escape sequences
 */
export enum Key {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  ENTER = 'ENTER',
  SPACE = 'SPACE',
  BACKSPACE = 'BACKSPACE',
  ESCAPE = 'ESCAPE',
  TAB = 'TAB',
  CTRL_C = 'CTRL_C',
}

/**
 * Event types that can trigger state updates and re-renders
 */
export type UIEvent<T = unknown> =
  | { type: 'key'; key: Key | string }
  | { type: 'char'; char: string }
  | { type: 'tick' }
  | { type: 'progress'; value: number }
  | { type: 'data'; data: T }
  | { type: 'resize'; width: number; height: number };

/**
 * Result of handling an event
 */
export interface EventResult<S, V = unknown> {
  state: S;
  done?: boolean;
  value?: V;
}

/**
 * Configuration for a custom UI screen
 */
export interface UIScreenConfig<S, V = unknown, D = unknown> {
  /** Initial state */
  initialState: S;
  
  /** Render function - returns lines to display */
  render: (state: S) => string[];
  
  /** Event handler - reducer pattern */
  onEvent: (event: UIEvent<D>, state: S) => EventResult<S, V>;
  
  /** Called when the screen starts */
  onStart?: (state: S) => void;
  
  /** Called when the screen exits (cleanup) */
  onExit?: (state: S, value?: V) => void;
  
  /** Whether to hide the cursor */
  hideCursor?: boolean;
  
  /** Interval for tick events (ms) - enables animation */
  tickInterval?: number;
}

/**
 * Spinner configuration
 */
export interface SpinnerConfig {
  /** Text to display next to spinner */
  text: string;
  
  /** Spinner frames (defaults to dots) */
  frames?: string[];
  
  /** Frame interval in ms (default: 80) */
  interval?: number;
}

/**
 * Progress bar configuration
 */
export interface ProgressConfig {
  /** Text to display */
  text: string;
  
  /** Total width of progress bar (default: 40) */
  width?: number;
  
  /** Show percentage (default: true) */
  showPercentage?: boolean;
}

/**
 * Streaming text configuration
 */
export interface StreamConfig {
  /** Optional prefix for each line */
  prefix?: string;
  
  /** Whether to show a cursor at the end */
  showCursor?: boolean;
}

/**
 * Package info for upgrade UI
 */
export interface PackageInfo {
  name: string;
  current: string;
  latest: string;
  type: 'dependencies' | 'devDependencies' | 'peerDependencies';
}

/**
 * Upgrade selection state
 */
export interface UpgradeSelection {
  selected: boolean;
  targetVersion: string;
}
