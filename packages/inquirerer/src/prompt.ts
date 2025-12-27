import yanse, { red, whiteBright, yellow, gray, dim, green, cyan, white, blue } from 'yanse';
import readline from 'readline';
import { Readable, Writable } from 'stream';

import { KEY_CODES, TerminalKeypress } from './keypress';
import { AutocompleteQuestion, CheckboxQuestion, ConfirmQuestion, ListQuestion, NumberQuestion, OptionValue, Question, TextQuestion, Validation, Value } from './question';
import { DefaultResolverRegistry, globalResolverRegistry } from './resolvers';
// import { writeFileSync } from 'fs';

// const debuglog = (obj: any) => {
//   writeFileSync('tailme', JSON.stringify(obj, null, 2));
// }

export interface ManPageInfo {
  commandName: string;
  questions: Question[];
  author?: string;
  description?: string;
}
export interface PromptOptions {
  usageText?: string;
  manPageInfo?: ManPageInfo;
  mutateArgs?: boolean;
}

export function reorderQuestionsByDeps(questions: Question[]): Question[] {
  const nameToIndex = new Map<string, number>();
  questions.forEach((q, idx) => nameToIndex.set(q.name, idx));

  const resolved = new Set<string>();
  const result: Question[] = [];

  function addQuestion(q: Question) {
    // If this question depends on others, ensure those are added first
    if (q.dependsOn && q.dependsOn.length > 0) {
      for (const dep of q.dependsOn) {
        if (!resolved.has(dep)) {
          const depIdx = nameToIndex.get(dep);
          if (depIdx === undefined) {
            throw new Error(`Unknown dependency: ${dep}`);
          }
          addQuestion(questions[depIdx]);
        }
      }
    }
    if (!resolved.has(q.name)) {
      resolved.add(q.name);
      result.push(q);
    }
  }

  for (const q of questions) {
    addQuestion(q);
  }

  return result;
}


const validationMessage = (question: Question, ctx: PromptContext): string => {
  if (ctx.numTries === 0 || ctx.validation.success) {
    return ''; // No message if first attempt or validation was successful
  }

  if (ctx.validation.reason) {
    return red(`The field "${question.name}" is invalid: ${ctx.validation.reason}\n`);
  }

  switch (ctx.validation.type) {
    case 'required':
      return red(`The field "${question.name}" is required. Please provide a value.\n`);
    case 'pattern':
      return red(`The field "${question.name}" does not match the pattern: ${question.pattern}.\n`);
    default:
      return red(`The field "${question.name}" is invalid. Please try again.\n`);
  }
};
class PromptContext {
  numTries: number = 0;
  needsInput: boolean = true;
  validation: Validation = { success: false };

  constructor() { }

  tryAgain(validation: Partial<Validation>): void {
    this.numTries++;
    this.needsInput = true;
    this.validation = { ...this.validation, ...validation, success: false };
  }

  nextQuestion(): void {
    this.numTries = 0;
    this.needsInput = false;
    this.validation = { success: true };
  }

  process(validation: Validation | boolean): Validation {
    if (typeof validation === 'boolean') {
      if (validation) {
        this.nextQuestion();
      } else {
        this.tryAgain({ type: 'validation' });
      }
    } else {
      if (validation.success) {
        this.nextQuestion();
      } else {
        this.tryAgain(validation);
      }
    }
    return this.validation;
  }
}


function generatePromptMessage(question: Question, ctx: PromptContext): string {
  const {
    message,
    name,
    type,
    default: def,
    options = [],
    description
  } = question as Question & { options?: OptionValue[]; description?: string };

  const lines: string[] = [];

  // 1. Main prompt label with --name inline (and aliases if present)
  const aliasInfo = question.alias
    ? `, ${(Array.isArray(question.alias) ? question.alias : [question.alias])
        .map(a => a.length === 1 ? `-${a}` : `--${a}`)
        .join(', ')}`
    : '';
  let promptLine = whiteBright.bold(message || `${name}?`) + ' ' + dim(`(--${name}${aliasInfo})`);

  // 2. Append default inline (only if present)
  switch (type) {
    case 'confirm':
      promptLine += ' (y/n)';
      if (def !== undefined) {
        promptLine += ` ${yellow(`[${def ? 'y' : 'n'}]`)}`;
      }
      break;

    case 'text':
    case 'number':
      if (def !== undefined) {
        promptLine += ` ${yellow(`[${def}]`)}`;
      }
      break;

    case 'autocomplete':
    case 'list':
    case 'checkbox':
      if (def !== undefined) {
        const defaults = Array.isArray(def) ? def : [def];
        const rendered = defaults.map(d => yellow(d)).join(gray(', '));
        promptLine += ` ${yellow(`[${rendered}]`)}`;
      }
      break;
  }

  lines.push(promptLine);

  // 3. Optional description below title
  if (description) {
    lines.push(dim(description));
  }

  // 4. Validation message if applicable
  const validation = validationMessage(question, ctx);
  if (validation) {
    lines.push(validation); // already styled red
  }

  return lines.join('\n') + '\n';
}

