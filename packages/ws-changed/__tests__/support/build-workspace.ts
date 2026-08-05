import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export interface PkgSpec {
  /** Directory relative to the workspace root, e.g. `packages/a`. */
  dir: string;
  /** package.json contents (name defaults to the dir's basename). */
  pkg?: Record<string, unknown>;
  /** Extra files to write, keyed by path relative to the package dir. */
  files?: Record<string, string>;
}

export interface WorkspaceSpec {
  /** `pnpm-workspace.yaml` globs. Omit to write no pnpm-workspace file. */
  pnpmGlobs?: string[];
  /** package.json `workspaces` globs (npm/yarn style). */
  workspaces?: string[];
  packages: PkgSpec[];
  /** Extra root-level files, keyed by path relative to root. */
  rootFiles?: Record<string, string>;
}

/** Materialize a temporary workspace on disk and return its root. */
export function buildWorkspace(spec: WorkspaceSpec): string {
  const root = mkdtempSync(join(tmpdir(), 'ws-changed-'));

  if (spec.pnpmGlobs) {
    const yaml = `packages:\n${spec.pnpmGlobs.map((g) => `  - '${g}'`).join('\n')}\n`;
    writeFileSync(join(root, 'pnpm-workspace.yaml'), yaml);
  }

  const rootPkg: Record<string, unknown> = { name: 'root', private: true };
  if (spec.workspaces) rootPkg.workspaces = spec.workspaces;
  writeFileSync(join(root, 'package.json'), JSON.stringify(rootPkg, null, 2));

  for (const [path, body] of Object.entries(spec.rootFiles ?? {})) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }

  for (const p of spec.packages) {
    const dir = join(root, p.dir);
    mkdirSync(dir, { recursive: true });
    const name = (p.pkg?.name as string) ?? p.dir.split('/').pop()!;
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '0.0.0', ...p.pkg }, null, 2));
    for (const [rel, body] of Object.entries(p.files ?? {})) {
      const full = join(dir, rel);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, body);
    }
  }

  return root;
}

/** Write a pgpm module (control + plan) into `dir` under `root`. */
export function writePgpmModule(
  root: string,
  dir: string,
  name: string,
  requires: string[]
): void {
  const full = join(root, dir);
  mkdirSync(full, { recursive: true });
  writeFileSync(
    join(full, `${name}.control`),
    `# ${name} extension\ndefault_version = '0.0.1'\nrequires = '${requires.join(',')}'\n`
  );
  writeFileSync(join(full, 'pgpm.plan'), `%syntax-version=1.0.0\n%project=${name}\n%uri=${name}\n`);
}
