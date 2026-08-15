/**
 * The two bits of path plumbing ws-changed needs, kept dependency-free and
 * deliberately small: expanding a workspace glob to directories, and matching a
 * relative path against gitignore-flavoured globs.
 */
import { existsSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'esm', '.git', 'coverage', '__snapshots__']);

/**
 * Expand a workspace glob (relative to `root`) to the directories it matches.
 *
 * Supports the shapes real workspace files use: literal segments, single-star
 * segments (`packages/*`), and `**` (`integrations/**`, any depth). A `*`
 * matches one path segment; `**` matches zero or more. Only directories are
 * returned, and `node_modules`/`dist`/etc. are never descended into.
 */
export function expandDirGlob(root: string, glob: string): string[] {
  const segments = glob.split('/').filter(Boolean);
  let dirs = [''];
  for (let s = 0; s < segments.length; s++) {
    const segment = segments[s];
    const next: string[] = [];
    for (const dir of dirs) {
      if (segment === '**') {
        // Zero or more segments: this dir and every descendant directory.
        for (const d of walkDirs(root, dir)) next.push(d);
        continue;
      }
      if (segment === '*') {
        const parent = join(root, dir);
        if (!existsSync(parent)) continue;
        for (const entry of readdirSync(parent)) {
          if (SKIP_DIRS.has(entry)) continue;
          const child = dir ? `${dir}/${entry}` : entry;
          if (isDir(join(root, child))) next.push(child);
        }
        continue;
      }
      // Literal segment: may itself contain `*`/`?` (e.g. `pkg-*`).
      const parent = join(root, dir);
      if (!existsSync(parent)) continue;
      if (/[*?]/.test(segment)) {
        const re = segmentRegExp(segment);
        for (const entry of readdirSync(parent)) {
          if (SKIP_DIRS.has(entry)) continue;
          if (!re.test(entry)) continue;
          const child = dir ? `${dir}/${entry}` : entry;
          if (isDir(join(root, child))) next.push(child);
        }
      } else {
        const child = dir ? `${dir}/${segment}` : segment;
        if (isDir(join(root, child))) next.push(child);
      }
    }
    dirs = next;
  }
  // Dedupe (a `**` can reach the same dir twice) and drop the empty root entry.
  return [...new Set(dirs)].filter(Boolean).sort();
}

function isDir(p: string): boolean {
  return statSync(p, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

/** Every directory at or below `rel` (relative to `root`), skipping SKIP_DIRS. */
function walkDirs(root: string, rel: string): string[] {
  const out: string[] = [];
  const start = join(root, rel);
  if (!isDir(start)) return out;
  (function walk(r: string): void {
    out.push(r);
    for (const entry of readdirSync(join(root, r), { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
      walk(r ? `${r}/${entry.name}` : entry.name);
    }
  })(rel);
  return out;
}

function segmentRegExp(segment: string): RegExp {
  let source = '';
  for (const ch of segment) {
    if (ch === '*') source += '[^/]*';
    else if (ch === '?') source += '[^/]';
    else source += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

/**
 * Compile a gitignore-flavoured glob to a RegExp matched against a
 * `/`-separated relative path. `*` = within a segment, `**` = across segments,
 * `?` = one char; a plain path matches itself and everything beneath it; a
 * leading `/` anchors to the root.
 */
function toRegExp(pattern: string): RegExp {
  const anchored = pattern.startsWith('/');
  let body = (anchored ? pattern.slice(1) : pattern).replace(/\/+$/, '');
  let source = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '*') {
      if (body[i + 1] === '*') {
        if (body[i + 2] === '/') {
          source += '(?:[^/]+/)*';
          i += 2;
        } else {
          source += '.*';
          i += 1;
        }
      } else {
        source += '[^/]*';
      }
      continue;
    }
    if (ch === '?') {
      source += '[^/]';
      continue;
    }
    source += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  const tail = '(?:/.*)?$';
  return new RegExp(anchored ? `^${source}${tail}` : `^(?:.*/)?${source}${tail}`);
}

/**
 * Build a predicate over relative (`/`-separated) paths. An empty pattern list
 * matches nothing, so an absent include filter must be handled by the caller.
 */
export function makeMatcher(patterns: string[] = []): (rel: string) => boolean {
  const regexes = patterns.filter((p) => p && p.trim()).map((p) => toRegExp(p.trim()));
  if (regexes.length === 0) return () => false;
  return (rel: string) => regexes.some((re) => re.test(rel));
}

/**
 * Normalize `.sql` / `sql` / `['.sql','.psql']` / `'ts,tsx'` into a lowercased
 * `.ext` list. Same shape git-changed accepts, so a filter written for one works
 * verbatim in the other.
 */
export function normalizeExts(ext?: string | string[]): string[] {
  const list = Array.isArray(ext) ? ext : ext ? [ext] : [];
  return list
    .flatMap((e) => e.split(','))
    .map((e) => e.trim())
    .filter(Boolean)
    .map((e) => (e.startsWith('.') ? e : `.${e}`))
    .map((e) => e.toLowerCase());
}

/**
 * The lowercased extension of a `/`-separated relative path, or `''` when it has
 * none. A leading dot is a name, not an extension, so `.gitignore` and `Makefile`
 * both yield `''`.
 */
export function extOf(rel: string): string {
  const base = rel.slice(rel.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot).toLowerCase() : '';
}

/** Normalize an absolute or relative path to a `/`-separated path relative to root. */
export function toRel(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}
