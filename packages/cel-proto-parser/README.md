# cel-proto-parser

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
  <br />
    <strong>CEL proto parser</strong>
  <br />
  <br />
  Common Expression Language proto parser and deparser for TypeScript
  <br />
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

CEL (Common Expression Language) proto parser and deparser for TypeScript.

## Overview

This package provides tools for working with CEL (Common Expression Language) Abstract Syntax Trees (ASTs):

1. **Proto Parser**: Parse CEL protobuf definitions to generate TypeScript types
2. **Deparser**: Convert CEL AST back to CEL expression strings
3. **AST Helpers**: Factory functions for constructing CEL AST nodes

## Installation

```bash
npm install cel-proto-parser
```

## Usage

### Deparser

Convert CEL AST to expression strings:

```typescript
import { deparse, Expr } from 'cel-proto-parser';

// Simple expression: x > 5
const expr: Expr = {
  callExpr: {
    function: '_>_',
    args: [
      { identExpr: { name: 'x' } },
      { constExpr: { int64Value: 5 } }
    ]
  }
};

console.log(deparse(expr)); // Output: "x > 5"
```

### Proto Parser

Generate TypeScript types from CEL proto files:

```typescript
import { CelProtoParser } from 'cel-proto-parser';

const parser = new CelProtoParser('path/to/syntax.proto', {
  outDir: './generated',
  types: { enabled: true },
  enums: { enabled: true },
  utils: { astHelpers: { enabled: true } },
  deparser: { enabled: true }
});

parser.write();
```

## CEL Expression Types

The deparser supports all CEL expression types:

- **Constants**: `null`, `true`, `false`, integers, floats, strings, bytes
- **Identifiers**: `request`, `user`, etc.
- **Field Access**: `request.auth.claims`
- **Function Calls**: `size(list)`, `str.startsWith("prefix")`
- **Operators**: `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`, `-` (unary)
- **Ternary**: `condition ? trueExpr : falseExpr`
- **Index Access**: `list[0]`, `map["key"]`
- **Lists**: `[1, 2, 3]`
- **Maps**: `{"key": value}`
- **Message Construction**: `MyMessage{field: value}`
- **Macros**: `has()`, `all()`, `exists()`, etc.

## API Reference

### `deparse(expr: Expr, options?: DeparserOptions): string`

Converts a CEL AST expression to a string.

Options:
- `spaces`: Whether to add spaces around operators (default: `true`)

### `CelProtoParser`

Parses CEL proto files and generates TypeScript code.

Constructor options:
- `outDir`: Output directory for generated files
- `types.enabled`: Generate TypeScript interfaces
- `enums.enabled`: Generate TypeScript enums
- `utils.astHelpers.enabled`: Generate AST helper functions
- `deparser.enabled`: Generate deparser module

## License

MIT
