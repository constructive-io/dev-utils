#!/usr/bin/env node
import { WorkspaceGraph } from './graph';
import { wsChanged } from './run';
import type { WsChangedConfig } from './types';
import { loadWorkspace } from './workspace';

const USAGE = `ws-changed — which workspace packages a changeset affects

Usage:
  ws-changed [options]

Options:
  --base <ref>        Diff against <ref> (default: $GITHUB_BASE_REF, else the
                      repository default branch)
  --no-base           Working-tree changes only
  --provider <names>  Provider(s) to use: pnpm, pgpm, glob (comma-separated,
                      repeatable). Default: pnpm
  --root <dir>        Workspace root (default: git repo root, else cwd)
  --config <file>     Load an exact config file, skipping discovery
  --global <globs>    Paths whose change means "everything affected" (repeatable)
  --include <globs>   Only consider packages whose dir matches these globs
  --exclude <globs>   Drop packages whose dir matches these globs
  --changed           Print only directly-changed packages (not dependents)
  --dirs              Print package directories instead of names
  --why               Explain why each affected package was selected
  --list              List all workspace packages (ignore changes)
  --graph             Print the dependency graph (topological order)
  --json              Print the full result as JSON
  --cwd <dir>         Run as if in <dir>
  -h, --help          Show this help
  -v, --version       Show the version

Exit code is 0 whether or not anything is affected. With --json, read
\`.global\`: when true, a global-trigger path changed and you should treat every
package as affected.

Examples:
  ws-changed --base origin/main
  ws-changed --provider pnpm,pgpm --base origin/main --json
  ws-changed --provider pgpm --dirs --global 'pnpm-lock.yaml' '.github/**'
  ws-changed --why --base origin/develop`;

function packageVersion(): string {
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
  overrides: Partial<WsChangedConfig>;
  base?: string | false;
  configFile?: string;
  cwd?: string;
  onlyChanged: boolean;
  dirs: boolean;
  why: boolean;
  list: boolean;
  graph: boolean;
  json: boolean;
  help: boolean;
  version: boolean;
}

function pushList(target: string[], value: string): void {
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (trimmed) target.push(trimmed);
  }
}

export function parseArgs(argv: string[]): Parsed {
  const provider: string[] = [];
  const global: string[] = [];
  const include: string[] = [];
  const exclude: string[] = [];
  const overrides: Partial<WsChangedConfig> = {};
  const parsed: Parsed = {
    overrides,
    onlyChanged: false,
    dirs: false,
    why: false,
    list: false,
    graph: false,
    json: false,
    help: false,
    version: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const flag = arg.startsWith('--') && eq !== -1 ? arg.slice(0, eq) : arg;
    const inline = arg.startsWith('--') && eq !== -1 ? arg.slice(eq + 1) : undefined;
    const next = (): string => {
      const value = inline ?? argv[++i];
      if (value === undefined) throw new Error(`${flag} requires a value`);
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
      parsed.base = next();
      break;
    case '--no-base':
      parsed.base = false;
      break;
    case '--provider':
      pushList(provider, next());
      break;
    case '--root':
      overrides.root = next();
      break;
    case '--config':
      parsed.configFile = next();
      break;
    case '--global':
      pushList(global, next());
      break;
    case '--include':
      pushList(include, next());
      break;
    case '--exclude':
      pushList(exclude, next());
      break;
    case '--cwd':
      parsed.cwd = next();
      break;
    case '--changed':
      parsed.onlyChanged = true;
      break;
    case '--dirs':
      parsed.dirs = true;
      break;
    case '--why':
      parsed.why = true;
      break;
    case '--list':
      parsed.list = true;
      break;
    case '--graph':
      parsed.graph = true;
      break;
    case '--json':
      parsed.json = true;
      break;
    default:
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (provider.length) overrides.provider = provider;
  if (global.length) overrides.global = global;
  if (include.length) overrides.include = include;
  if (exclude.length) overrides.exclude = exclude;
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

  try {
    if (parsed.list || parsed.graph) {
      const { workspace } = loadWorkspace({
        cwd: parsed.cwd,
        configFile: parsed.configFile,
        overrides: parsed.overrides
      });
      if (parsed.graph) {
        const graph = new WorkspaceGraph(workspace);
        const order = graph.topoSort();
        if (parsed.json) {
          console.log(
            JSON.stringify(
              order.map((name) => ({ name, requires: graph.dependencies(name) })),
              null,
              2
            )
          );
        } else {
          for (const name of order) {
            const deps = graph.dependencies(name);
            console.log(deps.length ? `${name} <- ${deps.join(', ')}` : name);
          }
        }
        return 0;
      }
      printNames(
        workspace.packages.map((p) => (parsed.dirs ? p.relDir : p.name)),
        parsed.json ? workspace : undefined
      );
      return 0;
    }

    const runResult = wsChanged({
      cwd: parsed.cwd,
      configFile: parsed.configFile,
      overrides: parsed.overrides,
      base: parsed.base
    });
    const { result, workspace } = runResult;

    if (parsed.json) {
      console.log(JSON.stringify(runResult, null, 2));
      return 0;
    }

    if (parsed.why) {
      for (const reason of result.why) {
        const suffix =
          reason.kind === 'changed'
            ? `changed (${reason.via})`
            : `depends on ${reason.via}`;
        console.log(`${reason.package}\t${suffix}`);
      }
      if (result.global) {
        console.error(`\n[global] matched: ${result.globalMatches.join(', ')} — treat all as affected`);
      }
      return 0;
    }

    const names = parsed.onlyChanged ? result.changed : result.packages;
    const dirByName = new Map(workspace.packages.map((p) => [p.name, p.relDir]));
    const lines = parsed.dirs ? names.map((n) => dirByName.get(n) ?? n) : names;
    printNames(lines);
    if (result.global) {
      console.error(`[global] matched: ${result.globalMatches.join(', ')} — treat all as affected`);
    }
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

function printNames(lines: string[], json?: unknown): void {
  if (json !== undefined) {
    console.log(JSON.stringify(json, null, 2));
    return;
  }
  if (lines.length) process.stdout.write(`${lines.join('\n')}\n`);
}

if (require.main === module) {
  process.exit(run());
}
