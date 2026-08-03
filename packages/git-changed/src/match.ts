import { isAbsolute, relative, resolve, sep } from 'path';

/**
 * Gitignore-flavoured glob matching, deliberately not a full glob engine — the
 * patterns these tools carry are `dist/`, `**\/generated/**`, `*.sql`, and the
 * occasional `packages/*\/deploy`. Supported:
 *
 * - `*`  — any run of characters within one path segment
 * - `**` — any run of segments
 * - `?`  — exactly one character
 * - a plain path (`sql/`, `dist`) matches that path *and everything under it*
 * - an unanchored pattern matches at any segment boundary (`generated/`
 *   matches `a/b/generated/c.sql`)
 * - a leading `/` anchors the pattern to `cwd`
 */
function toRegExp(pattern: string): RegExp {
  const anchored = pattern.startsWith('/');
  let body = anchored ? pattern.slice(1) : pattern;

  // A trailing slash is a directory marker; the subtree suffix below covers it.
  body = body.replace(/\/+$/, '');

  let source = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '*') {
      if (body[i + 1] === '*') {
        // `**/` spans zero or more segments; a bare `**` spans anything.
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

  // Match the path itself or anything beneath it, so `sql/` excludes the tree.
  const tail = '(?:/.*)?$';
  return new RegExp(anchored ? `^${source}${tail}` : `^(?:.*/)?${source}${tail}`);
}

/** Normalize to a `/`-separated path relative to `cwd`, for matching. */
function toRelative(file: string, cwd: string): string {
  const abs = isAbsolute(file) ? file : resolve(cwd, file);
  return relative(cwd, abs).split(sep).join('/');
}

/**
 * Compile patterns into a predicate. An empty pattern list matches nothing, so
 * `exclude: []` excludes nothing and `include: []` is treated as "no include
 * filter" by the caller rather than "include nothing".
 */
export function makeMatcher(
  patterns: string[] = [],
  cwd: string = process.cwd()
): (file: string) => boolean {
  const regexes = patterns.filter((p) => p && p.trim()).map((p) => toRegExp(p.trim()));
  if (regexes.length === 0) return () => false;

  return (file: string) => {
    const rel = toRelative(file, cwd);
    return regexes.some((re) => re.test(rel));
  };
}

/** `true` when `file` is inside one of `dirs` (or `dirs` is empty). */
export function withinAny(file: string, dirs: string[], cwd: string): boolean {
  if (dirs.length === 0) return true;
  const abs = isAbsolute(file) ? file : resolve(cwd, file);
  return dirs.some((dir) => {
    const root = isAbsolute(dir) ? dir : resolve(cwd, dir);
    if (abs === root) return true;
    return abs.startsWith(root.endsWith(sep) ? root : root + sep);
  });
}

/** Normalize `.sql` / `sql` / `['.sql','.psql']` into a `.ext` list. */
export function normalizeExts(ext?: string | string[]): string[] {
  const list = Array.isArray(ext) ? ext : ext ? [ext] : [];
  return list
    .flatMap((e) => e.split(','))
    .map((e) => e.trim())
    .filter(Boolean)
    .map((e) => (e.startsWith('.') ? e : `.${e}`))
    .map((e) => e.toLowerCase());
}
