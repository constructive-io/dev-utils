#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import { Inquirerer, ListQuestion } from 'inquirerer';
import minimist, { ParsedArgs } from 'minimist';

import { CacheManager, GitCloner, checkNpmVersion } from 'genomic';
import { createFromTemplate } from './index';

const DEFAULT_REPO = 'https://github.com/constructive-io/pgpm-boilerplates.git';
const DEFAULT_OUTPUT_FALLBACK = 'create-gen-app-output';
const DEFAULT_TOOL_NAME = 'create-gen-app-test';
const DEFAULT_TTL = 604800000; // 1 week
const DEFAULT_TTL_DAYS = DEFAULT_TTL / (24 * 60 * 60 * 1000);

// Package info - using the scaffolds package name and version
const PACKAGE_NAME = 'genomic';
const PACKAGE_VERSION = '1.0.0';

const RESERVED_ARG_KEYS = new Set([
  '_',
  'repo',
  'r',
  'branch',
  'b',
  'path',
  'p',
  'template',
  't',
  'output',
  'o',
  'force',
  'f',
  'help',
  'h',
  'version',
  'v',
  'no-tty',
  'n',
  'clear-cache',
  'c',
  'ttl',
  'no-ttl',
]);

export interface CliResult {
  outputDir: string;
  template: string;
}