export interface InquirererOptions {
  noTty?: boolean;
  input?: Readable;
  output?: Writable;
  useDefaults?: boolean;
  globalMaxLines?: number;
  mutateArgs?: boolean;
  resolverRegistry?: DefaultResolverRegistry;
}
export class Inquirerer {
  private rl: readline.Interface | null;
  private keypress: TerminalKeypress | null;
  private noTty: boolean;
  private output: Writable;
  private input: Readable;
  private useDefaults: boolean;
  private globalMaxLines: number;
  private mutateArgs: boolean;
  private resolverRegistry: DefaultResolverRegistry;

  private handledKeys: Set<string> = new Set();

  constructor(
    options?: InquirererOptions
  ) {
    const {
      noTty = false,
      input = process.stdin,
      output = process.stdout,
      useDefaults = false,
      globalMaxLines = 10,
      mutateArgs = true,
      resolverRegistry = globalResolverRegistry
    } = options ?? {}

    this.useDefaults = useDefaults;
    this.noTty = noTty;
    this.output = output;
    this.mutateArgs = mutateArgs;
    this.input = input;
    this.globalMaxLines = globalMaxLines;
    this.resolverRegistry = resolverRegistry;

    if (!noTty) {
      this.rl = readline.createInterface({
        input,
        output
      });
      this.keypress = new TerminalKeypress(noTty, input);
    } else {
      this.rl = null;
      this.keypress = null;
    }
  }

  private clearScreen() {
    // same as console.clear()
    this.output.write('\x1Bc'); // This is the escape sequence to clear the terminal screen.
  }

  private write(message: string) {
    this.output.write(message);
  }

  private log(message: string) {
    this.output.write(message + '\n');
  }

  private getInput(input: string) {
    return `${white('>')} ${input}`;
  }

  private getPrompt(question: Question, ctx: PromptContext, input: string) {
    const promptMessage = generatePromptMessage(question, ctx);
    return promptMessage + this.getInput(input);
  }
  private displayPrompt(question: Question, ctx: PromptContext, input: string) {
    const prompt = this.getPrompt(question, ctx, input);
    this.log(prompt);
  }

  public generateManPage(opts: ManPageInfo): string {
    let manPage = `${white('NAME')}\n\t${white(opts.commandName)} ${opts.description ?? ''}\n\n`;

    // Constructing the SYNOPSIS section with required and optional arguments
    let requiredArgs = '';
    let optionalArgs = '';

    opts.questions.forEach(question => {
      if (question.required) {
        requiredArgs += ` ${white('--' + question.name)} <${gray(question.name)}>`;
      } else {
        optionalArgs += ` [${white('--' + question.name)}${question.default ? `=${gray(String(question.default))}` : ''}]`;
      }
    });

    manPage += `${white('SYNOPSIS')}\n\t${white(opts.commandName)}${gray(requiredArgs)}${gray(optionalArgs)}\n\n`;
    manPage += `${white('DESCRIPTION')}\n\tUse this command to interact with the application. It supports the following options:\n\n`;

    opts.questions.forEach(question => {
      manPage += `${white(question.name.toUpperCase())}\n`;
      manPage += `\t${white('Type:')} ${gray(question.type)}\n`;
      if (question.alias) {
        const aliases = Array.isArray(question.alias) ? question.alias : [question.alias];
        const aliasStr = aliases.map(a => a.length === 1 ? `-${a}` : `--${a}`).join(', ');
        manPage += `\t${white('Alias:')} ${gray(aliasStr)}\n`;
      }
      if (question.message) {
        manPage += `\t${white('Summary:')} ${gray(question.message)}\n`;
      }
      if (question.description) {
        manPage += `\t${white('Description:')} ${gray(question.description)}\n`;
      }
      if ('options' in question) {
        const optionsList = Array.isArray(question.options)
          ? question.options.map(opt => typeof opt === 'string' ? gray(opt) : `${gray(opt.name)} (${gray(opt.value)})`).join(', ')
          : '';
        manPage += `\t${white('Options:')} ${gray(optionsList)}\n`;
      }
      if (question.default !== undefined) {
        manPage += `\t${white('Default:')} ${gray(JSON.stringify(question.default))}\n`;
      }
      if (question.required) {
        manPage += `\t${white('Required:')} ${gray('Yes')}\n`;
      } else {
        manPage += `\t${white('Required:')} ${gray('No')}\n`;
      }
      manPage += '\n';
    });

    manPage += `${white('EXAMPLES')}\n\tExample usage of \`${white(opts.commandName)}\`.\n\t$ ${white(opts.commandName)}${gray(requiredArgs)}${gray(optionalArgs)}\n\n`;
    manPage += opts.author ? `${white('AUTHOR')}\n\t${white(opts.author)}\n` : '';
    return manPage;
  }

