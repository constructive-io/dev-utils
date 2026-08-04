/**
 * The pnpm/npm/yarn provider: JavaScript workspace packages and the edges
 * between them, read from each `package.json`'s dependency maps.
 *
 * An edge exists whenever a dependency's *name* is another workspace package —
 * whatever the version spec. The `workspace:` protocol (`workspace:*`,
 * `workspace:^`, `workspace:~`, `workspace:^1.2.3`) is always an internal edge
 * by definition; a bare semver range (`^1.2.3`) is one too when a workspace
 * package publishes under that name, which is how dist-publishing monorepos
 * (this one included) reference each other. Both are recognized.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { expandDirGlob, toRel } from '../glob';
import type { EdgeKind, ProviderContext, WorkspacePackage, WorkspaceProvider } from '../types';
import { workspaceGlobs } from '../workspace-file';

const DEP_FIELDS: Record<EdgeKind, string> = {
  prod: 'dependencies',
  dev: 'devDependencies',
  peer: 'peerDependencies',
  optional: 'optionalDependencies'
};

const ALL_KINDS: EdgeKind[] = ['prod', 'dev', 'peer', 'optional'];

interface RawPackage {
  name: string;
  dir: string;
  relDir: string;
  deps: Array<{ name: string; spec: string; kind: EdgeKind }>;
}

function readPackages(root: string): RawPackage[] {
  const globs = workspaceGlobs(root);
  const dirs = new Set<string>();
  for (const glob of globs) for (const d of expandDirGlob(root, glob)) dirs.add(d);

  const packages: RawPackage[] = [];
  for (const relDir of dirs) {
    const manifest = join(root, relDir, 'package.json');
    if (!existsSync(manifest)) continue;
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(readFileSync(manifest, 'utf-8')) as Record<string, unknown>;
    } catch {
      continue;
    }
    const name = typeof pkg.name === 'string' ? pkg.name : relDir;
    const deps: RawPackage['deps'] = [];
    for (const kind of ALL_KINDS) {
      const field = pkg[DEP_FIELDS[kind]];
      if (!field || typeof field !== 'object') continue;
      for (const [depName, spec] of Object.entries(field as Record<string, string>)) {
        deps.push({ name: depName, spec: String(spec), kind });
      }
    }
    packages.push({ name, dir: join(root, relDir), relDir, deps });
  }
  return packages;
}

export const pnpmProvider: WorkspaceProvider = {
  name: 'pnpm',
  discover(ctx: ProviderContext): WorkspacePackage[] {
    const { root } = ctx;
    const kinds = new Set<EdgeKind>(ctx.config.providers?.pnpm?.edgeKinds ?? ALL_KINDS);
    const raw = readPackages(root);
    const names = new Set(raw.map((p) => p.name));

    return raw.map((p) => {
      const requires: string[] = [];
      const external: string[] = [];
      const specs: Record<string, string> = {};
      const kindOf: Record<string, EdgeKind> = {};
      for (const dep of p.deps) {
        if (!kinds.has(dep.kind)) continue;
        const internal = names.has(dep.name);
        if (internal) {
          if (!requires.includes(dep.name)) requires.push(dep.name);
        } else if (dep.spec.startsWith('workspace:')) {
          // A `workspace:` spec must resolve to a workspace package; if the
          // name is unknown the manifest is wrong. Record it as external rather
          // than dropping it silently so the miss is at least visible in meta.
          if (!external.includes(dep.name)) external.push(dep.name);
        } else {
          if (!external.includes(dep.name)) external.push(dep.name);
        }
        specs[dep.name] = dep.spec;
        kindOf[dep.name] = dep.kind;
      }
      return {
        name: p.name,
        dir: p.dir,
        relDir: toRel(root, p.dir),
        requires: requires.sort(),
        external: external.sort(),
        provider: 'pnpm',
        meta: { specs, kinds: kindOf }
      };
    });
  }
};
