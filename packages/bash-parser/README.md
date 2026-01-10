# bash-parser

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/Safegres/brand/refs/heads/main/safegres.svg" />
</p>

Bash/shell command parser and deparser for JavaScript/TypeScript.

## Installation

```bash
npm install bash-parser
```

## Usage

### Parsing

```typescript
import { parse } from 'bash-parser';

const source = 'echo hello | grep h && ls -la';
const ast = parse(source);
console.log(JSON.stringify(ast, null, 2));
```

### Deparsing

```typescript
import { parse, deparse } from 'bash-parser';

const source = 'echo hello';
const ast = parse(source);
const output = deparse(ast);
console.log(output); // echo hello
```

### AST Comparison

```typescript
import { parse, cleanTree } from 'bash-parser';

const ast1 = parse('echo hello');
const ast2 = parse('echo hello');

const clean1 = cleanTree(ast1);
const clean2 = cleanTree(ast2);

// Compare ASTs without position information
console.log(JSON.stringify(clean1) === JSON.stringify(clean2)); // true
```

## Supported Constructs

### Commands
- Simple commands with arguments
- Pipelines (`cmd1 | cmd2`)
- Logical operators (`&&`, `||`)
- Subshells (`(cmd)`)
- Brace groups (`{ cmd; }`)

### Control Flow
- if/then/else/elif/fi
- while/do/done
- until/do/done
- for/in/do/done
- case/esac

### Redirections
- Input (`<`)
- Output (`>`, `>>`)
- Here strings (`<<<`)
- File descriptor redirects (`2>&1`)

### Other
- Variable assignments (`VAR=value`)
- Function definitions
- Quoted strings (single and double)
- Variable expansion (`$VAR`, `${VAR}`)
- Command substitution (`$(cmd)`, `` `cmd` ``)
- Arithmetic expansion (`$((expr))`)

## License

MIT