  private isValidatableAnswer(answer: any): boolean {
    return answer !== undefined;
  }

  private validateAnswer(question: Question, answer: any, obj: any, ctx: PromptContext): Validation {
    const validation = this.validateAnswerPattern(question, answer);
    if (!validation.success) {
      return ctx.process(validation);
    }

    if (question.validate) {
      const customValidation = question.validate(answer, obj);
      return ctx.process(customValidation);
    }

    return ctx.process({
      success: true
    });
  }

  private isValid(question: Question, obj: any, ctx: PromptContext): boolean {
    if (this.isValidatableAnswer(obj[question.name])) {
      obj[question.name] = this.sanitizeAnswer(question, obj[question.name], obj);
      const validationResult = this.validateAnswer(question, obj[question.name], obj, ctx);
      if (!validationResult.success) {
        return false;
      }
    }

    if (question.required && this.isEmptyAnswer(obj[question.name])) {
      ctx.tryAgain({ type: 'required' });
      return false;
    }

    return true;
  }

  private validateAnswerPattern(question: Question, answer: any): Validation {
    if (question.pattern && typeof answer === 'string') {
      const regex = new RegExp(question.pattern);
      const success = regex.test(answer);
      if (success) {
        return {
          success
        }
      } else {
        return {
          type: 'pattern',
          success: false,
          reason: question.pattern
        }
      }
    }
    return {
      success: true
    }
  }

  private isEmptyAnswer(answer: any): boolean {
    switch (true) {
      case answer === undefined:
      case answer === null:
      case answer === '':
      case Array.isArray(answer) && answer.length === 0:
        return true;
    }
    return false;
  }

  private sanitizeAnswer(question: Question, answer: any, obj: any): any {
    if (question.sanitize) {
      return question.sanitize(answer, obj);
    }
    return answer;
  }

  public exit() {
    this.clearScreen();
    this.close();
  }

  public async prompt<T extends object>(
    argv: T,
    questions: Question[],
    options?: PromptOptions
  ): Promise<T> {

    // use local mutateArgs if defined, otherwise global mutateArgs
    const shouldMutate = options?.mutateArgs !== undefined ? options.mutateArgs : this.mutateArgs;
    
    // Create a working copy of argv - deep clone the _ array to avoid shared reference
    let obj: any = shouldMutate ? argv : { ...argv };
    const argvAny = argv as any;
    if (!shouldMutate && Array.isArray(argvAny._)) {
      obj._ = [...argvAny._];
    }

    // Expand aliases before any other processing
    // This allows users to use short flags like -w instead of --workspace
    this.expandAliases(questions, obj);

    // Resolve dynamic defaults before processing questions
    await this.resolveDynamicDefaults(questions);

    // Resolve dynamic options before processing questions
    await this.resolveOptionsFrom(questions);

    // Resolve setFrom values - these bypass prompting entirely
    await this.resolveSetValues(questions, obj);

    // Extract positional arguments from argv._ and assign to questions with _: true
    // This must happen before applyOverrides so positional values flow through override pipeline
    // Returns the number of positional arguments consumed for stripping
    const consumedCount = this.extractPositionalArgs(obj, questions);
    
    // Strip consumed positionals from obj._ (the working copy)
    if (consumedCount > 0 && Array.isArray(obj._)) {
      obj._ = obj._.slice(consumedCount);
      // If mutating, also update the original argv._
      if (shouldMutate) {
        argvAny._ = obj._;
      }
    }

    // first loop through the question, and set any overrides in case other questions use objs for validation
    this.applyOverrides(obj, obj, questions);

    // Check for required arguments when no terminal is available (non-interactive mode)
    if (this.noTty && this.hasMissingRequiredArgs(questions, argv)) {

      // Apply default values for all questions
      this.applyDefaultValues(questions, obj);

      // Recheck for missing required arguments after applying defaults
      // NOT so sure this would ever happen, but possible if developer did something wrong
      if (!this.hasMissingRequiredArgs(questions, argv)) {
        return obj as T;  // Return the updated object if no required arguments are missing
      }

      // Handle error for missing required arguments
      this.handleMissingArgsError(options);
      throw new Error('Missing required arguments. Please provide all required parameters.');
    }



    const ordered = reorderQuestionsByDeps(questions);

    for (let index = 0; index < ordered.length; index++) {
      const question = ordered[index];
      const ctx: PromptContext = new PromptContext();

      // obj is already either argv itself, or a clone, but let's check if it has the property
      if (question.name in obj) {
        this.handleOverrides(argv, obj, question);
        ctx.nextQuestion();
        continue;
      }

      if (question.when && !question.when(obj)) {
        ctx.nextQuestion();
        continue;
      }

      // Apply default value if applicable
      // this is if useDefault is set, rare! not typical defaults which happen AFTER
      // this is mostly to avoid a prompt for "hidden" options
      if ('default' in question && (this.useDefaults || question.useDefault)) {
        obj[question.name] = question.default;
        continue;  // Skip to the next question since the default is applied
      }

      while (ctx.needsInput) {
        obj[question.name] = await this.handleQuestionType(question, ctx);

        if (!this.isValid(question, obj, ctx)) {
          if (this.noTty) {
            // If you're not valid and here with noTty, you're out!
            this.clearScreen(); // clear before leaving, not calling exit() since it may be a bad pattern to continue, devs should try/catch
            throw new Error('Missing required arguments. Please provide all required parameters.');
          }
          continue;
        }
        // If input passes validation and is not empty, or not required, move to the next question
        ctx.nextQuestion();
      }
    }

    return obj as T;
  }

