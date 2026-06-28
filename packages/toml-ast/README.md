# toml-ast

<p align="center" width="100%">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
</p>

TypeScript TOML parser and deparser. Parse TOML files into AST and regenerate configuration from AST.

## Installation

```bash
npm install toml-ast
```

## Usage

### Parse TOML Configuration

```typescript
import { parse } from 'toml-ast';

const config = `
[server]
host = "localhost"
port = 8080

[database]
enabled = true
ports = [8001, 8001, 8002]
`;

const ast = parse(config);
console.log(ast);
```

### Deparse AST to TOML

```typescript
import { parse, deparse } from 'toml-ast';

const ast = parse(config);
const output = deparse(ast);
console.log(output);
```

### Build AST Programmatically

```typescript
import { deparse } from 'toml-ast';
import type { TomlDocument } from 'toml-ast';

const ast: TomlDocument = {
  type: 'TomlDocument',
  body: [
    {
      type: 'Table',
      key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'server', style: 'bare' }] },
      body: [
        {
          type: 'KeyValue',
          key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'host', style: 'bare' }] },
          value: { type: 'StringValue', value: 'localhost', style: 'basic' },
        },
        {
          type: 'KeyValue',
          key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'port', style: 'bare' }] },
          value: { type: 'IntegerValue', value: 8080, raw: '8080' },
        },
      ],
    },
  ],
};

console.log(deparse(ast));
// [server]
// host = "localhost"
// port = 8080
```

### Round-Trip Testing

```typescript
import { parse, deparse, cleanTree } from 'toml-ast';

const ast1 = parse(config);
const output = deparse(ast1);
const ast2 = parse(output);

// Compare ASTs without location info
expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
```

## AST Types

### TomlDocument (Root)

```typescript
interface TomlDocument {
  type: 'TomlDocument';
  body: RootItem[];
}
```

### KeyValue

```typescript
interface KeyValue {
  type: 'KeyValue';
  key: Key;
  value: Value;
}
```

### Key

```typescript
interface Key {
  type: 'Key';
  parts: KeyPart[];  // dotted keys have multiple parts
}

interface KeyPart {
  type: 'KeyPart';
  value: string;
  style: 'bare' | 'basic' | 'literal';
}
```

### Value Types

- `StringValue` - basic `"..."`, literal `'...'`, multiline `"""..."""`, `'''...'''`
- `IntegerValue` - decimal, hex (`0x`), octal (`0o`), binary (`0b`), underscored
- `FloatValue` - decimal, exponent, `inf`, `-inf`, `nan`
- `BooleanValue` - `true`, `false`
- `DateTimeValue` - offset datetime, local datetime, local date, local time
- `ArrayValue` - `[1, 2, 3]`
- `InlineTable` - `{ key = "value" }`

### Table

```typescript
interface Table {
  type: 'Table';
  key: Key;
  body: TableItem[];
}
```

### ArrayOfTables

```typescript
interface ArrayOfTables {
  type: 'ArrayOfTables';
  key: Key;
  body: TableItem[];
}
```

### Comment

```typescript
interface Comment {
  type: 'Comment';
  value: string;
}
```

## Deparse Options

```typescript
interface DeparseOptions {
  indent?: string;   // Default: '  ' (2 spaces)
  newline?: string;  // Default: '\n'
}

const output = deparse(ast, { indent: '    ' });
```

## Utilities

### cleanTree

Remove range/location information from AST for comparison:

```typescript
import { cleanTree } from 'toml-ast';

const cleaned = cleanTree(ast);
```

### astEqual

Compare two ASTs ignoring location info:

```typescript
import { astEqual } from 'toml-ast';

if (astEqual(ast1, ast2)) {
  console.log('ASTs are equivalent');
}
```

## License

MIT
