import * as fs from 'fs';
import * as path from 'path';

import { CacheManager } from '../cache/cache-manager';
import { GitCloner } from '../git/git-cloner';
import { BoilerplateSkill } from '../scaffolder/types';
import { SkillInstallOptions, SkillInstallResult } from './types';

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SKILLS_DIR = path.join('.agents', 'skills');

/**
 * Installs skills from git repositories using shallow clones.
 *
 * Much faster than `npx skills add` because it:
 * - Clones with `--depth 1` (shallow)
 * - Caches source repos (subsequent installs are instant)
 * - Copies skill directories directly (no npm download)
 *
 * @example
 * ```typescript
 * const installer = new SkillInstaller({ toolName: 'pgpm' });
 * const result = installer.install(
 *   [{ source: 'constructive-io/constructive', skills: ['pgpm'] }],
 *   '/path/to/workspace'
 * );
 * ```
 */
export class SkillInstaller {
  private gitCloner: GitCloner;
  private cacheManager: CacheManager;

  constructor(options?: SkillInstallOptions) {
    this.gitCloner = new GitCloner();
    this.cacheManager = new CacheManager({
      toolName: options?.toolName ?? 'genomic',
      ttl: options?.cacheTtlMs ?? DEFAULT_TTL_MS,
      baseDir: options?.cacheBaseDir,
    });
  }

  /**
   * Install skills from their source repositories into a target directory.
   *
   * For each skill entry, clones the source repo (shallow, cached) and
   * copies `.agents/skills/<name>/` into `<targetDir>/.agents/skills/<name>/`.
   *
   * Non-fatal: failures are collected and returned, never thrown.
   */
  install(skills: BoilerplateSkill[], targetDir: string): SkillInstallResult {
    const installed: string[] = [];
    const failed: SkillInstallResult['failed'] = [];

    // Group skills by source to avoid cloning the same repo multiple times
    const bySource = new Map<string, string[]>();
    for (const entry of skills) {
      const existing = bySource.get(entry.source) ?? [];
      existing.push(...entry.skills);
      bySource.set(entry.source, existing);
    }

    for (const [source, skillNames] of bySource) {
      let repoDir: string;
      try {
        repoDir = this.ensureRepo(source);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        for (const skill of skillNames) {
          failed.push({ skill, source, error: msg });
        }
        continue;
      }

      for (const skillName of skillNames) {
        const sourcePath = path.join(repoDir, SKILLS_DIR, skillName);

        if (!fs.existsSync(sourcePath)) {
          failed.push({
            skill: skillName,
            source,
            error: `Skill not found in source: ${SKILLS_DIR}/${skillName}`,
          });
          continue;
        }

        try {
          const destPath = path.join(targetDir, SKILLS_DIR, skillName);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.cpSync(sourcePath, destPath, { recursive: true });
          installed.push(skillName);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failed.push({ skill: skillName, source, error: msg });
        }
      }
    }

    return { installed, failed };
  }

  /**
   * Clone (or retrieve from cache) a skill source repository.
   */
  private ensureRepo(source: string): string {
    const url = this.gitCloner.normalizeUrl(source);
    const cacheKey = this.cacheManager.createKey(url);

    const expiredMetadata = this.cacheManager.checkExpiration(cacheKey);
    if (expiredMetadata) {
      this.cacheManager.clear(cacheKey);
    }

    const cached = this.cacheManager.get(cacheKey);
    if (cached && !expiredMetadata) {
      return cached;
    }

    const dest = path.join(this.cacheManager.getReposDir(), cacheKey);
    this.gitCloner.clone(url, dest, {
      depth: 1,
      singleBranch: true,
    });
    this.cacheManager.set(cacheKey, dest);
    return dest;
  }
}
