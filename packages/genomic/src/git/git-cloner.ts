import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createSpinner } from 'inquirerer';
import { GitCloneOptions, GitCloneResult } from './types';

export class GitCloner {
  /**
   * Clone a git repository to a destination
   * @param url - Repository URL (will be normalized)
   * @param destination - Target directory path
   * @param options - Clone options (branch, depth)
   * @returns Clone result with normalized URL and destination
   */
  clone(
    url: string,
    destination: string,
    options?: GitCloneOptions
  ): GitCloneResult {
    const normalizedUrl = this.normalizeUrl(url);

    // Clean destination if exists
    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { recursive: true, force: true });
    }

    this.executeClone(normalizedUrl, destination, options);
    this.removeGitDir(destination);

    return {
      destination,
      normalizedUrl,
      branch: options?.branch,
    };
  }

  /**
   * Clone to a temporary directory
   * @param url - Repository URL
   * @param options - Clone options
   * @returns Clone result with temp directory path
   */
  cloneToTemp(url: string, options?: GitCloneOptions): GitCloneResult {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-gen-'));
    return this.clone(url, tempDir, options);
  }

  /**
   * Normalize a URL to git-cloneable format
   * Handles: org/repo -> https://github.com/org/repo.git
   */
  normalizeUrl(url: string): string {
    // Already a full URL
    if (
      url.startsWith('git@') ||
      url.startsWith('https://') ||
      url.startsWith('http://')
    ) {
      return url;
    }

    // org/repo shorthand
    if (/^[\w-]+\/[\w-]+$/.test(url)) {
      return `https://github.com/${url}.git`;
    }

    return url;
  }

  /**
   * Validate git URL format
   */
  validateUrl(url: string): boolean {
    const normalized = this.normalizeUrl(url);
    return (
      normalized.startsWith('git@') ||
      normalized.startsWith('https://') ||
      normalized.startsWith('http://')
    );
  }

  /**
   * Remove .git directory from cloned repo
   */
  removeGitDir(directory: string): void {
    const gitDir = path.join(directory, '.git');
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }
  }

  private executeClone(
    url: string,
    destination: string,
    options?: GitCloneOptions
  ): void {
    const branch = options?.branch;
    const depth = options?.depth ?? 1;
    const singleBranch = options?.singleBranch ?? true;
    const silent = options?.silent ?? true;

    const branchArgs = branch ? ` --branch ${branch}` : '';
    const singleBranchArgs = singleBranch ? ' --single-branch' : '';
    const depthArgs = ` --depth ${depth}`;

    const command = `git clone${branchArgs}${singleBranchArgs}${depthArgs} ${url} ${destination}`;

    const spinner = silent ? createSpinner(`Cloning ${url}...`) : null;
    
    try {
      if (spinner) {
        spinner.start();
      }
      
      execSync(command, { 
        stdio: silent ? 'pipe' : 'inherit',
        encoding: 'utf-8'
      });
      
      if (spinner) {
        spinner.succeed('Repository cloned');
      }
    } catch (error) {
      if (spinner) {
        spinner.fail('Failed to clone repository');
      }
      
      // Clean up on failure
      if (fs.existsSync(destination)) {
        fs.rmSync(destination, { recursive: true, force: true });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to clone repository: ${errorMessage}`);
    }
  }
}
