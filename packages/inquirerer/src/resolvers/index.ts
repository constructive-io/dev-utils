import { gitResolvers } from './git';
import { dateResolvers } from './date';
import type { DefaultResolver, ResolverRegistry } from './types';

/**
 * A registry for managing default value resolvers.
 * Allows registration of custom resolvers and provides resolution logic.
 */
export class DefaultResolverRegistry {
    private resolvers: ResolverRegistry;

    constructor(initialResolvers: ResolverRegistry = {}) {
        this.resolvers = { ...initialResolvers };
    }

    /**
     * Register a custom resolver.
     * @param key The resolver key (e.g., 'git.user.name')
     * @param resolver The resolver function
     */
    register(key: string, resolver: DefaultResolver): void {
        this.resolvers[key] = resolver;
    }

    /**
     * Unregister a resolver.
     * @param key The resolver key to remove
     */
    unregister(key: string): void {
        delete this.resolvers[key];
    }

    /**
     * Resolve a key to its value.
     * Returns undefined if the resolver doesn't exist or if it throws an error.
     * @param key The resolver key
     * @returns The resolved value or undefined
     */
    async resolve(key: string): Promise<any> {
        const resolver = this.resolvers[key];
        if (!resolver) {
            return undefined;
        }

        try {
            const result = await Promise.resolve(resolver());
            // Treat empty strings as undefined
            return result === '' ? undefined : result;
        } catch (error) {
            // Silent failure - log only in debug mode
            if (process.env.DEBUG === 'inquirerer') {
                console.error(`[inquirerer] Resolver '${key}' failed:`, error);
            }
            return undefined;
        }
    }

    /**
     * Check if a resolver exists for the given key.
     * @param key The resolver key
     * @returns True if the resolver exists
     */
    has(key: string): boolean {
        return key in this.resolvers;
    }

    /**
     * Get all registered resolver keys.
     * @returns Array of resolver keys
     */
    keys(): string[] {
        return Object.keys(this.resolvers);
    }

    /**
     * Create a copy of this registry with all current resolvers.
     * @returns A new DefaultResolverRegistry instance
     */
    clone(): DefaultResolverRegistry {
        return new DefaultResolverRegistry({ ...this.resolvers });
    }
}

/**
 * Global resolver registry instance with built-in resolvers.
 * This is the default registry used by Inquirerer unless a custom one is provided.
 */
export const globalResolverRegistry = new DefaultResolverRegistry({
    ...gitResolvers,
    ...dateResolvers,
});

/**
 * Convenience function to register a resolver on the global registry.
 * @param key The resolver key
 * @param resolver The resolver function
 */
export function registerDefaultResolver(key: string, resolver: DefaultResolver): void {
    globalResolverRegistry.register(key, resolver);
}

/**
 * Convenience function to resolve a key using the global registry.
 * @param key The resolver key
 * @returns The resolved value or undefined
 */
export function resolveDefault(key: string): Promise<any> {
    return globalResolverRegistry.resolve(key);
}

// Re-export types and utilities
export type { DefaultResolver, ResolverRegistry } from './types';
export { getGitConfig } from './git';
