import { Prompter } from 'genomic';

import { ExtractedVariables } from '../types';

export interface ProcessOptions {
  argv?: Record<string, any>;
  noTty?: boolean;
  fromPath?: string;
  /**
   * Optional Prompter instance to reuse for prompting.
   * If provided, the caller retains ownership and is responsible for closing it.
   * If not provided, a new instance will be created and closed automatically.
   */
  prompter?: Prompter;
}

export interface TemplatizerResult {
  outputDir: string;
  variables: ExtractedVariables;
  answers: Record<string, any>;
}
