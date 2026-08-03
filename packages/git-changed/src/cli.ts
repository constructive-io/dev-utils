#!/usr/bin/env node
import { changedFiles } from './changed';
import { GitChangedError } from './git';
import type { ChangedOptions } from './types';

const USAGE = `git-changed — list files changed against the merge base

Usage:
  git-changed [options]

Options:
  --base <ref>        Diff against <ref> (default: $GITHUB_BASE_REF, else the
                      repository default branch)
  --no-base           Working-tree changes only
  --ext <exts>        Keep only these extensions (repeatable, comma-separated)
  --include <globs>   Keep only paths matching these globs (repeatable)
  --exclude <globs>   Drop paths matching these globs (repeatable)
  --within <dirs>     Restrict to these directories (repeatable)
  --no-worktree       Committed changes only
  --no-untracked      Skip untracked files
  --deleted           Include paths that no longer exist
  --status            Prefix each path with its status
  --absolute          Print absolute paths (default: relative to cwd)
  --json              Print the full result as JSON
  -0, --null          NUL-separate output, for \`xargs -0\`
  --cwd <dir>         Run as if in <dir>
  -h, --help          Show this help
  -v, --version       Show the version

Exit code is 0 whether or not anything changed; an empty list is an answer, not
an error. Use --json (or test for empty output) to branch on it.

Examples:
  git-changed --ext .sql --exclude 'dist/' '**/generated/**'
  git-changed --ext .ts --null | xargs -0 -r prettier --check
  git-changed --base origin/develop --status`;

function packageVersion(): string {
  // The CLI sits in dist/ in the repo but at the package root once published,
  // so the manifest is one directory up in one layout and alongside in the other.
  for (const candidate of ['../package.json', './package.json']) {
    try {
      return (require(candidate) as { version: string }).version;
    } catch {
      // Wrong layout; try the next candidate.
    }
  }
  return 'unknown';
}

interface Parsed {
  options: ChangedOptions;
  status: boolean;
  absolute: boolean;
  json: boolean;
  nul: boolean;
  help: boolean;
  version: boolean;
}

/** Split repeatable, comma-separated list values: `--ext .ts,.tsx --ext .mts`. */
function pushList(target: string[], value: string): void {
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (trimmed) target.push(trimmed);
  }
}

export function parseArgs(argv: string[]): Parsed {
  const ext: string[] = [];
  const include: string[] = [];
  const exclude: string[] = [];
  const within: string[] = [];
  const options: ChangedOptions = {};
  const parsed: Parsed = {
    options,
    status: false,
    absolute: false,
    json: false,
    nul: false,
    help: false,
    version: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    // Accept both `--ext .sql` and `--ext=.sql`.
    const eq = arg.indexOf('=');
    const flag = arg.startsWith('--') && eq !== -1 ? arg.slice(0, eq) : arg;
    const inline = arg.startsWith('--') && eq !== -1 ? arg.slice(eq + 1) : undefined;
    const next = (): string => {
      const value = inline ?? argv[++i];
      if (value === undefined) {
        throw new GitChangedError(`${flag} requires a value`);
      }
      return value;
    };

    switch (flag) {
    case '-h':
    case '--help':
      parsed.help = true;
      break;
    case '-v':
    case '--version':
      parsed.version = true;
      break;
    case '--base':
      options.base = next();
      break;
    case '--no-base':
      options.base = false;
      break;
    case '--ext':
      pushList(ext, next());
      break;
    case '--include':
      pushList(include, next());
      break;
    case '--exclude':
      pushList(exclude, next());
      break;
    case '--within':
      pushList(within, next());
      break;
    case '--cwd':
      options.cwd = next();
      break;
    case '--no-worktree':
      options.worktree = false;
      break;
    case '--no-untracked':
      options.untracked = false;
      break;
    case '--deleted':
      options.existingOnly = false;
      break;
    case '--status':
      parsed.status = true;
      break;
    case '--absolute':
      parsed.absolute = true;
      break;
    case '--json':
      parsed.json = true;
      break;
    case '-0':
    case '--null':
      parsed.nul = true;
      break;
    default:
      throw new GitChangedError(`Unknown option: ${arg}`);
    }
  }

  if (ext.length) options.ext = ext;
  if (include.length) options.include = include;
  if (exclude.length) options.exclude = exclude;
  if (within.length) options.within = within;
  return parsed;
}

export function run(argv: string[] = process.argv.slice(2)): number {
  let parsed: Parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(`\n${USAGE}`);
    return 2;
  }

  if (parsed.help) {
    console.log(USAGE);
    return 0;
  }
  if (parsed.version) {
    console.log(packageVersion());
    return 0;
  }

  let result;
  try {
    result = changedFiles(parsed.options);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  const lines = result.files.map((f) => {
    const path = parsed.absolute ? f.path : f.relative;
    return parsed.status ? `${f.status}\t${path}` : path;
  });

  if (parsed.nul) {
    // No trailing newline: xargs -0 splits on NUL, and a stray newline would
    // become part of the last filename.
    process.stdout.write(lines.map((l) => `${l}\0`).join(''));
  } else if (lines.length) {
    process.stdout.write(`${lines.join('\n')}\n`);
  }
  return 0;
}

if (require.main === module) {
  process.exit(run());
}
