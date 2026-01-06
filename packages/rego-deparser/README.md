# rego-deparser

Rego (OPA policy language) AST types and deparser for TypeScript.

This package provides TypeScript types for OPA's Rego Abstract Syntax Tree (AST) and a deparser that converts AST back to valid Rego source code.

## Installation

```bash
npm install rego-deparser
```

## Usage

```typescript
import { deparse, Module, TermType } from 'rego-deparser';

// Create a Rego module AST
const module: Module = {
  package: {
    path: [{ type: TermType.VAR, value: 'example' }]
  },
  rules: [
    {
      default: true,
      head: {
        name: 'allow',
        value: { type: TermType.BOOLEAN, value: false }
      }
    },
    {
      head: {
        name: 'allow',
        value: { type: TermType.BOOLEAN, value: true }
      },
      body: [
        {
          terms: [
            { type: TermType.VAR, value: 'equal' },
            {
              type: TermType.REF,
              value: [
                { type: TermType.VAR, value: 'input' },
                { type: TermType.STRING, value: 'user' }
              ]
            },
            { type: TermType.STRING, value: 'admin' }
          ]
        }
      ]
    }
  ]
};

// Convert AST to Rego source code
const rego = deparse(module);
console.log(rego);
// Output:
// package example
//
// default allow = false
// allow = true if {
//   input.user == "admin"
// }
```

## API

### `deparse(module: Module, options?: DeparserOptions): string`

Converts a Rego Module AST to Rego source code.

#### Options

- `indent`: String to use for indentation (default: `'\t'`)
- `newline`: String to use for newlines (default: `'\n'`)
- `spaces`: Whether to add spaces around operators (default: `true`)

### Types

The package exports TypeScript types for all Rego AST node types:

- `Module` - A Rego module (policy file)
- `Package` - Package declaration
- `Import` - Import statement
- `Rule` - A Rego rule
- `Head` - Rule head
- `Body` - Rule body (array of expressions)
- `Expr` - An expression in a rule body
- `Term` - A term in an expression
- `With` - With modifier
- `Else` - Else clause for rules

### Term Types

The `TermType` constant provides all supported term types:

- `NULL` - null value
- `BOOLEAN` - boolean value
- `NUMBER` - numeric value
- `STRING` - string value
- `VAR` - variable
- `REF` - reference (e.g., `data.users`)
- `CALL` - function call
- `ARRAY` - array literal
- `SET` - set literal
- `OBJECT` - object literal
- `ARRAY_COMPREHENSION` - array comprehension
- `SET_COMPREHENSION` - set comprehension
- `OBJECT_COMPREHENSION` - object comprehension

### Operators

The package supports all Rego infix operators:

- Comparison: `==`, `!=`, `<`, `<=`, `>`, `>=`
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Logical: `&`, `|`
- Assignment: `:=` (local assignment)
- Unification: `=` (unification)

## Obtaining Rego AST

The Rego AST can be obtained from OPA in several ways:

1. **OPA REST API**: `POST /v1/compile`
2. **OPA builtin**: `rego.parse_module(filename, rego_text)`
3. **OPA CLI**: `opa parse --format json policy.rego`

## License

MIT
