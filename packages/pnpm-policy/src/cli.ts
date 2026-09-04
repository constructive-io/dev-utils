#!/usr/bin/env node
import { existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

import { findConfig, loadConfig } from './config';
import { formatDuration } from './duration';
import { PolicyError } from './errors';
import { check, generate } from './generate';
import { reachableFrom,readWorkspaceGraph } from './graph';
import { buildInventory, writeInventory } from './inventory';
import { readWorkspacePackages } from './lockfile';
import { groupByOwner, namesFromOwners, packageOrigins } from './origins';
import type { BuildsKey } from './policy';

const USAGE = `pnpm-policy — pnpm supply-chain policy for npm maintainers

Usage:
  pnpm-policy <command> [options]

Commands:
  init                Write a starter pnpm-policy.yaml
  inventory           Query npm for what your maintainers publish, and write the export
  generate            Patch the policy into pnpm-workspace.yaml
  check               Fail if the workspace file drifted or a waiver expired
  origins             Group this workspace's dependencies by the repository they publish from

Options:
  --cwd <dir>         Workspace root (default: current directory)
  --config <path>     Config file, or a directory holding one
  --out <path>        inventory: where to write the export (default: the config's inventory path)
  --builds-key <key>  allowBuilds (default) or onlyBuiltDependencies, for pnpm < 10.16
  --no-intersect      Emit every first-party name, not just the ones this workspace resolves
  --verify-scopes     inventory: also glob a scope the registry shows nobody else publishing
                      into (best-effort — npm's search index is incomplete)
  --owner <name>      origins: keep only packages published from this repo owner (repeatable)
  --from <pkg>        origins: limit to the subtree under this dependency (repeatable)
  --registry <url>    inventory: registry to query (default: https://registry.npmjs.org)
  --throttle <ms>     inventory: pause between registry requests (default: 1000)
  --json              Print machine-readable output
  -q, --quiet         Only print errors
  -h, --help          Show this help
  -v, --version       Show the version

Examples:
  pnpm-policy inventory --out pnpm-policy.inventory.json
  pnpm-policy generate
  pnpm-policy check --json`;

const STARTER = `# pnpm-policy — https://github.com/constructive-io/dev-utils
# Run \`pnpm-policy generate\` to patch these settings into pnpm-workspace.yaml.

# How long a third-party release must exist before it may be installed.
minimumReleaseAge: 2d

# Transitive dependencies must come from the registry, not from git or a URL.
blockExoticSubdeps: true

# The npm accounts YOU publish under. Everything they publish skips the wait —
# so list accounts you control, not colleagues' and not vendors'.
maintainers: []

# Scopes you own outright. These become \`@scope/*\` globs, so they also cover
# packages you publish there tomorrow — only list scopes nobody else can publish to.
scopes: []

# Built by \`pnpm-policy inventory\`; commit it and review its diffs.
inventory: ./pnpm-policy.inventory.json

# Dependencies allowed to run install scripts. The value is the reason.
allowBuilds:
  esbuild: native binary, downloaded at install time

# Dependencies whose install scripts you have looked at and do not need. Without
# a decision here pnpm warns (or, on pnpm 11, refuses to install) until someone
# runs \`pnpm approve-builds\` by hand.
denyBuilds: {}
#  nx: prebuilt binary ships as an optional dep

# Third-party escape hatches. A reason is required; \`until\` makes the waiver
# expire so \`pnpm-policy check\` reminds you to re-justify or remove it.
exceptions: []
#  - package: some-lib
#    versions: ['4.17.21']
#    reason: urgent security fix, published hours ago
#    until: 2026-10-01
`;

interface Parsed {
  command?: string;
  cwd?: string;
  config?: string;
  out?: string;
  buildsKey?: BuildsKey;
  intersect?: boolean;
  verifyScopes: boolean;
  registry?: string;
  throttle?: number;
  owners: string[];
  from: string[];
  json: boolean;
  quiet: boolean;
  help: boolean;
  version: boolean;
}

export function parseArgs(argv: string[]): Parsed {
  const parsed: Parsed = {
    owners: [],
    from: [],
    verifyScopes: false,
    json: false,
    quiet: false,
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
      if (value === undefined) throw new PolicyError(`${flag} requires a value`);
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
    case '--cwd':
      parsed.cwd = next();
      break;
    case '--config':
      parsed.config = next();
      break;
    case '--out':
      parsed.out = next();
      break;
    case '--builds-key': {
      const value = next();
      if (value !== 'allowBuilds' && value !== 'onlyBuiltDependencies') {
        throw new PolicyError(
          `--builds-key must be allowBuilds or onlyBuiltDependencies, got "${value}"`
        );
      }
      parsed.buildsKey = value;
      break;
    }
    case '--intersect':
      parsed.intersect = true;
      break;
    case '--no-intersect':
      parsed.intersect = false;
      break;
    case '--verify-scopes':
      parsed.verifyScopes = true;
      break;
    case '--owner':
      parsed.owners.push(next());
      break;
    case '--from':
      parsed.from.push(next());
      break;
    case '--registry':
      parsed.registry = next();
      break;
    case '--throttle':
      parsed.throttle = Number(next());
      break;
    case '--json':
      parsed.json = true;
      break;
    case '-q':
    case '--quiet':
      parsed.quiet = true;
      break;
    default:
      if (arg.startsWith('-')) throw new PolicyError(`Unknown option: ${arg}`);
      if (parsed.command) throw new PolicyError(`Unexpected argument: ${arg}`);
      parsed.command = arg;
    }
  }

  return parsed;
}