  private handleMissingArgsError(options?: { usageText?: string; manPageInfo?: any }): void {
    this.clearScreen();
    if (options?.usageText) {
      this.log(options.usageText);
    } else if (options?.manPageInfo) {
      this.log(this.generateManPage(options.manPageInfo));
    } else {
      this.log('Missing required arguments. Please provide all required parameters.');
    }
  }

  private hasMissingRequiredArgs(questions: Question[], argv: any): boolean {
    return questions.some(question => question.required && this.isEmptyAnswer(argv[question.name]));
  }

  /**
   * Resolves the default value for a question using the resolver system.
   * Priority: defaultFrom > default > undefined
   */
  private async resolveQuestionDefault(question: Question): Promise<any> {
    // Try to resolve from defaultFrom first
    if ('defaultFrom' in question && question.defaultFrom) {
      const resolved = await this.resolverRegistry.resolve(question.defaultFrom);
      if (resolved !== undefined) {
        return resolved;
      }
    }

    // Fallback to static default
    if ('default' in question) {
      return question.default;
    }

    return undefined;
  }

  /**
   * Resolves dynamic defaults for all questions that have defaultFrom specified.
   * Updates the question.default property with the resolved value.
   */
  private async resolveDynamicDefaults(questions: Question[]): Promise<void> {
    for (const question of questions) {
      if ('defaultFrom' in question && question.defaultFrom) {
        const resolved = await this.resolveQuestionDefault(question);
        if (resolved !== undefined) {
          // Update question.default with resolved value
          (question as any).default = resolved;
        }
      }
    }
  }

  /**
   * Resolves setFrom values for all questions that have setFrom specified.
   * Sets the value directly in obj, bypassing the prompt entirely.
   */
  private async resolveSetValues(questions: Question[], obj: any): Promise<void> {
    for (const question of questions) {
      if ('setFrom' in question && question.setFrom) {
        // Only set if not already provided in args
        if (!(question.name in obj)) {
          const resolved = await this.resolverRegistry.resolve(question.setFrom);
          if (resolved !== undefined) {
            obj[question.name] = resolved;
          }
        }
      }
    }
  }

  /**
   * Expands aliases for all questions that have alias specified.
   * If an alias key exists in obj but the main name doesn't, copies the value to the main name.
   * This allows users to use short flags like -w instead of --workspace.
   */
  private expandAliases(questions: Question[], obj: any): void {
    for (const question of questions) {
      if ('alias' in question && question.alias) {
        // Skip if the main name already has a value
        if (question.name in obj) {
          continue;
        }

        // Normalize alias to array
        const aliases = Array.isArray(question.alias) ? question.alias : [question.alias];

        // Check each alias and use the first one found
        for (const alias of aliases) {
          if (alias in obj) {
            obj[question.name] = obj[alias];
            // Optionally clean up the alias key to avoid confusion
            delete obj[alias];
            break;
          }
        }
      }
    }
  }

  /**
   * Resolves optionsFrom values for all questions that have optionsFrom specified.
   * Updates the question.options property with the resolved array.
   */
  private async resolveOptionsFrom(questions: Question[]): Promise<void> {
    for (const question of questions) {
      if ('optionsFrom' in question && question.optionsFrom) {
        const resolved = await this.resolverRegistry.resolve(question.optionsFrom);
        if (resolved !== undefined && Array.isArray(resolved)) {
          // Update question.options with resolved array
          (question as any).options = resolved;
        }
      }
    }
  }

