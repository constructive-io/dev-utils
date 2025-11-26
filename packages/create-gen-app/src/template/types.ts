import { ExtractedVariables } from '../types';

export interface ProcessOptions {
  argv?: Record<string, any>;
  noTty?: boolean;
  fromPath?: string;
}

export interface TemplatizerResult {
  outputDir: string;
  variables: ExtractedVariables;
  answers: Record<string, any>;
}
