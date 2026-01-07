# @interweb/inflection

Inflection utilities for pluralization and singularization with PostGraphile-compatible Latin suffix handling.

## Installation

```bash
npm install @interweb/inflection
```

## Usage

```typescript
import {
  singularize,
  pluralize,
  singularizeLast,
  pluralizeLast,
  distinctPluralize,
  lcFirst,
  ucFirst,
  toFieldName,
  toQueryName,
} from '@interweb/inflection';

// Basic singularization/pluralization
singularize('Users');     // 'User'
pluralize('User');        // 'Users'

// Latin suffix handling (PostGraphile-compatible)
singularize('Schemata');  // 'Schema' (not 'Schematum')
singularize('Criteria');  // 'Criterion'
singularize('Media');     // 'Medium'

// Compound word handling (only transforms last word)
singularizeLast('UserProfiles');  // 'UserProfile'
pluralizeLast('UserProfile');     // 'UserProfiles'

// Case transformations
lcFirst('UserProfile');   // 'userProfile'
ucFirst('userProfile');   // 'UserProfile'

// GraphQL naming helpers
toFieldName('Users');     // 'user'
toQueryName('User');      // 'users'
```

## API

### Pluralization

- `singularize(word)` - Convert a word to singular form with Latin suffix handling
- `pluralize(word)` - Convert a word to plural form
- `singularizeLast(str)` - Singularize only the last word in a compound name
- `pluralizeLast(str)` - Pluralize only the last word in a compound name
- `distinctPluralize(str)` - Create a distinct plural form (handles cases where singular === plural)
- `distinctPluralizeLast(str)` - Distinctly pluralize only the last word

### Case Transformations

- `lcFirst(str)` - Convert first character to lowercase (PascalCase to camelCase)
- `ucFirst(str)` - Convert first character to uppercase (camelCase to PascalCase)
- `fixCapitalisedPlural(str)` - Fix capitalized S after numbers (e.g., `Table1S` -> `Table1s`)

### Naming Helpers

- `toFieldName(pluralTypeName)` - Convert plural PascalCase to singular camelCase field name
- `toQueryName(singularTypeName)` - Convert singular PascalCase to plural camelCase query name

## Latin Suffix Overrides

This library handles Latin plural suffixes differently than the standard `inflection` package to match PostGraphile's behavior:

| Plural | Singular |
|--------|----------|
| schemata | schema |
| criteria | criterion |
| phenomena | phenomenon |
| media | medium |
| memoranda | memorandum |
| strata | stratum |
| curricula | curriculum |
| data | datum |

## License

MIT
