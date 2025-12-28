/**
 * UI Module
 * 
 * Event-driven UI components for building rich terminal interfaces
 */

// Core engine
export { UIEngine, UIEngineOptions, ANSI } from './engine';

// Types
export {
  Key,
  UIEvent,
  EventResult,
  UIScreenConfig,
  SpinnerConfig,
  ProgressConfig,
  StreamConfig,
  PackageInfo,
  UpgradeSelection,
} from './types';

// Components
export { Spinner, createSpinner, SPINNER_STYLES } from './spinner';
export { ProgressBar, createProgress } from './progress';
export { StreamingText, createStream } from './stream';
export { interactiveUpgrade, upgradePrompt } from './upgrade';

// Engine-based prompt implementations (internal use)
export {
  listPromptEngine,
  autocompletePromptEngine,
  checkboxPromptEngine,
  filterOptions,
  renderPromptHeader,
  ListPromptConfig,
  AutocompletePromptConfig,
  CheckboxPromptConfig,
} from './prompts';
