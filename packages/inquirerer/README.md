# inquirerer

<p align="center" width="100%">
    <img height="90" src="https://raw.githubusercontent.com/hyperweb-io/dev-utils/refs/heads/main/docs/img/inquirerer.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
  <a href="https://www.npmjs.com/package/inquirerer"><img height="20" src="https://img.shields.io/npm/dt/inquirerer"></a>
  <a href="https://www.npmjs.com/package/inquirerer"><img height="20" src="https://img.shields.io/github/package-json/v/hyperweb-io/dev-utils?filename=packages%2Finquirerer%2Fpackage.json"></a>
</p>

A powerful, TypeScript-first library for building beautiful command-line interfaces. Create interactive CLI tools with ease using intuitive prompts, validation, and rich user experiences.

## Installation

```bash
npm install inquirerer
```

## Features

- 🔌 **CLI Builder** - Build command-line utilties fast
- 🖊 **Multiple Question Types** - Support for text, autocomplete, checkbox, and confirm questions
- 🤖 **Non-Interactive Mode** - Fallback to defaults for CI/CD environments, great for testing
- ✅ **Smart Validation** - Built-in pattern matching, custom validators, and sanitizers
- 🔀 **Conditional Logic** - Show/hide questions based on previous answers
- 🎨 **Interactive UX** - Fuzzy search, keyboard navigation, and visual feedback
- 🔄 **Dynamic Defaults** - Auto-populate defaults from git config, date/time, or custom resolvers

## Table of Contents

- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [TypeScript Support](#typescript-support)
  - [Question Types](#question-types)
  - [Non-Interactive Mode](#non-interactive-mode)
- [API Reference](#api-reference)
  - [Inquirerer Class](#inquirerer-class)
  - [Question Types](#question-types-1)
    - [Text Question](#text-question)
    - [Number Question](#number-question)
    - [Confirm Question](#confirm-question)
    - [List Question](#list-question)
    - [Autocomplete Question](#autocomplete-question)
    - [Checkbox Question](#checkbox-question)
  - [Advanced Question Options](#advanced-question-options)
- [Real-World Examples](#real-world-examples)
  - [Project Setup Wizard](#project-setup-wizard)
  - [Configuration Builder](#configuration-builder)
  - [CLI with Commander Integration](#cli-with-commander-integration)
  - [Dynamic Dependencies](#dynamic-dependencies)
  - [Custom Validation](#custom-validation)
- [Dynamic Defaults with Resolvers](#dynamic-defaults-with-resolvers)
  - [Built-in Resolvers](#built-in-resolvers)
  - [Custom Resolvers](#custom-resolvers)
  - [Resolver Examples](#resolver-examples)
- [CLI Helper](#cli-helper)
- [Developing](#developing)

## Quick Start

```typescript
import { Inquirerer } from 'inquirerer';

const prompter = new Inquirerer();

const answers = await prompter.prompt({}, [
  {
    type: 'text',
    name: 'username',
    message: 'What is your username?',
    required: true
  },
  {
    type: 'confirm',
    name: 'newsletter',
    message: 'Subscribe to our newsletter?',
    default: true
  }
]);

console.log(answers);
// { username: 'john_doe', newsletter: true }
```

## Core Concepts

### TypeScript Support

Import types for full type safety:

```typescript
import {
  Inquirerer,
  Question,
  TextQuestion,
  NumberQuestion,
  ConfirmQuestion,
  ListQuestion,
  AutocompleteQuestion,
  CheckboxQuestion,
  InquirererOptions,
  DefaultResolverRegistry,
  registerDefaultResolver,
  resolveDefault
} from 'inquirerer';

interface UserConfig {
  name: string;
  age: number;
  newsletter: boolean;
}

const answers = await prompter.prompt<UserConfig>({}, questions);
// answers is typed as UserConfig
```

### Question Types

All questions support these base properties:

```typescript
interface BaseQuestion {
  name: string;           // Property name in result object
  type: string;           // Question type
  message?: string;       // Prompt message to display
  description?: string;   // Additional context
  default?: any;          // Default value
  defaultFrom?: string;   // Dynamic default from resolver (e.g., 'git.user.name')
  setFrom?: string;       // Auto-set value from resolver, bypassing prompt entirely
  useDefault?: boolean;   // Skip prompt and use default
  required?: boolean;     // Validation requirement
  validate?: (input: any, answers: any) => boolean | Validation;
  sanitize?: (input: any, answers: any) => any;
  pattern?: string;       // Regex pattern for validation
  dependsOn?: string[];   // Question dependencies
  when?: (answers: any) => boolean;  // Conditional display
}
```

### Non-Interactive Mode

When running in CI/CD or without a TTY, inquirerer automatically falls back to default values:

```typescript
const prompter = new Inquirerer({
  noTty: true,  // Force non-interactive mode
  useDefaults: true  // Use defaults without prompting
});
```

## API Reference

### Inquirerer Class

#### Constructor Options

```typescript
interface InquirererOptions {
  noTty?: boolean;                     // Disable interactive mode
  input?: Readable;                    // Input stream (default: process.stdin)
  output?: Writable;                   // Output stream (default: process.stdout)
  useDefaults?: boolean;               // Skip prompts and use defaults
  globalMaxLines?: number;             // Max lines for list displays (default: 10)
  mutateArgs?: boolean;                // Mutate argv object (default: true)
  resolverRegistry?: DefaultResolverRegistry;  // Custom resolver registry
}

const prompter = new Inquirerer(options);
```

#### Methods

```typescript
// Main prompt method
prompt<T>(argv: T, questions: Question[], options?: PromptOptions): Promise<T>

// Generate man page documentation
generateManPage(info: ManPageInfo): string

// Clean up resources
close(): void
exit(): void
```

### Question Types

#### Text Question

Collect string input from users.

```typescript
{
  type: 'text',
  name: 'projectName',
  message: 'What is your project name?',
  default: 'my-app',
  required: true,
  pattern: '^[a-z0-9-]+$',  // Regex validation
  validate: (input) => {
    if (input.length < 3) {
      return { success: false, reason: 'Name must be at least 3 characters' };
    }
    return true;
  }
}
```

#### Number Question

Collect numeric input.

```typescript
{
  type: 'number',
  name: 'port',
  message: 'Which port to use?',
  default: 3000,
  validate: (input) => {
    if (input < 1 || input > 65535) {
      return { success: false, reason: 'Port must be between 1 and 65535' };
    }
    return true;
  }
}
```

#### Confirm Question

Yes/no questions.

```typescript
{
  type: 'confirm',
  name: 'useTypeScript',
  message: 'Use TypeScript?',
  default: true  // Default to 'yes'
}
```

#### List Question

Select one option from a list (no search).

```typescript
{
  type: 'list',
  name: 'license',
  message: 'Choose a license',
  options: ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause'],
  default: 'MIT',
  maxDisplayLines: 5
}
```

#### Autocomplete Question

Select with fuzzy search capabilities.

```typescript
{
  type: 'autocomplete',
  name: 'framework',
  message: 'Choose your framework',
  options: [
    { name: 'React', value: 'react' },
    { name: 'Vue.js', value: 'vue' },
    { name: 'Angular', value: 'angular' },
    { name: 'Svelte', value: 'svelte' }
  ],
  allowCustomOptions: true,  // Allow user to enter custom value
  maxDisplayLines: 8
}
```

#### Checkbox Question

Multi-select with search.

```typescript
{
  type: 'checkbox',
  name: 'features',
  message: 'Select features to include',
  options: [
    'Authentication',
    'Database',
    'API Routes',
    'Testing',
    'Documentation'
  ],
  default: ['Authentication', 'API Routes'],
  returnFullResults: false,  // Only return selected items
  required: true
}
```

With `returnFullResults: true`, returns all options with selection status:

```typescript
[
  { name: 'Authentication', value: 'Authentication', selected: true },
  { name: 'Database', value: 'Database', selected: false },
  // ...
]
```

### Advanced Question Options

#### Custom Validation

```typescript
{
  type: 'text',
  name: 'email',
  message: 'Enter your email',
  pattern: '^[^@]+@[^@]+\\.[^@]+$',
  validate: (email, answers) => {
    // Custom async validation possible
    if (email.endsWith('@example.com')) {
      return {
        success: false,
        reason: 'Please use a real email address'
      };
    }
    return { success: true };
  }
}
```

#### Value Sanitization

```typescript
{
  type: 'text',
  name: 'tags',
  message: 'Enter tags (comma-separated)',
  sanitize: (input) => {
    return input.split(',').map(tag => tag.trim());
  }
}
```

#### Conditional Questions

```typescript
const questions: Question[] = [
  {
    type: 'confirm',
    name: 'useDatabase',
    message: 'Do you need a database?',
    default: false
  },
  {
    type: 'list',
    name: 'database',
    message: 'Which database?',
    options: ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite'],
    when: (answers) => answers.useDatabase === true  // Only show if useDatabase is true
  }
];
```

#### Question Dependencies

Ensure questions appear in the correct order:

```typescript
[
  {
    type: 'checkbox',
    name: 'services',
    message: 'Select services',
    options: ['Auth', 'Storage', 'Functions']
  },
  {
    type: 'text',
    name: 'authProvider',
    message: 'Which auth provider?',
    dependsOn: ['services'],  // Wait for services question
    when: (answers) => {
      const selected = answers.services.find(s => s.name === 'Auth');
      return selected?.selected === true;
    }
  }
]
```

## Real-World Examples

### Project Setup Wizard

```typescript
import { Inquirerer, Question } from 'inquirerer';
import minimist from 'minimist';

const argv = minimist(process.argv.slice(2));
const prompter = new Inquirerer();

const questions: Question[] = [
  {
    type: 'text',
    name: 'projectName',
    message: 'Project name',
    required: true,
    pattern: '^[a-z0-9-]+$'
  },
  {
    type: 'text',
    name: 'description',
    message: 'Project description',
    default: 'My awesome project'
  },
  {
    type: 'confirm',
    name: 'typescript',
    message: 'Use TypeScript?',
    default: true
  },
  {
    type: 'autocomplete',
    name: 'framework',
    message: 'Choose a framework',
    options: ['React', 'Vue', 'Svelte', 'None'],
    default: 'React'
  },
  {
    type: 'checkbox',
    name: 'tools',
    message: 'Additional tools',
    options: ['ESLint', 'Prettier', 'Jest', 'Husky'],
    default: ['ESLint', 'Prettier']
  }
];

const config = await prompter.prompt(argv, questions);
console.log('Creating project with:', config);
```

Run interactively:
```bash
node setup.js
```

Or with CLI args:
```bash
node setup.js --projectName=my-app --typescript --framework=React
```

### Configuration Builder

```typescript
interface AppConfig {
  port: number;
  host: string;
  ssl: boolean;
  sslCert?: string;
  sslKey?: string;
  database: string;
  logLevel: string;
}

const questions: Question[] = [
  {
    type: 'number',
    name: 'port',
    message: 'Server port',
    default: 3000,
    validate: (port) => port > 0 && port < 65536
  },
  {
    type: 'text',
    name: 'host',
    message: 'Server host',
    default: '0.0.0.0'
  },
  {
    type: 'confirm',
    name: 'ssl',
    message: 'Enable SSL?',
    default: false
  },
  {
    type: 'text',
    name: 'sslCert',
    message: 'SSL certificate path',
    when: (answers) => answers.ssl === true,
    required: true
  },
  {
    type: 'text',
    name: 'sslKey',
    message: 'SSL key path',
    when: (answers) => answers.ssl === true,
    required: true
  },
  {
    type: 'list',
    name: 'database',
    message: 'Database type',
    options: ['PostgreSQL', 'MySQL', 'SQLite'],
    default: 'PostgreSQL'
  },
  {
    type: 'list',
    name: 'logLevel',
    message: 'Log level',
    options: ['error', 'warn', 'info', 'debug'],
    default: 'info'
  }
];

const config = await prompter.prompt<AppConfig>(argv, questions);

// Write config to file
fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
```

### CLI with Commander Integration

```typescript
import { CLI, CommandHandler } from 'inquirerer';
import { Question } from 'inquirerer';

const handler: CommandHandler = async (argv, prompter, options) => {
  const questions: Question[] = [
    {
      type: 'text',
      name: 'name',
      message: 'What is your name?',
      required: true
    },
    {
      type: 'number',
      name: 'age',
      message: 'What is your age?',
      validate: (age) => age >= 0 && age <= 120
    }
  ];

  const answers = await prompter.prompt(argv, questions);
  console.log('Hello,', answers.name);
};

const cli = new CLI(handler, {
  version: 'myapp@1.0.0',
  minimistOpts: {
    alias: {
      n: 'name',
      a: 'age',
      v: 'version'
    }
  }
});

await cli.run();
```

### Dynamic Dependencies

```typescript
const questions: Question[] = [
  {
    type: 'checkbox',
    name: 'cloud',
    message: 'Select cloud services',
    options: ['AWS', 'Azure', 'GCP'],
    returnFullResults: true
  },
  {
    type: 'text',
    name: 'awsRegion',
    message: 'AWS Region',
    dependsOn: ['cloud'],
    when: (answers) => {
      const aws = answers.cloud?.find(c => c.name === 'AWS');
      return aws?.selected === true;
    },
    default: 'us-east-1'
  },
  {
    type: 'text',
    name: 'azureLocation',
    message: 'Azure Location',
    dependsOn: ['cloud'],
    when: (answers) => {
      const azure = answers.cloud?.find(c => c.name === 'Azure');
      return azure?.selected === true;
    },
    default: 'eastus'
  },
  {
    type: 'text',
    name: 'gcpZone',
    message: 'GCP Zone',
    dependsOn: ['cloud'],
    when: (answers) => {
      const gcp = answers.cloud?.find(c => c.name === 'GCP');
      return gcp?.selected === true;
    },
    default: 'us-central1-a'
  }
];

const config = await prompter.prompt({}, questions);
```

### Custom Validation

```typescript
const questions: Question[] = [
  {
    type: 'text',
    name: 'username',
    message: 'Choose a username',
    required: true,
    pattern: '^[a-zA-Z0-9_]{3,20}$',
    validate: async (username) => {
      // Simulate API call to check availability
      const available = await checkUsernameAvailability(username);
      if (!available) {
        return {
          success: false,
          reason: 'Username is already taken'
        };
      }
      return { success: true };
    }
  },
  {
    type: 'text',
    name: 'password',
    message: 'Choose a password',
    required: true,
    validate: (password) => {
      if (password.length < 8) {
        return {
          success: false,
          reason: 'Password must be at least 8 characters'
        };
      }
      if (!/[A-Z]/.test(password)) {
        return {
          success: false,
          reason: 'Password must contain an uppercase letter'
        };
      }
      if (!/[0-9]/.test(password)) {
        return {
          success: false,
          reason: 'Password must contain a number'
        };
      }
      return { success: true };
    }
  },
  {
    type: 'text',
    name: 'confirmPassword',
    message: 'Confirm password',
    required: true,
    dependsOn: ['password'],
    validate: (confirm, answers) => {
      if (confirm !== answers.password) {
        return {
          success: false,
          reason: 'Passwords do not match'
        };
      }
      return { success: true };
    }
  }
];
```

## Dynamic Defaults with Resolvers

The `defaultFrom` feature allows you to automatically populate question defaults from dynamic sources like git configuration, environment variables, date/time values, or custom resolvers. This eliminates repetitive boilerplate code for common default values.

### Quick Example

```typescript
import { Inquirerer } from 'inquirerer';

const questions = [
  {
    type: 'text',
    name: 'authorName',
    message: 'Author name?',
    defaultFrom: 'git.user.name'  // Auto-fills from git config
  },
  {
    type: 'text',
    name: 'authorEmail',
    message: 'Author email?',
    defaultFrom: 'git.user.email'  // Auto-fills from git config
  },
  {
    type: 'text',
    name: 'npmUser',
    message: 'NPM username?',
    defaultFrom: 'npm.whoami'  // Auto-fills from npm whoami
  },
  {
    type: 'text',
    name: 'copyrightYear',
    message: 'Copyright year?',
    defaultFrom: 'date.year'  // Auto-fills current year
  }
];

const prompter = new Inquirerer();
const answers = await prompter.prompt({}, questions);
```

### Built-in Resolvers

Inquirerer comes with several built-in resolvers ready to use:

#### Git Configuration

| Resolver | Description | Example Output |
|----------|-------------|----------------|
| `git.user.name` | Git global user name | `"John Doe"` |
| `git.user.email` | Git global user email | `"john@example.com"` |

#### NPM

| Resolver | Description | Example Output |
|----------|-------------|----------------|
| `npm.whoami` | Currently logged in npm user | `"johndoe"` |

#### Date & Time

| Resolver | Description | Example Output |
|----------|-------------|----------------|
| `date.year` | Current year | `"2025"` |
| `date.month` | Current month (zero-padded) | `"11"` |
| `date.day` | Current day (zero-padded) | `"23"` |
| `date.iso` | ISO date (YYYY-MM-DD) | `"2025-11-23"` |
| `date.now` | ISO timestamp | `"2025-11-23T15:30:45.123Z"` |
| `date.timestamp` | Unix timestamp (ms) | `"1732375845123"` |

### Priority Order

When resolving default values, inquirerer follows this priority:

1. **CLI Arguments** - Values passed via command line (highest priority)
2. **`setFrom`** - Auto-set values (bypasses prompt entirely)
3. **`defaultFrom`** - Dynamically resolved default values
4. **`default`** - Static default values
5. **`undefined`** - No default available

```typescript
{
  type: 'text',
  name: 'author',
  defaultFrom: 'git.user.name',  // Try git first
  default: 'Anonymous'            // Fallback if git not configured
}
```

### `setFrom` vs `defaultFrom`

Both `setFrom` and `defaultFrom` use resolvers to get values, but they behave differently:

| Feature | `defaultFrom` | `setFrom` |
|---------|---------------|-----------|
| Sets value as | Default (user can override) | Final value (no prompt) |
| User prompted? | Yes, with pre-filled default | No, question is skipped |
| Use case | Suggested values | Auto-computed values |

**`defaultFrom`** - The resolved value becomes the default, but the user is still prompted and can change it:

```typescript
{
  type: 'text',
  name: 'authorName',
  message: 'Author name?',
  defaultFrom: 'git.user.name'  // User sees "Author name? [John Doe]" and can change it
}
```

**`setFrom`** - The resolved value is set directly and the question is skipped entirely:

```typescript
{
  type: 'text',
  name: 'year',
  message: 'Copyright year?',
  setFrom: 'date.year'  // Automatically set to "2025", no prompt shown
}
```

#### When to use each

Use `defaultFrom` when:
- The value is a suggestion the user might want to change
- User confirmation is desired

Use `setFrom` when:
- The value should be computed automatically
- No user input is needed (e.g., timestamps, computed fields)
- You want to reduce the number of prompts

#### Combined example

```typescript
const questions = [
  {
    type: 'text',
    name: 'authorName',
    message: 'Author name?',
    defaultFrom: 'git.user.name'  // User can override
  },
  {
    type: 'text',
    name: 'createdAt',
    setFrom: 'date.iso'  // Auto-set, no prompt
  },
  {
    type: 'text',
    name: 'copyrightYear',
    setFrom: 'date.year'  // Auto-set, no prompt
  }
];

// User only sees prompt for authorName
// createdAt and copyrightYear are set automatically
```

### Custom Resolvers

Register your own custom resolvers for project-specific needs:

```typescript
import { registerDefaultResolver } from 'inquirerer';

// Register a resolver for current directory name
registerDefaultResolver('cwd.name', () => {
  return process.cwd().split('/').pop();
});

// Register a resolver for environment variable
registerDefaultResolver('env.user', () => {
  return process.env.USER;
});

// Use in questions
const questions = [
  {
    type: 'text',
    name: 'projectName',
    message: 'Project name?',
    defaultFrom: 'cwd.name',
    default: 'my-project'
  },
  {
    type: 'text',
    name: 'author',
    message: 'Author?',
    defaultFrom: 'env.user'
  }
];
```

### Instance-Specific Resolvers

For isolated resolver registries, use a custom resolver registry per Inquirerer instance:

```typescript
import { DefaultResolverRegistry, Inquirerer } from 'inquirerer';

const customRegistry = new DefaultResolverRegistry();

// Register resolvers specific to this instance
customRegistry.register('app.name', () => 'my-app');
customRegistry.register('app.port', () => 3000);

const prompter = new Inquirerer({
  resolverRegistry: customRegistry  // Use custom registry
});

const questions = [
  {
    type: 'text',
    name: 'appName',
    defaultFrom: 'app.name'
  },
  {
    type: 'number',
    name: 'port',
    defaultFrom: 'app.port'
  }
];

const answers = await prompter.prompt({}, questions);
```

### Resolver Examples

#### System Information

```typescript
import os from 'os';
import { registerDefaultResolver } from 'inquirerer';

registerDefaultResolver('system.hostname', () => os.hostname());
registerDefaultResolver('system.username', () => os.userInfo().username);

const questions = [
  {
    type: 'text',
    name: 'hostname',
    message: 'Hostname?',
    defaultFrom: 'system.hostname'
  }
];
```

#### Conditional Defaults

```typescript
registerDefaultResolver('app.port', () => {
  return process.env.NODE_ENV === 'production' ? 80 : 3000;
});

const questions = [
  {
    type: 'number',
    name: 'port',
    message: 'Port?',
    defaultFrom: 'app.port'
  }
];
```

### Error Handling

Resolvers fail silently by default. If a resolver throws an error or returns `undefined`, inquirerer falls back to the static `default` value (if provided):

```typescript
{
  type: 'text',
  name: 'author',
  defaultFrom: 'git.user.name',  // May fail if git not configured
  default: 'Anonymous',           // Used if resolver fails
  required: true
}
```

For debugging, set `DEBUG=inquirerer` to see resolver errors:

```bash
DEBUG=inquirerer node your-cli.js
```

### Real-World Use Case

```typescript
import { Inquirerer, registerDefaultResolver } from 'inquirerer';

// Register a resolver for current directory name
registerDefaultResolver('cwd.name', () => {
  return process.cwd().split('/').pop();
});

const questions = [
  {
    type: 'text',
    name: 'projectName',
    message: 'Project name?',
    defaultFrom: 'cwd.name',
    required: true
  },
  {
    type: 'text',
    name: 'author',
    message: 'Author?',
    defaultFrom: 'git.user.name',
    required: true
  },
  {
    type: 'text',
    name: 'email',
    message: 'Email?',
    defaultFrom: 'git.user.email',
    required: true
  },
  {
    type: 'text',
    name: 'year',
    message: 'Copyright year?',
    defaultFrom: 'date.year'
  }
];

const prompter = new Inquirerer();
const config = await prompter.prompt({}, questions);
```

With git configured, the prompts will show:

```bash
Project name? (my-project-dir)
Author? (John Doe)
Email? (john@example.com)
Copyright year? (2025)
```

All defaults automatically populated from git config, directory name, and current date!

## CLI Helper

The `CLI` class provides integration with command-line argument parsing:

```typescript
import { CLI, CommandHandler, CLIOptions } from 'inquirerer';

const options: Partial<CLIOptions> = {
  version: 'myapp@1.0.0',
  minimistOpts: {
    alias: {
      v: 'version',
      h: 'help'
    },
    boolean: ['help', 'version'],
    string: ['name', 'output']
  }
};

const handler: CommandHandler = async (argv, prompter) => {
  if (argv.help) {
    console.log('Usage: myapp [options]');
    process.exit(0);
  }

  const answers = await prompter.prompt(argv, questions);
  // Handle answers
};

const cli = new CLI(handler, options);
await cli.run();
```