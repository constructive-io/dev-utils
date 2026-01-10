# nginx-parser

<p align="center" width="100%">
  <img height="120" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/safegres/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/safegres/actions/workflows/ci.yml/badge.svg" />
  </a>
</p>

TypeScript Nginx configuration parser and deparser. Parse nginx.conf files into AST and regenerate configuration from AST.

## Installation

```bash
npm install nginx-parser
```

## Usage

### Parse Nginx Configuration

```typescript
import { parse } from 'nginx-parser';

const config = `
server {
    listen 80;
    server_name example.com;
    
    location / {
        proxy_pass http://backend;
    }
}
`;

const ast = parse(config);
console.log(ast);
```

### Deparse AST to Configuration

```typescript
import { parse, deparse } from 'nginx-parser';

const ast = parse(config);
const output = deparse(ast);
console.log(output);
```

### Round-Trip Testing

```typescript
import { parse, deparse, cleanTree } from 'nginx-parser';

const ast1 = parse(config);
const output = deparse(ast1);
const ast2 = parse(output);

// Compare ASTs without location info
expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
```

## AST Types

### NginxConfig (Root)

```typescript
interface NginxConfig {
  type: 'NginxConfig';
  body: Statement[];
}
```

### Directive

```typescript
interface Directive {
  type: 'Directive';
  name: string;
  args: string[];
}
```

### Block Types

- `ServerBlock` - Virtual server configuration
- `LocationBlock` - URI handling with optional modifiers (=, ~, ~*, ^~, @)
- `HttpBlock` - HTTP context
- `EventsBlock` - Events context
- `StreamBlock` - TCP/UDP proxying
- `UpstreamBlock` - Backend server groups
- `MapBlock` - Variable mapping
- `IfBlock` - Conditional logic
- `TypesBlock` - MIME type definitions
- `LimitExceptBlock` - HTTP method restrictions

### Location Modifiers

```typescript
interface LocationBlock {
  type: 'LocationBlock';
  modifier?: '=' | '~' | '~*' | '^~' | '@';
  path: string;
  body: Statement[];
}
```

- `=` - Exact match
- `~` - Case-sensitive regex
- `~*` - Case-insensitive regex
- `^~` - Prefix match (no regex check)
- `@` - Named location

## Deparse Options

```typescript
interface DeparseOptions {
  indent?: string;   // Default: '    ' (4 spaces)
  newline?: string;  // Default: '\n'
}

const output = deparse(ast, { indent: '  ' });
```

## Utilities

### cleanTree

Remove location/range information from AST for comparison:

```typescript
import { cleanTree } from 'nginx-parser';

const cleaned = cleanTree(ast);
```

### astEqual

Compare two ASTs ignoring location info:

```typescript
import { astEqual } from 'nginx-parser';

if (astEqual(ast1, ast2)) {
  console.log('ASTs are equivalent');
}
```

## License

MIT
