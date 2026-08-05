/**
 * Writing the policy into `pnpm-workspace.yaml`.
 *
 * The file is shared: `packages:`, catalogs and overrides live there too, and
 * they are none of this tool's business. So the policy is *patched* into the
 * document rather than the document being regenerated — every untouched key
 * keeps its position and, because the edit goes through a YAML AST rather than
 * a load/dump round-trip, its comments as well.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Document, parseDocument } from 'yaml';
import { applyComments } from 'yamlize';

import type { BuildsKey } from './policy';
import { managedKeys } from './policy';
import type { CommentPath, ResolvedPolicy } from './types';

export const WORKSPACE_FILENAME = 'pnpm-workspace.yaml';

/** The line stamped above the policy block, so a reader knows what owns it. */
export const MANAGED_MARKER =
  'Managed by pnpm-policy — run `pnpm-policy generate` after editing pnpm-policy.yaml.';

export interface ApplyOptions {
  buildsKey?: BuildsKey;
  /** Suppress the "managed by" stamp, for callers embedding this elsewhere. */
  marker?: boolean;
}

/**
 * Patch a policy into a `pnpm-workspace.yaml` source string.
 *
 * Managed keys the policy no longer sets are removed: a `blockExoticSubdeps`
 * left behind after it was dropped from the config would keep enforcing a rule
 * the policy no longer claims to make.
 */
export function applyPolicy(
  source: string,
  policy: ResolvedPolicy,
  options: ApplyOptions = {}
): string {
  const buildsKey = options.buildsKey ?? 'allowBuilds';
  const doc = source.trim() ? parseDocument(source) : new Document({});

  if (doc.contents == null) {
    doc.contents = doc.createNode({});
  }

  const managed = managedKeys(buildsKey);
  for (const key of managed) {
    if (!(key in policy.settings)) doc.delete(key);
  }
  for (const [key, value] of Object.entries(policy.settings)) {
    doc.set(key, value);
  }

  const first = Object.keys(policy.settings).find((key) => managed.includes(key));
  const before = policy.comments.before.map(([path, text]): [CommentPath, string] => {
    // The stamp goes on the first managed key rather than the top of the file,
    // where it would fight with whatever the workspace already says there.
    const body =
      options.marker !== false && path.length === 1 && path[0] === first
        ? `${MANAGED_MARKER}\n\n${text}`
        : text;
    // A leading blank line keeps each managed block visually separate, which
    // matters most for a key appended to the end of an existing file: it lands
    // flush against whatever was already the last line.
    return [path, path.length === 1 ? `\n${body}` : body];
  });

  applyComments(doc, { before, inline: policy.comments.inline });

  return doc.toString({ lineWidth: 0 });
}

/** Patch the policy into the workspace file, returning the text written. */
export function writeWorkspacePolicy(
  workspaceDir: string,
  policy: ResolvedPolicy,
  options: ApplyOptions = {}
): { file: string; content: string; changed: boolean } {
  const file = join(workspaceDir, WORKSPACE_FILENAME);
  const existing = existsSync(file) ? readFileSync(file, 'utf-8') : '';
  const content = applyPolicy(existing, policy, options);
  const changed = content !== existing;
  if (changed) writeFileSync(file, content);
  return { file, content, changed };
}

/** Would generating change the file? This is what `check` reports as drift. */
export function workspaceDrift(
  workspaceDir: string,
  policy: ResolvedPolicy,
  options: ApplyOptions = {}
): { file: string; expected: string; actual: string; drifted: boolean } {
  const file = join(workspaceDir, WORKSPACE_FILENAME);
  const actual = existsSync(file) ? readFileSync(file, 'utf-8') : '';
  const expected = applyPolicy(actual, policy, options);
  return { file, expected, actual, drifted: expected !== actual };
}
