#!/usr/bin/env node
import type { CLIOptions } from 'inquirerer';
import { CLI } from 'inquirerer';

import { commands } from './commands';

export const options: Partial<CLIOptions> = {
  minimistOpts: {
    alias: {
      v: 'version',
      h: 'help',
    },
  },
};

const app = new CLI(commands, options);

app
  .run()
  .then(() => {
    // all done!
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
