import * as fs from 'fs';
import * as path from 'path';
import { ExtractedVariables } from '../types';
import { extractVariables } from './extract';
import { promptUser } from './prompt';
import { replaceVariables } from './replace';
import { ProcessOptions, TemplatizerResult } from './types';

export class Templatizer {
  constructor() {
    // Pure template processor - no configuration needed
  }

  /**
   * Process a local template directory (extract + prompt + replace)
   * @param templateDir - Local directory path (MUST be local, NOT git URL)
   * @param outputDir - Output directory for generated project
   * @param options - Processing options (argv overrides, noTty, prompter)
   * @returns Processing result
   */
  async process(
    templateDir: string,
    outputDir: string,
    options?: ProcessOptions
  ): Promise<TemplatizerResult> {
    this.validateTemplateDir(templateDir);

    // Handle subdirectory within template
    const actualTemplateDir = options?.fromPath
      ? path.join(templateDir, options.fromPath)
      : templateDir;

    this.validateTemplateDir(actualTemplateDir);

    // Extract variables
    const variables = await this.extract(actualTemplateDir);

    // Prompt for values (pass through optional prompter)
    const answers = await this.prompt(
      variables,
      options?.argv,
      options?.noTty,
      options?.prompter
    );

    // Replace variables
    await this.replace(actualTemplateDir, outputDir, variables, answers);

    return {
      outputDir,
      variables,
      answers,
    };
  }

  /**
   * Extract variables from template directory
   */
  async extract(templateDir: string): Promise<ExtractedVariables> {
    return extractVariables(templateDir);
  }

  /**
   * Prompt user for variables
   * @param extracted - Extracted variables from template
   * @param argv - Pre-populated answers
   * @param noTty - Whether to disable TTY mode
   * @param prompter - Optional existing Inquirerer instance to reuse
   */
  async prompt(
    extracted: ExtractedVariables,
    argv?: Record<string, any>,
    noTty?: boolean,
    prompter?: import('inquirerer').Inquirerer
  ): Promise<Record<string, any>> {
    return promptUser(extracted, argv ?? {}, noTty ?? false, prompter);
  }

  /**
   * Replace variables in template
   */
  async replace(
    templateDir: string,
    outputDir: string,
    extracted: ExtractedVariables,
    answers: Record<string, any>
  ): Promise<void> {
    return replaceVariables(templateDir, outputDir, extracted, answers);
  }

  /**
   * Validate template directory exists and has content
   */
  validateTemplateDir(templateDir: string): void {
    if (!fs.existsSync(templateDir)) {
      throw new Error(`Template directory does not exist: ${templateDir}`);
    }

    if (!fs.statSync(templateDir).isDirectory()) {
      throw new Error(`Template path is not a directory: ${templateDir}`);
    }

    const entries = fs.readdirSync(templateDir);
    if (entries.length === 0) {
      throw new Error(`Template directory is empty: ${templateDir}`);
    }
  }
}
