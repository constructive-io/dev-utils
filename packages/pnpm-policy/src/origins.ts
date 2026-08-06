/**
 * Where a package actually comes from.
 *
 * Deciding to trust an upstream means deciding to trust a *project*, but npm
 * only offers accounts, and an account is as wide as everything its owner will
 * ever publish. Someone who maintains the library you want may also co-maintain
 * something enormous you did not mean to exempt.
 *
 * The repository a package publishes from is a much closer proxy for "the
 * project", and it is checkable: `npm view <pkg> repository.url`. This groups a
 * set of packages by that field so a trust list can be derived from it rather
 * than from an account name.
 *
 * It is a proxy, not proof — repository metadata is self-reported, and a
 * compromised publish can claim anything. It answers "which project is this
 * package from", not "is this package safe".
 */

import { DEFAULT_REGISTRY, RegistryOptions } from './registry';

export interface PackageOrigin {
  name: string;
  /** Raw `repository.url` as published, when present. */
  repository?: string;
  /** `owner/repo` for a recognised host, lowercased. */
  slug?: string;
  /** The owner half of `slug` — a GitHub org or user. */
  owner?: string;
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/**
 * Pull `owner/repo` out of the many shapes a repository field takes:
 * `git+https://github.com/a/b.git`, `git@github.com:a/b.git`, `https://github.com/a/b`,
 * or the shorthand `a/b`.
 */
export function repositorySlug(url: string | undefined): string | undefined {
  if (!url) return undefined;

  const cleaned = url
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/^ssh:\/\/git@/, 'https://');

  const hosted = cleaned.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/#?]+)/);
  if (hosted) return `${hosted[1]}/${hosted[2]}`.toLowerCase();

  const shorthand = cleaned.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (shorthand) return `${shorthand[1]}/${shorthand[2]}`.toLowerCase();

  return undefined;
}

interface Packument {
  repository?: string | { url?: string };
  versions?: Record<string, { repository?: string | { url?: string } }>;
  'dist-tags'?: { latest?: string };
}

function repositoryUrl(packument: Packument): string | undefined {
  const pick = (value: Packument['repository']): string | undefined =>
    typeof value === 'string' ? value : value?.url;

  // Prefer the top level; fall back to the latest version, which is where older
  // publishes sometimes put it.
  const top = pick(packument.repository);
  if (top) return top;

  const latest = packument['dist-tags']?.latest;
  return latest ? pick(packument.versions?.[latest]?.repository) : undefined;
}

/**
 * Look up the repository each package publishes from.
 *
 * Uses the packument endpoint rather than search: search does not return
 * repository metadata, and one request per package is the honest cost. Failures
 * are reported as an origin with no repository rather than throwing, so one
 * unpublished or renamed package cannot abort a survey of hundreds.
 */
export async function packageOrigins(
  names: Iterable<string>,
  options: RegistryOptions & { onPackage?: (name: string, index: number, total: number) => void } = {}
): Promise<PackageOrigin[]> {
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const doFetch = options.fetchImpl ?? fetch;
  const throttleMs = options.throttleMs ?? 0;
  const list = [...names];
  const origins: PackageOrigin[] = [];

  for (const [index, name] of list.entries()) {
    options.onPackage?.(name, index, list.length);

    try {
      const response = await doFetch(`${registry}/${encodeURIComponent(name)}`);
      if (!response.ok) {
        origins.push({ name });
      } else {
        const repository = repositoryUrl((await response.json()) as Packument);
        const slug = repositorySlug(repository);
        origins.push({
          name,
          ...(repository ? { repository } : {}),
          ...(slug ? { slug, owner: slug.split('/')[0] } : {})
        });
      }
    } catch {
      origins.push({ name });
    }

    if (throttleMs && index < list.length - 1) await sleep(throttleMs);
  }

  return origins;
}

/** Group origins by repository owner; packages with no usable metadata land under `''`. */
export function groupByOwner(origins: PackageOrigin[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const origin of origins) {
    const key = origin.owner ?? '';
    grouped.set(key, [...(grouped.get(key) ?? []), origin.name].sort());
  }
  return grouped;
}

/** The names published from any of the given owners. */
export function namesFromOwners(origins: PackageOrigin[], owners: string[]): string[] {
  const wanted = new Set(owners.map((owner) => owner.toLowerCase()));
  return origins
    .filter((origin) => origin.owner && wanted.has(origin.owner))
    .map((origin) => origin.name)
    .sort();
}
