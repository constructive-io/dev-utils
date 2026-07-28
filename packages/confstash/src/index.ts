/**
 * confstash — standardized project configuration loading for CLI tools.
 *
 * Discovers `<tool>.config.{ts,js,mjs,cjs}`, `.<tool>rc{,.json,.yaml,.yml,.js}`,
 * `<tool>.json`, and `package.json` keys via walk-up search; merges layered
 * config (defaults -> presets/extends -> user stash -> project file -> env ->
 * overrides) with per-key provenance.
 */

export { defaultSearchPlaces, findConfigSync, findUpDir, type FoundConfig } from './discover';
export { expandExtends, type ExtendsContext } from './extends';
export { createConfigLoader, defineConfig, type ConfigLoader } from './loader';
export { ConfigLoadError, loadFile, loadFileSync } from './loaders';
export { deepMerge, explainLayers, mergeLayers } from './merge';
export type {
  ArrayMergeStrategy,
  ConfigLayer,
  ConfigLoaderOptions,
  ExplainedValue,
  LayerSource,
  LoadParams,
  LoadResult,
  SearchPlace
} from './types';
