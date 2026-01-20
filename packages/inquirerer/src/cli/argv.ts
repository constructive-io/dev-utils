import minimist, { Opts, ParsedArgs } from 'minimist';

/**
 * Parse command-line arguments using minimist.
 * Wrapper around minimist so you don't need to import it directly.
 *
 * @example
 * ```typescript
 * const argv = parseArgv(process.argv);
 * console.log(argv.config); // --config value
 * ```
 */
export const parseArgv = (args: string[] = process.argv, opts?: Opts): ParsedArgs => {
  return minimist(args.slice(2), opts);
};

/**
 * Extracts the first positional argument from argv and returns it along with the remaining argv.
 * Useful for command routing where the first argument is a subcommand.
 *
 * @example
 * ```typescript
 * const { first: command, newArgv } = extractFirst(argv);
 * if (command === 'init') {
 *   await handleInit(newArgv);
 * }
 * ```
 */
export const extractFirst = (argv: Partial<ParsedArgs>) => {
  const first = argv._?.[0];
  const newArgv = {
    ...argv,
    _: argv._?.slice(1) ?? []
  };
  return { first, newArgv };
};

export type { ParsedArgs, Opts as ParseArgvOptions } from 'minimist';