function packageVersion(): string {
  // The CLI sits in dist/ in the repo but at the package root once published.
  for (const candidate of ['../package.json', './package.json']) {
    try {
      return (require(candidate) as { version: string }).version;
    } catch {
      // Wrong layout; try the next candidate.
    }
  }
  return 'unknown';
}

function runInit(parsed: Parsed): number {
  const dir = resolve(parsed.cwd ?? process.cwd());
  const existing = findConfig(dir);
  if (existing) {
    console.error(`${existing} already exists`);
    return 1;
  }
  const file = join(dir, 'pnpm-policy.yaml');
  writeFileSync(file, STARTER);
  if (!parsed.quiet) {
    console.log(`Wrote ${file}`);
    console.log('Add your npm account(s) under `maintainers`, then run: pnpm-policy inventory');
  }
  return 0;
}

/**
 * Group a workspace's dependencies by the repository they publish from.
 *
 * The question this answers is "which projects am I actually depending on",
 * which is the one worth asking before deciding what to exempt from a release-age
 * quarantine. Grouping by repository rather than by npm account matters: an
 * account is as wide as everything its owner will ever publish, and the owner of
 * a library you want may also co-maintain something far larger.
 *
 * With --from, only the subtree under those dependencies is considered, so you
 * can ask what one decision dragged in rather than surveying the whole lockfile.
 * With --owner, the output narrows to those owners and can be written straight
 * out as an inventory.
 */
async function runOrigins(parsed: Parsed): Promise<number> {
  const workspaceDir = parsed.cwd ?? process.cwd();

  let names: Set<string>;
  if (parsed.from.length) {
    const graph = readWorkspaceGraph(workspaceDir);
    const missing = parsed.from.filter((name) => !graph.edges.has(name) && !graph.roots.has(name));
    if (missing.length) {
      console.error(`Not in this lockfile: ${missing.join(', ')}`);
      return 1;
    }
    names = reachableFrom(graph, parsed.from);
  } else {
    names = readWorkspacePackages(workspaceDir);
  }

  if (!parsed.quiet) {
    const scope = parsed.from.length ? `under ${parsed.from.join(', ')}` : 'in this workspace';
    console.error(`Resolving repositories for ${names.size} package(s) ${scope}...`);
  }

  const origins = await packageOrigins(names, {
    registry: parsed.registry,
    throttleMs: parsed.throttle,
    onPackage: parsed.quiet
      ? undefined
      : (name, index, total) => {
        if (index % 25 === 0) console.error(`  ${index}/${total}`);
      }
  });

  if (parsed.owners.length) {
    const matched = namesFromOwners(origins, parsed.owners);

    if (parsed.out) {
      // Deliberately no maintainers and no scopes: a list derived this way is a
      // reviewed set of names, and a scope glob would re-widen it to whatever
      // gets published into that scope next.
      writeInventory(resolve(parsed.out), {
        generatedAt: new Date().toISOString(),
        maintainers: [],
        scopes: [],
        packages: matched
      });
      if (!parsed.quiet) {
        console.error(`Wrote ${matched.length} package(s) to ${parsed.out}`);
      }
      return 0;
    }

    console.log(parsed.json ? JSON.stringify(matched, null, 2) : matched.join('\n'));
    return 0;
  }

  const grouped = [...groupByOwner(origins)].sort((a, b) => b[1].length - a[1].length);

  if (parsed.json) {
    console.log(JSON.stringify(Object.fromEntries(grouped), null, 2));
    return 0;
  }

  for (const [owner, packages] of grouped) {
    console.log(`${owner || '<no repository metadata>'}  (${packages.length})`);
    for (const name of packages) console.log(`  ${name}`);
  }
  return 0;
}

