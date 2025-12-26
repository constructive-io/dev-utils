/**
 * A function that resolves a default value dynamically.
 * Can be synchronous or asynchronous.
 */
export type DefaultResolver = () => Promise<any> | any;

/**
 * A registry of resolver functions, keyed by their resolver name.
 * Example: { 'git.user.name': () => getGitConfig('user.name') }
 */
export interface ResolverRegistry {
    [key: string]: DefaultResolver;
}
