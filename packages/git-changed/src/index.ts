export { defaultBranch, resolveBase } from './base';
export { changedFiles, changedPaths, GitChanged, toAbsolute } from './changed';
export { GitChangedError, isRepo, isShallow, repoRoot } from './git';
export { makeMatcher, normalizeExts, withinAny } from './match';
export type {
  ChangedFile,
  ChangedOptions,
  ChangedResult,
  ChangedSource,
  ChangeStatus
} from './types';
