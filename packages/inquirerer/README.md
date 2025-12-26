# inquirerer

<p align="center" width="100%">
    <img height="90" src="https://raw.githubusercontent.com/hyperweb-io/dev-utils/refs/heads/main/docs/img/genomic.svg" />
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

> **Note:** This package has been renamed to [`genomic`](https://www.npmjs.com/package/genomic). Please migrate to `genomic` for the latest features and updates.

A powerful, TypeScript-first library for building beautiful command-line interfaces. Create interactive CLI tools with ease using intuitive prompts, validation, and rich user experiences.

## Migration to genomic

This package is now maintained as `genomic`. To migrate:

```bash
npm uninstall inquirerer
npm install genomic
```

Then update your imports:

```typescript
// Before
import { Inquirerer, InquirererOptions } from 'inquirerer';

// After
import { Prompter, PrompterOptions } from 'genomic';
```

The API is the same, only the class names have changed:
- `Inquirerer` -> `Prompter`
- `InquirererOptions` -> `PrompterOptions`

## Installation

```bash
npm install inquirerer
```

## Features

- **CLI Builder** - Build command-line utilities fast
- **Multiple Question Types** - Support for text, autocomplete, checkbox, and confirm questions
- **Non-Interactive Mode** - Fallback to defaults for CI/CD environments, great for testing
- **Smart Validation** - Built-in pattern matching, custom validators, and sanitizers
- **Conditional Logic** - Show/hide questions based on previous answers
- **Interactive UX** - Fuzzy search, keyboard navigation, and visual feedback
- **Dynamic Defaults** - Auto-populate defaults from git config, date/time, or custom resolvers

## Quick Start

```typescript
import { Inquirerer } from 'inquirerer';

const inquirerer = new Inquirerer();

const answers = await inquirerer.prompt({}, [
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

const answers = await inquirerer.prompt<UserConfig>({}, questions);
// answers is typed as UserConfig
```

### Question Types

All questions support these base properties:

```typescript
interface BaseQuestion {
  name: string;           // Property name in result object
  type: string;           // Question type
  _?: boolean;            // Mark as positional argument (can be passed without --name flag)
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
const inquirerer = new Inquirerer({
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

const inquirerer = new Inquirerer(options);
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

## Full Documentation

For complete documentation, examples, and advanced usage, please see the [`genomic` package documentation](https://www.npmjs.com/package/genomic).

## License

MIT
