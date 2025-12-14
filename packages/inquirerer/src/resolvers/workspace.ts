import type { ResolverRegistry } from './types';

// We need to find package.json from cwd, not from the module location
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

interface PackageJson {
    name?: string;
    version?: string;
    description?: string;
    author?: string | { name?: string; email?: string; url?: string };
    license?: string;
    repository?: string | { type?: string; url?: string };
    [key: string]: any;
}

/**
 * Find and read the nearest package.json starting from cwd.
 * Uses the same algorithm as find-and-require-package-json but starts from cwd.
 */
function findPackageJsonFromCwd(): PackageJson | undefined {
    let currentDir = process.cwd();

    while (true) {
        const filePath = join(currentDir, 'package.json');

        if (existsSync(filePath)) {
            try {
                const str = readFileSync(filePath, 'utf8');
                return JSON.parse(str);
            } catch {
                return undefined;
            }
        }

        const parentDir = dirname(currentDir);

        // If reached the root directory, package.json is not found
        if (parentDir === currentDir) {
            return undefined;
        }

        currentDir = parentDir;
    }
}

/**
 * Parse a GitHub URL and extract organization and repo name.
 * Handles various formats:
 * - https://github.com/org/repo
 * - https://github.com/org/repo.git
 * - git@github.com:org/repo.git
 * - git://github.com/org/repo.git
 */
function parseGitHubUrl(url: string): { organization?: string; name?: string } {
    if (!url) {
        return {};
    }

    // Handle git@github.com:org/repo.git format
    const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?/);
    if (sshMatch) {
        return { organization: sshMatch[1], name: sshMatch[2] };
    }

    // Handle https://github.com/org/repo or git://github.com/org/repo formats
    const httpsMatch = url.match(/(?:https?|git):\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/);
    if (httpsMatch) {
        return { organization: httpsMatch[1], name: httpsMatch[2] };
    }

    return {};
}

/**
 * Get the repository URL from package.json.
 * Handles both string and object formats.
 */
function getRepositoryUrl(pkg: PackageJson): string | undefined {
    if (!pkg.repository) {
        return undefined;
    }

    if (typeof pkg.repository === 'string') {
        return pkg.repository;
    }

    return pkg.repository.url;
}

/**
 * Parse author field which can be a string or object.
 * String format: "Name <email> (url)" where email and url are optional
 */
function parseAuthor(author: string | { name?: string; email?: string; url?: string } | undefined): {
    name?: string;
    email?: string;
} {
    if (!author) {
        return {};
    }

    if (typeof author === 'object') {
        return { name: author.name, email: author.email };
    }

    // Parse string format: "Name <email> (url)"
    const nameMatch = author.match(/^([^<(]+)/);
    const emailMatch = author.match(/<([^>]+)>/);

    return {
        name: nameMatch ? nameMatch[1].trim() : undefined,
        email: emailMatch ? emailMatch[1] : undefined,
    };
}

/**
 * Built-in workspace resolvers.
 * These resolve values from the nearest package.json in the current working directory.
 */
export const workspaceResolvers: ResolverRegistry = {
    'workspace.repo.name': () => {
        const pkg = findPackageJsonFromCwd();
        if (!pkg) return undefined;
        const url = getRepositoryUrl(pkg);
        if (!url) return undefined;
        return parseGitHubUrl(url).name;
    },

    'workspace.repo.organization': () => {
        const pkg = findPackageJsonFromCwd();
        if (!pkg) return undefined;
        const url = getRepositoryUrl(pkg);
        if (!url) return undefined;
        return parseGitHubUrl(url).organization;
    },

    'workspace.author': () => {
        const pkg = findPackageJsonFromCwd();
        if (!pkg) return undefined;
        const parsed = parseAuthor(pkg.author);
        return parsed.name;
    },

    'workspace.author.name': () => {
        const pkg = findPackageJsonFromCwd();
        if (!pkg) return undefined;
        const parsed = parseAuthor(pkg.author);
        return parsed.name;
    },

    'workspace.author.email': () => {
        const pkg = findPackageJsonFromCwd();
        if (!pkg) return undefined;
        const parsed = parseAuthor(pkg.author);
        return parsed.email;
    },
};
