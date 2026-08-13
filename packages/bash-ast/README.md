# bash-ast

<p align="center" width="100%">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
</p>

Bash/shell command parser and deparser for JavaScript/TypeScript.

## Installation

```bash
npm install bash-ast
```

## Usage

### Parsing

```typescript
import { parse } from 'bash-ast';

const source = 'echo hello | grep h && ls -la';
const ast = parse(source);
console.log(JSON.stringify(ast, null, 2));
```

#### Options

```typescript
parse(source, {
  // keep comments as `Comment` nodes instead of dropping them (default: false)
  keepComments: true,
  // hard wall-clock budget; exceeding it throws instead of running unbounded
  timeoutMs: 5000
});
```

### Deparsing

```typescript
import { parse, deparse } from 'bash-ast';

const source = 'echo hello';
const ast = parse(source);
const output = deparse(ast);
console.log(output); // echo hello
```

### AST Comparison

```typescript
import { parse, cleanTree } from 'bash-ast';

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
- Here-documents (`<<EOF`, `<<-EOF`, `<<'EOF'`) — the body is opaque text, never re-lexed as shell
- File descriptor redirects (`2>&1`)

### Other
- Asynchronous commands (`cmd &`)
- Comments (with `keepComments`)
- Process substitution (`<(cmd)`, `>(cmd)`)
- Variable assignments (`VAR=value`)
- Function definitions
- Quoted strings (single and double)
- Variable expansion (`$VAR`, `${VAR}`)
- Command substitution (`$(cmd)`, `` `cmd` ``)
- Arithmetic expansion (`$((expr))`)

## Round-tripping

`deparse(parse(x))` is meant to be *semantically* equivalent to `x`, not
character-identical: layout and optional whitespace are normalized. The
properties the test suite enforces over a corpus
of real GitHub Actions `run:` blocks (`__fixtures__/workflows`) are:

- `parse(deparse(parse(x)))` equals `parse(x)` once positions are stripped
  (`cleanTree`);
- `deparse` is idempotent from the second pass on;
- the emitted text is accepted by `bash -n`.

Grouping is what makes this safe: a brace group or subshell stays a single
command through pipelines and `&&`/`||`, `&` stays on the command it
backgrounds, and `NAME=value` is an assignment only in assignment position (a
command prefix, or an operand of `export`/`local`/`declare`/`readonly`/`typeset`)
— elsewhere it is an ordinary argument, as in `psql --set ON_ERROR_STOP=1`.

## License

MIT
