#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { type Config, generate, planGeneration } from './index';

const usage = 'Usage: llms-markdown generate [--dir out] [--site-url https://example.com] [--exclude /preview] [--config ./llms.config.mjs] [--dry-run]';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: 'string' },
      'site-url': { type: 'string' },
      exclude: { type: 'string', multiple: true },
      config: { type: 'string' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  if (positionals.length !== 1 || positionals[0] !== 'generate') throw new Error(usage);
  const requireConfig = createRequire(resolve('package.json'));
  const imported = values.config ? requireConfig(resolve(values.config)) as { default?: Config } & Partial<Config> : {};
  const options = imported.default ?? imported;
  const siteUrl = values['site-url'] ?? options.siteUrl;
  if (!siteUrl) throw new Error(`Missing site URL. ${usage}`);
  const config: Config = {
    ...options, siteUrl, outDir: values.dir ?? options.outDir ?? 'out',
    exclude: [...(options.exclude ?? []), ...(values.exclude ?? [])],
  };
  if (values['dry-run']) {
    const { artifacts } = await planGeneration(config);
    for (const artifact of artifacts) console.log(artifact.file);
  } else {
    const { twins } = await generate(config);
    console.log(`Generated ${twins.length} Markdown twins and llms.txt in ${config.outDir}`);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
