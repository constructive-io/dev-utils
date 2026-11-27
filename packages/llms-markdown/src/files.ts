import { createHash } from 'node:crypto';
import { constants, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import type { Artifact, ExportPage, Twin } from './types';

export function discoverPages(outDir: string): ExportPage[] {
  if (!existsSync(join(outDir, 'index.html'))) throw new Error(`Missing static export: ${outDir}/index.html`);
  const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => relative(outDir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter((file) => !file.startsWith('_next/') && file !== '404.html' && file !== '404/index.html')
    .sort();
  return ['index.html', ...files.filter((file) => file !== 'index.html')].map((htmlFile) => {
    const route = htmlFile === 'index.html' ? '/' : `/${htmlFile.replace(/\/index\.html$/, '/').replace(/\.html$/, '')}`;
    return { route, htmlFile, file: route === '/' ? 'index.md' : `${route.slice(1).replace(/\/$/, '')}.md` };
  });
}

function safePath(file: string) {
  if (!file || file.includes('\\') || file.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid artifact path: ${file}`);
  }
  return file;
}

function artifactPath(outDir: string, file: string) {
  const segments = safePath(file).split('/');
  let target = outDir;
  for (const segment of ['', ...segments]) {
    target = join(target, segment);
    if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`Refusing to follow artifact symlink: ${target}`);
    }
  }
  return target;
}

export function writeArtifacts(outDir: string, artifacts: readonly Artifact[]) {
  const targets = artifacts.map(({ file, contents }) => ({ target: artifactPath(outDir, file), contents }));
  for (const { target, contents } of targets) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents, { flag: constants.O_CREAT | constants.O_TRUNC | constants.O_WRONLY | constants.O_NOFOLLOW });
  }
}

const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
type Entry = Pick<Twin, 'route' | 'file'> & { sha256: string; unavailable?: true };
export const manifestFile = '.llms-markdown.json';
export type StaleOptions = {
  previousManifest?: string;
  unavailable?: boolean | ((entry: Pick<Twin, 'route' | 'file'>) => string);
};

export function planManifest(outDir: string, twins: readonly Twin[], stale: StaleOptions = {}): Artifact[] {
  const entries: Entry[] = twins.map(({ route, file, markdown }) => ({ route, file, sha256: digest(markdown) }));
  const tombstones: Artifact[] = [];
  const previous = stale.previousManifest ?? join(outDir, manifestFile);
  if (stale.unavailable && existsSync(previous)) {
    const manifest: { version: number; twins: Entry[] } = JSON.parse(readFileSync(previous, 'utf8'));
    if (manifest.version !== 1 || !Array.isArray(manifest.twins)) throw new Error(`Invalid twin manifest: ${previous}`);
    const files = new Set(entries.map(({ file }) => file));
    for (const { route, file, sha256 } of manifest.twins) {
      if (typeof route !== 'string' || typeof file !== 'string' || !file.endsWith('.md')) {
        throw new Error(`Invalid twin manifest entry: ${previous}`);
      }
      const path = artifactPath(outDir, file);
      if (files.has(file) || (existsSync(path) && digest(readFileSync(path)) !== sha256)) continue;
      files.add(file);
      const contents = typeof stale.unavailable === 'function'
        ? stale.unavailable({ route, file })
        : '# Page no longer available\n\nThis page is no longer part of the site.\n';
      entries.push({ route, file, sha256: digest(contents), unavailable: true });
      tombstones.push({ file, contents });
    }
  }
  return [...tombstones, { file: manifestFile, contents: `${JSON.stringify({ version: 1, twins: entries }, null, 2)}\n` }];
}