export async function runCli(
  rawArgv: string[] = process.argv.slice(2)
): Promise<CliResult | void> {
  const args = minimist(rawArgv, {
    alias: {
      r: 'repo',
      b: 'branch',
      p: 'path',
      t: 'template',
      o: 'output',
      f: 'force',
      h: 'help',
      v: 'version',
      n: 'no-tty',
      c: 'clear-cache',
      // no alias for ttl to keep it explicit
    },
    string: ['repo', 'branch', 'path', 'template', 'output', 'ttl'],
    boolean: ['force', 'help', 'version', 'no-tty', 'clear-cache', 'no-ttl'],
    default: {
      repo: DEFAULT_REPO,
    },
  });

  if (args.help) {
    printHelp();
    return;
  }

  if (args.version) {
    printVersion();
    return;
  }

  // Check for updates
  try {
    const versionCheck = await checkNpmVersion(PACKAGE_NAME, PACKAGE_VERSION);
    if (versionCheck.isOutdated && versionCheck.latestVersion) {
      console.warn(
        `\n⚠️  New version available: ${versionCheck.currentVersion} → ${versionCheck.latestVersion}`
      );
      console.warn(`   Run: npm install -g ${PACKAGE_NAME}@latest\n`);
    }
  } catch {
    // Silently ignore version check failures
  }

  const ttl = resolveTtlOption(args);

  // Initialize modules
  const cacheManager = new CacheManager({
    toolName: DEFAULT_TOOL_NAME,
    ttl,
  });

  // Handle --clear-cache
  if (args['clear-cache']) {
    console.log('Clearing cache...');
    cacheManager.clearAll();
    console.log('✨ Cache cleared successfully!');
    return;
  }

  const gitCloner = new GitCloner();

  if (!args.output && args._[0]) {
    args.output = args._[0];
  }

  // Get or clone template
  const normalizedUrl = gitCloner.normalizeUrl(args.repo);
  const cacheKey = cacheManager.createKey(normalizedUrl, args.branch);

  let templateDir: string;
  const cachedPath = cacheManager.get(cacheKey);
  const expiredMetadata = cacheManager.checkExpiration(cacheKey);

  if (expiredMetadata) {
    console.warn(
      `⚠️  Cached template expired (last updated: ${new Date(expiredMetadata.lastUpdated).toLocaleString()})`
    );
    console.log('Updating cache...');
    cacheManager.clear(cacheKey);
  }

  if (cachedPath && !expiredMetadata) {
    console.log(`Using cached template from ${cachedPath}`);
    templateDir = cachedPath;
  } else {
    console.log(`Cloning template from ${args.repo}...`);
    if (args.branch) {
      console.log(`Using branch ${args.branch}`);
    }
    const tempDest = path.join(cacheManager.getReposDir(), cacheKey);
    gitCloner.clone(normalizedUrl, tempDest, { branch: args.branch, depth: 1 });
    cacheManager.set(cacheKey, tempDest);
    templateDir = tempDest;
    console.log('Template cached for future runs');
  }

  try {
    const userProvidedPath = typeof args.path === 'string';
    const configPath = path.join(templateDir, '.boilerplates.json');
    const autoDir =
      !userProvidedPath && fs.existsSync(configPath)
        ? (() => {
            try {
              const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              return typeof parsed?.dir === 'string' ? parsed.dir : undefined;
            } catch {
              return undefined;
            }
          })()
        : undefined;
    const effectivePath =
      (userProvidedPath ? args.path : undefined) ?? autoDir ?? '.';

    const selectionRoot = path.join(templateDir, effectivePath);
    if (
      !fs.existsSync(selectionRoot) ||
      !fs.statSync(selectionRoot).isDirectory()
    ) {
      throw new Error(
        `Template path "${effectivePath}" does not exist in ${args.repo}`
      );
    }

    const templates = fs
      .readdirSync(selectionRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort();

    if (templates.length === 0) {
      throw new Error('No template folders found in repository');
    }

    let selectedTemplate: string | undefined = args.template;

    if (selectedTemplate) {
      if (!templates.includes(selectedTemplate)) {
        throw new Error(
          `Template "${selectedTemplate}" not found in ${args.repo}${
            effectivePath === '.' ? '' : `/${effectivePath}`
          }`
        );
      }
    } else if (templates.length === 1) {
      selectedTemplate = templates[0];
      console.log(`Using the only available template: ${selectedTemplate}`);
    } else {
      selectedTemplate = await promptForTemplate(templates);
    }

    if (!selectedTemplate) {
      throw new Error('Template selection failed');
    }

    const normalizedBasePath =
      effectivePath === '.' || effectivePath === './'
        ? ''
        : effectivePath.replace(/^[./]+/, '').replace(/\/+$/, '');
    const fromPath = normalizedBasePath
      ? path.join(normalizedBasePath, selectedTemplate)
      : selectedTemplate;

    const outputDir = resolveOutputDir(args.output, selectedTemplate);
    ensureOutputDir(outputDir, Boolean(args.force));

    const answerOverrides = extractAnswerOverrides(args);
    const noTty = Boolean(
      args['no-tty'] ??
      (args as Record<string, unknown>).noTty ??
      (args as Record<string, unknown>).tty === false
    );

    // Use the createFromTemplate function which will use the same cache
    await createFromTemplate({
      templateUrl: args.repo,
      branch: args.branch,
      fromPath,
      outputDir,
      answers: answerOverrides,
      noTty,
      toolName: DEFAULT_TOOL_NAME,
      ttl,
    });

    console.log(`\n✨ Done! Project ready at ${outputDir}`);
    return { outputDir, template: selectedTemplate };
  } catch (error) {
    throw error;
  }
}

function printHelp(): void {
  console.log(`
create-gen-app CLI (test harness)

Usage:
  node cli [options] [outputDir]

Options:
  -r, --repo <url>         Git repository to clone (default: ${DEFAULT_REPO})
  -b, --branch <name>      Branch to use when cloning
  -p, --path <dir>         Subdirectory that contains templates (default: auto from .boilerplates.json, else .)
  -t, --template <name>    Template folder to use (will prompt if omitted)
  -o, --output <dir>       Output directory (defaults to ./<template>)
  -f, --force              Overwrite the output directory if it exists
  -c, --clear-cache        Clear the template cache and exit
      --ttl <ms>           Set cache TTL in milliseconds (flag alone uses 1 week)
      --no-ttl             Disable TTL (cache never expires)
  -v, --version            Show CLI version
  -n, --no-tty             Disable TTY mode for prompts
  -h, --help               Show this help message

You can also pass variable overrides, e.g.:
  node cli --template module --PROJECT_NAME my-app

Cache is stored at: ~/.${DEFAULT_TOOL_NAME}/cache/repos
TTL: none by default; use --ttl to enable (default ${DEFAULT_TTL_DAYS} days when flag provided)
`);
}

function printVersion(): void {
  console.log(`create-gen-app v${PACKAGE_VERSION}`);
}

async function promptForTemplate(templates: string[]): Promise<string> {
  const prompter = new Inquirerer();
  const question: ListQuestion = {
    type: 'list',
    name: 'template',
    message: 'Which template would you like to use?',
    options: templates,
    required: true,
  };

  try {
    const answers = (await prompter.prompt({}, [question])) as {
      template: string;
    };
    return answers.template;
  } finally {
    prompter.close();
  }
}

function resolveOutputDir(
  outputArg: string | undefined,
  template?: string
): string {
  const base =
    outputArg ??
    (template ? path.join(process.cwd(), template) : DEFAULT_OUTPUT_FALLBACK);
  return path.resolve(base);
}

function ensureOutputDir(outputDir: string, force: boolean): void {
  if (!fs.existsSync(outputDir)) {
    return;
  }

  if (!force) {
    throw new Error(
      `Output directory "${outputDir}" already exists. Use --force to overwrite or choose another path.`
    );
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
}

function extractAnswerOverrides(args: ParsedArgs): Record<string, any> {
  const overrides: Record<string, any> = {};
  for (const [key, value] of Object.entries(args)) {
    if (RESERVED_ARG_KEYS.has(key)) {
      continue;
    }
    overrides[key] = value;
  }
  return overrides;
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

function resolveTtlOption(args: ParsedArgs): number | undefined {
  const disableTtl = Boolean(
    args['no-ttl'] ?? (args as Record<string, unknown>).noTtl
  );
  if (disableTtl) {
    return undefined;
  }

  if (args.ttl === undefined) {
    return undefined;
  }

  // Support --ttl with no value to use the default 1-week TTL
  if (args.ttl === true) {
    return DEFAULT_TTL;
  }

  const ttlMs = Number(args.ttl);
  if (Number.isNaN(ttlMs) || ttlMs < 0) {
    throw new Error('TTL must be a non-negative number of milliseconds');
  }

  return ttlMs === 0 ? undefined : ttlMs;
}
