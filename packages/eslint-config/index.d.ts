import type { Linter } from 'eslint';

export declare const defaultIgnores: string[];
export declare const files: string[];
export declare const rules: Linter.RulesRecord;

export interface CreateConfigOptions {
  ignores?: string[];
  files?: string[];
  rules?: Linter.RulesRecord;
}

export declare function createConfig(
  options?: CreateConfigOptions
): Linter.Config[];

declare const config: Linter.Config[];
export default config;
