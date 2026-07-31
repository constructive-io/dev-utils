/**
 * UI Module
 * 
 * Event-driven UI components for building rich terminal interfaces
 */

// Core engine
export { ANSI,UIEngine, UIEngineOptions } from './engine';

// Types
export {
  EventResult,
  Key,
  PackageInfo,
  ProgressConfig,
  SpinnerConfig,
  StreamConfig,
  UIEvent,
  UIScreenConfig,
  UpgradeSelection,
} from './types';

// Components
export { createProgress,ProgressBar } from './progress';
export { createSpinner, Spinner, SPINNER_STYLES } from './spinner';
export { createStream,StreamingText } from './stream';
export { interactiveUpgrade, upgradePrompt } from './upgrade';

// Engine-based prompt implementations (internal use)
export {
  AutocompletePromptConfig,
  autocompletePromptEngine,
  CheckboxPromptConfig,
  checkboxPromptEngine,
  filterOptions,
  ListPromptConfig,
  listPromptEngine,
  renderPromptHeader,
} from './prompts';
