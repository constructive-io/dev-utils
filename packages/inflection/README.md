# inflekt

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
  <br />
    <strong>smart pluralization and inflection for the modern web</strong>
  <br />
  <br />
  Inflection utilities for pluralization and singularization with PostGraphile-compatible Latin suffix handling
  <br />
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

## Installation

```bash
npm install inflekt
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
  camelize,
  underscore,
  toFieldName,
  toQueryName,
} from 'inflekt';

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

// First character case transformations
lcFirst('UserProfile');   // 'userProfile'
ucFirst('userProfile');   // 'UserProfile'

// Snake case / camel case conversions
camelize('user_profile');       // 'UserProfile'
camelize('user_profile', true); // 'userProfile'
underscore('UserProfile');      // 'user_profile'

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
- `camelize(str, lowFirstLetter?)` - Convert snake_case to PascalCase (or camelCase if lowFirstLetter is true)
- `underscore(str)` - Convert PascalCase/camelCase to snake_case
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
