import { readFileSync } from 'fs';
import type { CLIOptions, Inquirerer } from 'inquirerer';
import yaml from 'js-yaml';
import type { ParsedArgs } from 'minimist';
import type { YamlizeContext } from 'yamlize';
import { yamlize } from 'yamlize';

import { help } from './usage';

export const commands = async (argv: Partial<ParsedArgs>, prompter: Inquirerer, _options: CLIOptions) => {
  if (argv.version || argv.v) {
    const pkg = JSON.parse(readFileSync(require.resolve('../package.json'), 'utf-8'));
    console.log(pkg.version);
    process.exit(0);
  }

  if (argv.help || argv.h) {
    help();
    process.exit(0);
  }

  argv = await prompter.prompt(argv, [
    {
      type: 'text',
      name: 'config',
      message: 'path to the config',
      required: false,
    },
    {
      type: 'text',
      name: 'inFile',
      message: 'Provide the path the meta yaml file',
      required: true,
    },
    {
      type: 'text',
      name: 'outFile',
      message: 'Provide the path the output yaml file',
      required: true,
    },
  ]);

  let context: YamlizeContext = {};

  if (argv.config) {
    const ctxContent = readFileSync(argv.config, 'utf-8');
    context = yaml.load(ctxContent) as YamlizeContext;
  }

  yamlize(argv.inFile, argv.outFile, context);

  return argv;
};
