import type { ResolverRegistry } from './types';

/**
 * Built-in date/time resolvers.
 */
export const dateResolvers: ResolverRegistry = {
    'date.year': () => new Date().getFullYear().toString(),
    'date.month': () => (new Date().getMonth() + 1).toString().padStart(2, '0'),
    'date.day': () => new Date().getDate().toString().padStart(2, '0'),
    'date.now': () => new Date().toISOString(),
    'date.iso': () => new Date().toISOString().split('T')[0], // YYYY-MM-DD
    'date.timestamp': () => Date.now().toString(),
};