async function runInventory(parsed: Parsed): Promise<number> {
  const { file: configFile, config } = loadConfig(
    parsed.config ?? parsed.cwd ?? process.cwd()
  );

  if (config.maintainers.length === 0) {
    console.error(
      `No maintainers configured in ${configFile}. Add the npm account(s) you publish under.`
    );
    return 1;
  }

  // With several inventories configured there is no single file this command
  // owns — the others are published elsewhere — so writing requires --out rather
  // than guessing which one to overwrite.
  if (!parsed.out && config.inventory.length > 1) {
    console.error(
      `${configFile} configures ${config.inventory.length} inventories, so there is no ` +
        'single default to write. Pass --out <path> to choose one.'
    );
    return 1;
  }

  const out = resolve(
    parsed.out ??
      (config.inventory[0]
        ? join(resolve(configFile, '..'), config.inventory[0])
        : join(resolve(configFile, '..'), 'pnpm-policy.inventory.json'))
  );

  const inventory = await buildInventory(config.maintainers, {
    registry: parsed.registry,
    throttleMs: parsed.throttle,
    verifyScopes: parsed.verifyScopes,
    trustedScopes: config.scopes,
    onProgress: parsed.quiet ? undefined : (message) => console.error(message)
  });

  const existed = existsSync(out);
  writeInventory(out, inventory);

  if (parsed.json) {
    console.log(JSON.stringify(inventory, null, 2));
  } else if (!parsed.quiet) {
    console.log(
      `${existed ? 'Updated' : 'Wrote'} ${out}: ${inventory.scopes.length} scope glob(s), ${inventory.packages.length} package(s)`
    );
    if (inventory.sharedScopes?.length) {
      console.log(
        `Shared scopes (listed member-by-member, not globbed): ${inventory.sharedScopes.join(', ')}`
      );
    }
  }
  return 0;
}

function runGenerate(parsed: Parsed): number {
  const result = generate({
    cwd: parsed.cwd,
    config: parsed.config,
    buildsKey: parsed.buildsKey,
    intersect: parsed.intersect
  });

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  if (!parsed.quiet) {
    const { report } = result;
    console.log(
      `${result.changed ? 'Updated' : 'Unchanged'} ${result.file}: ` +
        `${formatDuration(report.minimumReleaseAgeMinutes)} wait, ` +
        `${report.scopes.length} scope glob(s), ` +
        `${report.firstPartyPackages.length} first-party package(s), ` +
        `${report.exceptions.length} exception(s)`
    );
    if (report.omittedPackages.length) {
      console.log(
        `${report.omittedPackages.length} first-party package(s) omitted — this workspace does not resolve them`
      );
    }
  }
  return 0;
}

function runCheck(parsed: Parsed): number {
  const result = check({
    cwd: parsed.cwd,
    config: parsed.config,
    buildsKey: parsed.buildsKey,
    intersect: parsed.intersect
  });

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  if (result.drifted) {
    console.error(
      `${result.file} does not match the policy. Regenerate it with: pnpm-policy generate`
    );
  }
  for (const exception of result.expired) {
    console.error(
      `Expired exception: ${exception.package} (until ${exception.until}) — ${exception.reason}`
    );
  }
  if (result.ok && !parsed.quiet) {
    console.log(`${result.file} matches the policy`);
  }
  return result.ok ? 0 : 1;
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  let parsed: Parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(`\n${USAGE}`);
    return 2;
  }

  if (parsed.version) {
    console.log(packageVersion());
    return 0;
  }
  if (parsed.help) {
    console.log(USAGE);
    return 0;
  }
  if (!parsed.command) {
    console.error(USAGE);
    return 2;
  }

  try {
    switch (parsed.command) {
    case 'init':
      return runInit(parsed);
    case 'inventory':
      return await runInventory(parsed);
    case 'generate':
      return runGenerate(parsed);
    case 'check':
      return runCheck(parsed);
    case 'origins':
      return await runOrigins(parsed);
    default:
      console.error(`Unknown command: ${parsed.command}`);
      console.error(`\n${USAGE}`);
      return 2;
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

if (require.main === module) {
  run().then((code) => process.exit(code));
}
