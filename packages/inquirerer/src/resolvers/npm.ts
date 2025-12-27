import { execSync } from 'child_process';
import type { ResolverRegistry } from './types';

/**
 * Retrieves the currently logged in npm user.
 * @returns The npm username, or undefined if not logged in or error occurs
 */
export function getNpmWhoami(): string | undefined {
    try {
        const result = execSync('npm whoami', {
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
 * Built-in npm resolvers.
 */
export const npmResolvers: ResolverRegistry = {
    'npm.whoami': () => getNpmWhoami(),
};
