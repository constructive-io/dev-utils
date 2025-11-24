import { Inquirerer, registerDefaultResolver } from '../src';

/**
 * Example demonstrating the new defaultFrom feature
 *
 * This feature allows questions to automatically populate defaults from:
 * - Git configuration (git.user.name, git.user.email)
 * - Date/time values (date.year, date.iso, date.now)
 * - Custom resolvers you register
 */

async function basicExample() {
    console.log('=== Basic Example: Git and Date Resolvers ===\n');

    const questions = [
        {
            name: 'authorName',
            type: 'text' as const,
            message: 'Author name?',
            defaultFrom: 'git.user.name'  // Auto-fills from git config
        },
        {
            name: 'authorEmail',
            type: 'text' as const,
            message: 'Author email?',
            defaultFrom: 'git.user.email'  // Auto-fills from git config
        },
        {
            name: 'year',
            type: 'text' as const,
            message: 'Copyright year?',
            defaultFrom: 'date.year'  // Auto-fills current year
        }
    ];

    const prompter = new Inquirerer();
    const answers = await prompter.prompt({}, questions);

    console.log('\nAnswers:', answers);
    prompter.close();
}

async function customResolverExample() {
    console.log('\n=== Custom Resolver Example ===\n');

    // Register custom resolvers
    registerDefaultResolver('package.name', async () => {
        // In a real app, you'd read from package.json
        return 'my-awesome-package';
    });

    registerDefaultResolver('cwd.name', () => {
        return process.cwd().split('/').pop();
    });

    const questions = [
        {
            name: 'pkgName',
            type: 'text' as const,
            message: 'Package name?',
            defaultFrom: 'package.name'  // Uses custom resolver
        },
        {
            name: 'dirName',
            type: 'text' as const,
            message: 'Directory name?',
            defaultFrom: 'cwd.name'  // Uses custom resolver
        }
    ];

    const prompter = new Inquirerer();
    const answers = await prompter.prompt({}, questions);

    console.log('\nAnswers:', answers);
    prompter.close();
}

async function allAvailableResolvers() {
    console.log('\n=== All Built-in Resolvers ===\n');

    const builtInResolvers = [
        'git.user.name',
        'git.user.email',
        'date.year',
        'date.month',
        'date.day',
        'date.now',
        'date.iso',
        'date.timestamp'
    ];

    console.log('Built-in resolvers available:');
    builtInResolvers.forEach(resolver => {
        console.log(`  - ${resolver}`);
    });
}

// Run examples
(async () => {
    await allAvailableResolvers();
    // Uncomment to run interactive examples:
    // await basicExample();
    // await customResolverExample();
})();
