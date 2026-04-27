# docker-parser

<p align="center" width="100%">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
</p>

Dockerfile parser and deparser for JavaScript/TypeScript.

## Installation

```bash
npm install docker-parser
```

## Usage

### Parsing

```typescript
import { parse } from 'docker-parser';

const source = `
FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
`;

const ast = parse(source);
console.log(JSON.stringify(ast, null, 2));
```

### Deparsing

```typescript
import { parse, deparse } from 'docker-parser';

const source = 'FROM node:18-alpine';
const ast = parse(source);
const output = deparse(ast);
console.log(output); // FROM node:18-alpine
```

### AST Comparison

```typescript
import { parse, cleanTree } from 'docker-parser';

const ast1 = parse('FROM node:18');
const ast2 = parse('FROM node:18');

const clean1 = cleanTree(ast1);
const clean2 = cleanTree(ast2);

// Compare ASTs without position information
console.log(JSON.stringify(clean1) === JSON.stringify(clean2)); // true
```

## Supported Instructions

- FROM (with platform, AS alias, digest)
- RUN (shell and exec form, with mount flags)
- CMD (shell and exec form)
- ENTRYPOINT (shell and exec form)
- COPY (with --from, --chown, --chmod, --link)
- ADD (with --chown, --chmod, --checksum)
- ENV
- ARG
- WORKDIR
- USER
- EXPOSE
- VOLUME
- LABEL
- SHELL
- HEALTHCHECK
- STOPSIGNAL
- ONBUILD
- MAINTAINER (deprecated)

## License

MIT
