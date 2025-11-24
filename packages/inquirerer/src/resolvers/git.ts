import { execSync } from 'child_process';
import type { ResolverRegistry } from './types';

/**
 * Retrieves a git config value.
 * @param key The git config key (e.g., 'user.name', 'user.email')
 * @returns The config value as a string, or undefined if not found or error occurs
 */
export function getGitConfig(key: string): string | undefined {
    try {
        const result = execSync(`git config --global ${key}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
        });
        const trimmed = result.trim();
        return trimmed || undefined; // Treat empty string as undefined
    } catch {
        return undefined;
    }
}

/**
 * Built-in git configuration resolvers.
 */
export const gitResolvers: ResolverRegistry = {
    'git.user.name': () => getGitConfig('user.name'),
    'git.user.email': () => getGitConfig('user.email'),
};
