import { ParsedArgs } from 'minimist';

/**
 * Extracts the first positional argument from argv and returns it along with the remaining argv.
 * This is useful for command routing in CLI applications where the first argument is a subcommand.
 */
export const extractFirst = (argv: Partial<ParsedArgs>) => {
  const first = argv._?.[0];
  const newArgv = {
    ...argv,
    _: argv._?.slice(1) ?? []
  };
  return { first, newArgv };
};

export type { ParsedArgs } from 'minimist';
