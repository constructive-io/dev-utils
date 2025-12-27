# komoji ✨

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
  <br />
    <strong>the tiny case transformer</strong>
  <br />
  <br />
  Effortlessly transform strings between naming conventions
  <br />
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

## Why komoji?

Named after the Japanese word 小文字 (komoji, "lowercase letters"), komoji is your friendly companion for working with naming conventions. It's tiny, focused, and does one thing exceptionally well: transforming strings between different cases with zero dependencies.

Perfect for:
- 🔄 Converting API responses to JavaScript conventions
- 🎨 Generating code from schemas and templates
- 🛠️ Building developer tools and CLI utilities
- 📦 Processing configuration files across formats

## Install

```sh
npm install komoji
```

## Usage

### Transform to PascalCase

```typescript
import { toPascalCase } from 'komoji';

toPascalCase('hello-world');      // HelloWorld
toPascalCase('user_name');        // UserName
toPascalCase('api response');     // ApiResponse
toPascalCase('my-component_v2');  // MyComponentV2
```

### Transform to camelCase

```typescript
import { toCamelCase } from 'komoji';

toCamelCase('hello-world');       // helloWorld
toCamelCase('user_name');         // userName
toCamelCase('api-response-data'); // apiResponseData

// Strip leading non-alphabetic characters
toCamelCase('__private_field', true);  // privateField
toCamelCase('123-invalid', true);      // invalid
```

### Transform to snake_case

```typescript
import { toSnakeCase } from 'komoji';

toSnakeCase('helloWorld');        // hello_world
toSnakeCase('UserName');          // user_name
toSnakeCase('api-response-data'); // api_response_data
toSnakeCase('myComponentV2');     // my_component_v2
toSnakeCase('HTTPSConnection');   // https_connection
```

### Transform to kebab-case

```typescript
import { toKebabCase } from 'komoji';

toKebabCase('helloWorld');        // hello-world
toKebabCase('UserName');          // user-name
toKebabCase('api_response_data'); // api-response-data
toKebabCase('myComponentV2');     // my-component-v2
toKebabCase('HTTPSConnection');   // https-connection
```

### Transform to CONSTANT_CASE

```typescript
import { toConstantCase } from 'komoji';

toConstantCase('helloWorld');        // HELLO_WORLD
toConstantCase('UserName');          // USER_NAME
toConstantCase('api-response-data'); // API_RESPONSE_DATA
toConstantCase('myComponentV2');     // MY_COMPONENT_V2
toConstantCase('HTTPSConnection');   // HTTPS_CONNECTION
```

### Validate Identifiers

```typescript
import { isValidIdentifier, isValidIdentifierCamelized } from 'komoji';

// Check if string is a valid JavaScript identifier
isValidIdentifier('myVar');        // true
isValidIdentifier('my-var');       // false
isValidIdentifier('123abc');       // false
isValidIdentifier('_private');     // true

// Check if string can be camelized into valid identifier
isValidIdentifierCamelized('my-var');   // true (can become myVar)
isValidIdentifierCamelized('valid_id'); // true
isValidIdentifierCamelized('-invalid'); // false (starts with hyphen)
```

## API

### Case Transformation Functions

#### `toPascalCase(str: string): string`

Converts a string to PascalCase by capitalizing the first letter of each word and removing separators.

**Supported separators:** hyphens (`-`), underscores (`_`), spaces (` `)

#### `toCamelCase(key: string, stripLeadingNonAlphabetChars?: boolean): string`

Converts a string to camelCase with an optional flag to strip leading non-alphabetic characters.

**Parameters:**
- `key` - The string to transform
- `stripLeadingNonAlphabetChars` - Remove leading non-alphabetic characters (default: `false`)

#### `toSnakeCase(str: string): string`

Converts a string to snake_case. Handles camelCase, PascalCase, kebab-case, and space-separated strings. Properly inserts underscores between words and before numbers.

#### `toKebabCase(str: string): string`

Converts a string to kebab-case. Handles camelCase, PascalCase, snake_case, and space-separated strings. Properly inserts hyphens between words and before numbers.

#### `toConstantCase(str: string): string`

Converts a string to CONSTANT_CASE (also known as SCREAMING_SNAKE_CASE). Perfect for environment variables and constants. Handles all common case formats and properly separates words and numbers.

### Validation Functions

#### `isValidIdentifier(key: string): boolean`

Checks if a string is a valid JavaScript identifier (follows standard naming rules).

#### `isValidIdentifierCamelized(key: string): boolean`

Checks if a string can be transformed into a valid JavaScript identifier (allows internal hyphens that will be removed during camelization).

## Design Philosophy

komoji embraces simplicity:
- 🎯 Zero dependencies
- 🪶 Tiny footprint
- 🚀 Fast and predictable
- 💎 Pure functions
- 📖 Clear, focused API
