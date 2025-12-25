import { Inquirerer } from 'inquirerer';

import { ExtractedVariables } from '../types';

export interface ProcessOptions {
  argv?: Record<string, any>;
  noTty?: boolean;
  fromPath?: string;
  /**
   * Optional Inquirerer instance to reuse for prompting.
   * If provided, the caller retains ownership and is responsible for closing it.
   * If not provided, a new instance will be created and closed automatically.
   */
  prompter?: Inquirerer;
}

export interface TemplatizerResult {
  outputDir: string;
  variables: ExtractedVariables;
  answers: Record<string, any>;
}