  /**
   * Extracts positional arguments from obj._ and assigns them to questions marked with _: true.
   * 
   * Rules:
   * 1. Named arguments take precedence - if a question already has a value in obj, skip it
   * 2. Positional questions consume from obj._ left-to-right in declaration order
   * 3. Returns the count of consumed positionals so caller can strip them from obj._
   * 4. Missing positional values leave questions unset (for prompting/validation)
   * 
   * This effectively allows "naming positional parameters" - users can pass values
   * without flags and they'll be assigned to the appropriate question names.
   * 
   * @returns The number of positional arguments consumed
   */
  private extractPositionalArgs(obj: any, questions: Question[]): number {
    // Get positional arguments array from obj (minimist convention)
    const positionals: any[] = Array.isArray(obj._) ? obj._ : [];
    if (positionals.length === 0) {
      return 0;
    }

    // Track which positional index we're consuming from
    let positionalIndex = 0;

    // Process questions in declaration order to maintain predictable assignment
    for (const question of questions) {
      // Only process questions marked as positional
      if (!question._) {
        continue;
      }

      // Skip if this question already has a named argument value
      // Named arguments always take precedence over positional
      if (question.name in obj && question.name !== '_') {
        continue;
      }

      // Skip if we've exhausted all positional arguments
      if (positionalIndex >= positionals.length) {
        break;
      }

      // Assign the next positional value to this question
      const value = positionals[positionalIndex];
      obj[question.name] = value;
      positionalIndex++;
    }

    return positionalIndex;
  }

  private applyDefaultValues(questions: Question[], obj: any): void {
    questions.forEach(question => {
      if ('default' in question) {
        obj[question.name] = question.default;  // Set default value if specified
      }
    });
  }

  private applyOverrides(argv: any, obj: any, questions: Question[]): void {
    questions.forEach(question => {
      if (question.name in argv) {
        this.handleOverrides(argv, obj, question);
      }
    });
  }

  private handleOverrides(argv: any, obj: any, question: Question): void {
    if (!Object.prototype.hasOwnProperty.call(argv, question.name)) {
      return;
    }

    if (this.handledKeys.has(question.name)) {
      return; // Already handled, skip further processing
    }
    this.handledKeys.add(question.name);

    switch (question.type) {
      case 'text':
      case 'number':
      case 'confirm':
        // do nothing, already set!
        break;
      case 'checkbox':
        this.handleOverridesForCheckboxOptions(argv, obj, question);
        break;
      case 'autocomplete':
      case 'list':
        // get the value from options :)
        this.handleOverridesWithOptions(argv, obj, question);
        break;
      default:
        return;
    }
  }

  private handleOverridesForCheckboxOptions(
    argv: any,
    obj: any,
    question: CheckboxQuestion
  ): void {
    const options = this.sanitizeOptions(question);
    const input = argv[question.name];
  
    // Normalize to array
    const inputs: string[] = Array.isArray(input) ? input.map(String) : [String(input)];
  
    // Set of matched values
    const inputSet = new Set(inputs);
  
    // Base list of processed options
    const result: OptionValue[] = options.map(opt => ({
      ...opt,
      selected: inputSet.has(opt.name) || inputSet.has(String(opt.value))
    }));
  
    // Add extras if allowed
    if (question.allowCustomOptions) {
      const knownValues = new Set(options.map(opt => String(opt.value)));
      const unknowns = inputs.filter(val => !knownValues.has(val));
  
      for (const val of unknowns) {
        result.push({
          name: val,
          value: val,
          selected: true
        });
      }
    }
  
    // Assign final result
    obj[question.name] = question.returnFullResults
      ? result
      : result.filter(opt => opt.selected);
  }

  private handleOverridesWithOptions(
    argv: any,
    obj: any,
    question: AutocompleteQuestion | ListQuestion
  ): void {
    const input = argv[question.name];
    if (typeof input !== 'string') return;
  
    const options = this.sanitizeOptions(question);
  
    const found = options.find(
      opt => opt.name === input || String(opt.value) === input
    );
  
    if (found) {
      obj[question.name] = found.value;
    } else if (question.allowCustomOptions) {
      obj[question.name] = input; // Store as-is
    }
  }
  

  private async handleQuestionType(question: Question, ctx: PromptContext): Promise<any> {
    this.keypress?.clearHandlers();
    switch (question.type) {
      case 'confirm':
        return this.confirm(question as ConfirmQuestion, ctx);
      case 'checkbox':
        return this.checkbox(question as CheckboxQuestion, ctx);
      case 'list':
        return this.list(question as ListQuestion, ctx);
      case 'autocomplete':
        return this.autocomplete(question as AutocompleteQuestion, ctx);
      case 'number':
        return this.number(question as NumberQuestion, ctx);
      case 'text':
        return this.text(question as TextQuestion, ctx);
      default:
        return this.text(question as TextQuestion, ctx);
    }
  }

