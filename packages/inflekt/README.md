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
  toCamelCase,
  toPascalCase,
  toScreamingSnake,
  underscore,
  toFieldName,
  toQueryName,
  inflektTree,
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

// Case conversions (handles underscores, hyphens, and camelCase boundaries)
toCamelCase('user_profile');    // 'userProfile'
toCamelCase('user-profile');    // 'userProfile'
toPascalCase('user_profile');   // 'UserProfile'
toPascalCase('user-profile');   // 'UserProfile'
toScreamingSnake('userProfile'); // 'USER_PROFILE'
underscore('UserProfile');      // 'user_profile'

// GraphQL naming helpers
toFieldName('Users');     // 'user'
toQueryName('User');      // 'users'

// Deep object key transformation
const apiResponse = {
  user_name: 'John',
  order_items: [{ item_id: 1, product_name: 'Widget' }]
};
inflektTree(apiResponse, toCamelCase);
// Result: { userName: 'John', orderItems: [{ itemId: 1, productName: 'Widget' }] }
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
- `toCamelCase(str)` - Convert to camelCase (handles underscores, hyphens, and PascalCase input)
- `toPascalCase(str)` - Convert to PascalCase (handles underscores, hyphens, and camelCase input)
- `toScreamingSnake(str)` - Convert to SCREAMING_SNAKE_CASE
- `underscore(str)` - Convert PascalCase/camelCase to snake_case
- `fixCapitalisedPlural(str)` - Fix capitalized S after numbers (e.g., `Table1S` -> `Table1s`)

### Naming Helpers

- `toFieldName(pluralTypeName)` - Convert plural PascalCase to singular camelCase field name
- `toQueryName(singularTypeName)` - Convert singular PascalCase to plural camelCase query name

### Deep Object Transformation

- `inflektTree(obj, transformer, options?)` - Recursively transform all property names in an object tree

## Deep Object Key Transformation

The `inflektTree` function recursively transforms all property names in an object tree using any transformer function. This is useful for converting API responses between naming conventions.

### Basic Usage

```typescript
// Convert snake_case API response to camelCase for frontend
const apiResponse = {
  user_name: 'John',
  user_profile: {
    profile_image: 'https://example.com/avatar.jpg',
    account_status: 'active'
  },
  order_items: [
    { item_id: 1, item_name: 'Product A' },
    { item_id: 2, item_name: 'Product B' }
  ]
};

const result = inflektTree(apiResponse, toCamelCase);
// Result:
// {
//   userName: 'John',
//   userProfile: {
//     profileImage: 'https://example.com/avatar.jpg',
//     accountStatus: 'active'
//   },
//   orderItems: [
//     { itemId: 1, itemName: 'Product A' },
//     { itemId: 2, itemName: 'Product B' }
//   ]
// }

// Convert camelCase frontend data to snake_case for API
const frontendData = { userName: 'John', orderItems: [{ itemId: 1 }] };
const payload = inflektTree(frontendData, underscore);
// Result: { user_name: 'John', order_items: [{ item_id: 1 }] }
```

### Skipping Keys

Use the `skip` option to preserve certain keys:

```typescript
// Skip keys starting with underscore
const input = {
  user_name: 'John',
  _private_field: 'secret',
  _metadata: { _internal: true }
};

const result = inflektTree(input, toCamelCase, {
  skip: (key) => key.startsWith('_')
});
// Result: { userName: 'John', _private_field: 'secret', _metadata: { _internal: true } }

// Skip specific keys
const result2 = inflektTree(input, toCamelCase, {
  skip: (key) => key === 'created_at' || key === 'updated_at'
});

// Skip based on path depth (only transform top 2 levels)
const result3 = inflektTree(deepObject, toCamelCase, {
  skip: (key, path) => path.length > 1
});
```

### Features

- Handles nested objects and arrays of any depth
- Preserves `Date` objects (clones them)
- Preserves `null` and `undefined` values
- Returns primitives unchanged
- Works with any transformer function

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
