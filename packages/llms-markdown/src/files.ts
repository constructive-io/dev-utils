import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import type { Artifact, ExportPage, Twin } from './types';

export function discoverPages(outDir: string): ExportPage[] {
  if (!existsSync(join(outDir, 'index.html'))) throw new Error(`Missing static export: ${outDir}/index.html`);
  const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => relative(outDir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter((file) => !file.startsWith('_next/') && file !== '404.html' && file !== '404/index.html')
    .sort();
  const exported = new Set(files);
  const pages = files.filter((file) => file !== 'index.html' &&
    (file.endsWith('/index.html') || !exported.has(`${file.slice(0, -'.html'.length)}/index.html`)));
  return ['index.html', ...pages].map((htmlFile) => {
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

export function writeArtifacts(outDir: string, artifacts: readonly Artifact[], stale: StaleOptions = {}) {
  const targets = artifacts.map(({ file, contents }) => ({ file, target: artifactPath(outDir, file), contents }));
  const existingTwins = targets.filter(({ file, target }) => /\.md$/i.test(file) && existsSync(target));
  if (existingTwins.length) {
    const current = artifactPath(outDir, manifestFile);
    const manifests = [current];
    if (stale.previousManifest && stale.previousManifest !== current) manifests.push(stale.previousManifest);
    const owned = manifests.map((path) => new Map(readManifest(path).map(({ file, sha256 }) => [file, sha256])));
    for (const { file, target } of existingTwins) {
      const sha256 = lstatSync(target).isFile() ? digest(readFileSync(target)) : undefined;
      if (!sha256 || !owned.some((manifest) => manifest.get(file) === sha256)) {
        throw new Error(`Refusing to overwrite unowned Markdown: ${file}`);
      }
    }
  }
  for (const { target, contents } of targets) {
    mkdirSync(dirname(target), { recursive: true });
    const handle = openSync(target, constants.O_CREAT | constants.O_TRUNC | constants.O_WRONLY | constants.O_NOFOLLOW);
    try {
      writeFileSync(handle, contents);
    } finally {
      closeSync(handle);
    }
  }
}

const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
type Entry = Pick<Twin, 'route' | 'file'> & { sha256: string; unavailable?: true };
export const manifestFile = '.llms-markdown.json';
export type StaleOptions = {
  previousManifest?: string;
  unavailable?: boolean | ((entry: Pick<Twin, 'route' | 'file'>) => string);
};

function readManifest(path: string): Entry[] {
  if (!existsSync(path)) return [];
  const manifest: { version: number; twins: Entry[] } = JSON.parse(readFileSync(path, 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.twins)) throw new Error(`Invalid twin manifest: ${path}`);
  return manifest.twins;
}

export function planManifest(outDir: string, twins: readonly Twin[], stale: StaleOptions = {}): Artifact[] {
  const entries: Entry[] = twins.map(({ route, file, markdown }) => ({ route, file, sha256: digest(markdown) }));
  const tombstones: Artifact[] = [];
  const previous = (stale.unavailable && stale.previousManifest) || artifactPath(outDir, manifestFile);
  const files = new Set(entries.map(({ file }) => file));
  for (const entry of readManifest(previous)) {
    const { route, file, sha256 } = entry;
    if (typeof route !== 'string' || typeof file !== 'string' || !file.endsWith('.md')) {
      throw new Error(`Invalid twin manifest entry: ${previous}`);
    }
    if (files.has(file)) continue;
    const path = artifactPath(outDir, file);
    const existing = lstatSync(path, { throwIfNoEntry: false });
    if (existing && (!existing.isFile() || digest(readFileSync(path)) !== sha256)) continue;
    files.add(file);
    if (stale.unavailable) {
      const contents = typeof stale.unavailable === 'function'
        ? stale.unavailable({ route, file })
        : '# Page no longer available\n\nThis page is no longer part of the site.\n';
      entries.push({ route, file, sha256: digest(contents), unavailable: true });
      tombstones.push({ file, contents });
    } else if (existing) {
      entries.push(entry);
    }
  }
  return [...tombstones, { file: manifestFile, contents: `${JSON.stringify({ version: 1, twins: entries }, null, 2)}\n` }];
}