  public async confirm(question: ConfirmQuestion, ctx: PromptContext): Promise<boolean> {
    if (this.noTty || !this.rl) return question.default ?? false;  // Return default if non-interactive

    return new Promise<boolean>((resolve) => {
      this.clearScreen();
      this.rl.question(this.getPrompt(question, ctx, ''), (answer) => {
        const userInput = answer.trim().toLowerCase();

        if (userInput === '') {
          resolve(question.default ?? false);  // Use default value if input is empty
        } else if (['yes', 'y'].includes(userInput)) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  public async text(question: TextQuestion, ctx: PromptContext): Promise<string | null> {
    if (this.noTty || !this.rl) {
      if ('default' in question) {
        return question.default;
      }
      return;
    }

    let input = '';

    return new Promise<string | null>((resolve) => {
      this.clearScreen();
      this.rl.question(this.getPrompt(question, ctx, input), (answer) => {  // Include the prompt directly in the question method
        input = answer;
        if (input.trim() !== '') {
          resolve(input);  // Return input if not empty
        } else if ('default' in question) {
          resolve(question.default);  // Use default if input is empty
        } else {
          resolve(null);  // Return null if empty and not required
        }
      });
    });
  }

  public async number(question: NumberQuestion, ctx: PromptContext): Promise<number | null> {
    if (this.noTty || !this.rl) {
      if ('default' in question) {
        return question.default;
      }
      return;
    }

    let input = '';

    return new Promise<number | null>((resolve) => {
      this.clearScreen();
      this.rl.question(this.getPrompt(question, ctx, input), (answer) => {
        input = answer.trim();
        if (input !== '') {
          const num = Number(input);
          if (!isNaN(num)) {
            resolve(num);
          } else {
            resolve(null); // Let validation handle bad input
          }
        } else if ('default' in question) {
          resolve(question.default); // Use default if input is empty
        } else {
          resolve(null); // Empty and no default
        }
      });
    });
  }

  public async checkbox(question: CheckboxQuestion, ctx: PromptContext): Promise<OptionValue[]> {
    if (this.noTty || !this.rl) {
      const options = this.sanitizeOptions(question);

      const defaults = Array.isArray(question.default)
        ? question.default
        : [question.default];

      // If returnFullResults is true, return all options with boolean selection
      if (question.returnFullResults) {
        return options.map(opt => ({
          name: opt.name,
          value: opt.value,
          selected: defaults.includes(opt.name)
        }));
      }

      // Otherwise, return only selected options
      return options
        .filter(opt => defaults.includes(opt.name) || defaults.includes(opt.value))
        .map(opt => ({
          name: opt.name,
          value: opt.value,
          selected: true
        }));

    }

    if (!question.options.length) {
      // no arguments don't make sense
      throw new Error('checkbox requires options');
    }

    this.keypress.resume();
    const options = this.sanitizeOptions(question);
    let input = ''; // Search input
    let filteredOptions = options;
    let selectedIndex = 0;
    let startIndex = 0; // Start index for visible options
    const maxLines = this.getMaxLines(question, options.length) // Use provided max or total options
    // const selections: boolean[] = new Array(options.length).fill(false);

    const selections: boolean[] = options.map(opt => {
      if (!question.default) return false;

      const defaults = Array.isArray(question.default)
        ? question.default
        : [question.default];

      return defaults.includes(opt.name);
    });

    const updateFilteredOptions = (): void => {
      filteredOptions = this.filterOptions(options, input);
    };

    const display = (): void => {
      this.clearScreen();
      this.displayPrompt(question, ctx, input);
      const endIndex = Math.min(startIndex + maxLines, filteredOptions.length);
      for (let i = startIndex; i < endIndex; i++) {
        const option = filteredOptions[i];
        const isSelected = selectedIndex === i;
        const marker = isSelected ? '>' : ' ';
        const index = options.map(o => o.name).indexOf(option.name);
        if (index >= 0) {
          const isChecked = selections[index] ? '◉' : '○'; // Use the original index in options
          const line = `${marker} ${isChecked} ${option.name}`;
          this.log(isSelected ? blue(line) : line);
        } else {
          this.log('No options'); // sometimes user searches and there are no options...
        }
      }
    };

    display();

    // Handling BACKSPACE key
    this.keypress.on(KEY_CODES.BACKSPACE, () => {
      input = input.slice(0, -1);
      updateFilteredOptions();
      display();
    });

    // Register alphanumeric keypresses to accumulate input, excluding space
    'abcdefghijklmnopqrstuvwxyz0123456789'.split('').forEach(char => {
      this.keypress.on(char, () => {
        input += char;
        updateFilteredOptions();
        display();
      });
    });

    this.keypress.on(KEY_CODES.UP_ARROW, () => {
      selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : filteredOptions.length - 1;
      if (selectedIndex < startIndex) {
        startIndex = selectedIndex; // Scroll up
      } else if (selectedIndex === filteredOptions.length - 1) {
        startIndex = Math.max(0, filteredOptions.length - maxLines); // Jump to the bottom of the list
      }
      display();
    });

    this.keypress.on(KEY_CODES.DOWN_ARROW, () => {
      selectedIndex = (selectedIndex + 1) % filteredOptions.length;
      if (selectedIndex >= startIndex + maxLines) {
        startIndex = selectedIndex - maxLines + 1; // Scroll down
      } else if (selectedIndex === 0) {
        startIndex = 0; // Jump to the top of the list
      }
      display();
    });

    this.keypress.on(KEY_CODES.SPACE, () => {
      // Map filtered index back to the original index in options
      selections[options.indexOf(filteredOptions[selectedIndex])] = !selections[options.indexOf(filteredOptions[selectedIndex])];
      display();
    });

    return new Promise<OptionValue[]>(resolve => {
      this.keypress.on(KEY_CODES.ENTER, () => {
        this.keypress.pause();
        const result: OptionValue[] = [];
        if (question.returnFullResults) {
          // Return all options with their selected status
          options.forEach((option, index) => {
            result.push({
              name: option.name,
              value: option.value,
              selected: selections[index]
            });
          });
        } else {
          // Return only options that are selected
          options.forEach((option, index) => {
            if (selections[index]) {
              result.push({
                name: option.name,
                value: option.value,
                selected: selections[index]
              });
            }
          });
        }
        resolve(result);
      });
    });
  }

  public async autocomplete(question: AutocompleteQuestion, ctx: PromptContext): Promise<any> {
    if (this.noTty || !this.rl) {
      if ('default' in question) {
        return question.default;
      }
      return;
    }

    if (!question.options.length) {
      throw new Error('autocomplete requires options');
    }

    this.keypress.resume();
    const options = this.sanitizeOptions(question);

    let input = '';
    let filteredOptions = options;
    let selectedIndex = 0;
    let startIndex = 0;  // Start index for visible options
    const maxLines = this.getMaxLines(question, options.length) // Use provided max or total options

    const display = (): void => {
      this.clearScreen();
      this.displayPrompt(question, ctx, input);
      // Determine the range of options to display
      const endIndex = Math.min(startIndex + maxLines, filteredOptions.length);
      for (let i = startIndex; i < endIndex; i++) {
        const option = filteredOptions[i];
        if (!option) {
          this.log('No options'); // sometimes user searches and there are no options...
        } else if (i === selectedIndex) {
          this.log(blue('> ' + option.name)); // Highlight the selected option with yanse
        } else {
          this.log('  ' + option.name);
        }
      }
    };

    const updateFilteredOptions = (): void => {
      filteredOptions = this.filterOptions(options, input);
      // Adjust startIndex to keep the selectedIndex in the visible range
      if (selectedIndex < startIndex) {
        startIndex = selectedIndex;
      } else if (selectedIndex >= startIndex + maxLines) {
        startIndex = selectedIndex - maxLines + 1;
      }
      if (selectedIndex >= filteredOptions.length) {
        selectedIndex = Math.max(filteredOptions.length - 1, 0);
      }
    };

    display();

    // Handling BACKSPACE key
    this.keypress.on(KEY_CODES.BACKSPACE, () => {
      input = input.slice(0, -1);
      updateFilteredOptions();
      display();
    });

    // Register alphanumeric and space keypresses to accumulate input
    'abcdefghijklmnopqrstuvwxyz0123456789 '.split('').forEach(char => {
      this.keypress.on(char, () => {
        input += char;
        updateFilteredOptions();
        display();
      });
    });

    // Navigation
    this.keypress.on(KEY_CODES.UP_ARROW, () => {
      selectedIndex = selectedIndex - 1 >= 0 ? selectedIndex - 1 : filteredOptions.length - 1;
      if (selectedIndex < startIndex) {
        startIndex = selectedIndex;  // Scroll up
      } else if (selectedIndex === filteredOptions.length - 1) {
        startIndex = Math.max(0, filteredOptions.length - maxLines); // Jump to the bottom of the list
      }
      display();
    });
    this.keypress.on(KEY_CODES.DOWN_ARROW, () => {
      selectedIndex = (selectedIndex + 1) % filteredOptions.length;
      if (selectedIndex >= startIndex + maxLines) {
        startIndex = selectedIndex - maxLines + 1;  // Scroll down
      } else if (selectedIndex === 0) {
        startIndex = 0;  // Jump to the top of the list
      }
      display();
    });

    return new Promise<OptionValue>(resolve => {
      this.keypress.on(KEY_CODES.ENTER, () => {
        this.keypress.pause();
        resolve(filteredOptions[selectedIndex]?.value || input);
      });
    });
  }

  public async list(question: ListQuestion, ctx: PromptContext): Promise<any> {
    if (this.noTty || !this.rl) {
      if ('default' in question) {
        return question.default;
      }
      return;
    }

    if (!question.options.length) {
      throw new Error('list requires options');
    }

    this.keypress.resume();
    const options = this.sanitizeOptions(question);

    let input = '';
    let selectedIndex = 0;
    let startIndex = 0;  // Start index for visible options
    const maxLines = this.getMaxLines(question, options.length) // Use provided max or total options

    const display = (): void => {
      this.clearScreen();
      this.displayPrompt(question, ctx, input);
      // Determine the range of options to display
      const endIndex = Math.min(startIndex + maxLines, options.length);
      for (let i = startIndex; i < endIndex; i++) {
        const option = options[i];
        if (!option) {
          this.log('No options'); // sometimes user searches and there are no options...
        } else if (i === selectedIndex) {
          this.log(blue('> ' + option.name)); // Highlight the selected option with yanse
        } else {
          this.log('  ' + option.name);
        }
      }
    };

    display();

    // Navigation
    this.keypress.on(KEY_CODES.UP_ARROW, () => {
      selectedIndex = selectedIndex - 1 >= 0 ? selectedIndex - 1 : options.length - 1;
      if (selectedIndex < startIndex) {
        startIndex = selectedIndex;  // Scroll up
      } else if (selectedIndex === options.length - 1) {
        startIndex = Math.max(0, options.length - maxLines); // Jump to the bottom of the list
      }
      display();
    });
    this.keypress.on(KEY_CODES.DOWN_ARROW, () => {
      selectedIndex = (selectedIndex + 1) % options.length;
      if (selectedIndex >= startIndex + maxLines) {
        startIndex = selectedIndex - maxLines + 1;  // Scroll down
      } else if (selectedIndex === 0) {
        startIndex = 0;  // Jump to the top of the list
      }
      display();
    });

    return new Promise<OptionValue>(resolve => {
      this.keypress.on(KEY_CODES.ENTER, () => {
        this.keypress.pause();
        resolve(options[selectedIndex]?.value || input);
      });
    });
  }

  private getOptionValue(option: string | OptionValue): OptionValue {
    if (typeof option === 'string') {
      return { name: option, value: option };
    } else if (typeof option === 'object' && option && 'name' in option) {
      return { name: option.name, value: option.value };
    } else {
      return undefined;
    }
  }

  private sanitizeOptions(question: AutocompleteQuestion | CheckboxQuestion | ListQuestion): OptionValue[] {
    const options = (question.options ?? []).map(option => this.getOptionValue(option));
    return options.filter(Boolean);
  }

  private filterOptions(options: OptionValue[], input: string): OptionValue[] {
    input = input.toLowerCase(); // Normalize input for case-insensitive comparison

    // Fuzzy matching: Check if all characters of the input can be found in the option name in order
    const fuzzyMatch = (option: string, input: string) => {
      if (!input || !input.trim().length) return true;
      const length = input.length;
      let position = 0; // Position in the input string

      // Iterate over each character in the option name
      for (let i = 0; i < option.length; i++) {
        if (option[i] === input[position]) {
          position++; // Move to the next character in the input
          if (position === length) { // Check if we've matched all characters
            return true;
          }
        }
      }
      return false;
    };

    return options
      .filter(option => fuzzyMatch(option.name.toLowerCase(), input))
      .sort((a, b) => {
        if (a.name < b.name) {
          return -1;
        }
        if (a.name > b.name) {
          return 1;
        }
        return 0;
      });
  }

  private getMaxLines(question: { maxDisplayLines?: number }, defaultLength: number): number {
    if (question.maxDisplayLines) {
      return question.maxDisplayLines;
    }

    // if (!this.noTty && (this.output as any).isTTY) {
    //   const rows = Math.round(((this.output as any).rows ?? 0) / 7);
    //   return Math.max(rows, defaultLength);
    // }
    return Math.min(this.globalMaxLines, defaultLength);
  }

  // Method to cleanly close the readline interface
  // NOTE: use exit() to close!
  public close() {
    if (this.rl) {
      this.rl.close();
      this.keypress.destroy();
    }
  }
}
