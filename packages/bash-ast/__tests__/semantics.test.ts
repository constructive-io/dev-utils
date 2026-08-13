import { execFileSync } from 'child_process';

import { cleanTree, deparse, parse } from '../src';
import { BraceGroup, Pipeline, Script, SimpleCommand } from '../src/types';

const TIMEOUT_MS = 5000;

function ast(source: string): Script {
  return parse(source, { keepComments: true, timeoutMs: TIMEOUT_MS });
}

function roundTrip(source: string): string {
  const first = ast(source);
  const emitted = deparse(first);
  const second = ast(emitted);

  expect(cleanTree(second)).toEqual(cleanTree(first));
  expect(deparse(second)).toEqual(emitted);

  return emitted;
}

/**
 * Run a script and its deparsed form, and require identical behaviour. This is
 * the property that matters: the AST is only a means to it.
 */
function expectSameBehaviour(source: string): void {
  const emitted = roundTrip(source);

  const run = (script: string) =>
    execFileSync('bash', ['-c', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  expect(run(emitted)).toEqual(run(source));
}

describe('here-documents', () => {
  it('treats the body as opaque text rather than shell syntax', () => {
    const script = ast('cat <<EOF\n|\nEOF\n');
    const command = script.commands[0] as SimpleCommand;
    const redirect = command.suffix?.find(item => item.type === 'Redirect');

    expect(redirect).toMatchObject({
      op: '<<',
      heredoc: { delimiter: 'EOF', content: '|\n' }
    });
  });

  it('round trips a body full of shell metacharacters', () => {
    expectSameBehaviour('cat <<EOF\n| && ; ) } done fi\nEOF\n');
  });

  it('keeps a quoted delimiter unexpanded', () => {
    const emitted = roundTrip("cat <<'EOF'\n$HOME\nEOF\n");
    expect(emitted).toContain("<<'EOF'");
    expectSameBehaviour("cat <<'EOF'\n$HOME\nEOF\n");
  });

  it('keeps the body attached when the redirection is not last', () => {
    expectSameBehaviour('cat <<EOF | wc -l\na\nb\nEOF\n');
  });

  it('does not hang on an unterminated body', () => {
    expect(() => ast('cat <<EOF\nnever closed\n')).not.toThrow();
  });

  it('fails loudly instead of running forever when the budget is spent', () => {
    expect(() => parse('echo hi\n', { timeoutMs: -1 })).toThrow(/exceeded/);
  });
});

describe('asynchronous commands', () => {
  it('keeps `&`, which is what stops the command from blocking the script', () => {
    const emitted = roundTrip('kubectl proxy --port=8001 &\nsleep 3\n');
    expect(emitted).toEqual('kubectl proxy --port=8001 &\nsleep 3');
    expect(ast(emitted).commands[0].async).toBe(true);
  });

  it('marks the command, not the list', () => {
    const script = ast('a &\nb\n');
    expect(script.commands.map(command => command.async)).toEqual([true, undefined]);
  });

  it('keeps `&` on a subshell and on a pipeline', () => {
    expect(roundTrip('(cd dir && make) &\n')).toEqual('(cd dir && make) &');
    expect(roundTrip('a | b &\n')).toEqual('a | b &');
  });
});

describe('grouping', () => {
  it('keeps a brace group after `||` grouped', () => {
    const source = '[ -n "$id" ] || { echo "nothing to compare"; exit 0; }\necho reached\n';
    const emitted = roundTrip(source);

    expect(emitted).toContain('|| { echo "nothing to compare"; exit 0; }');
    expectSameBehaviour(source);
  });

  it('keeps a brace group as one command in a pipeline', () => {
    const source = '{\n  echo a\n  echo b\n} | tee /dev/null\n';
    const script = ast(source);
    const pipeline = script.commands[0] as Pipeline;

    expect(pipeline.type).toBe('Pipeline');
    expect(pipeline.commands[0].type).toBe('BraceGroup');
    expect((pipeline.commands[0] as BraceGroup).list.commands).toHaveLength(2);

    expectSameBehaviour(source);
  });

  it('keeps redirections attached to the group', () => {
    expect(roundTrip('{ echo a; echo b; } > /dev/null\n')).toEqual('{ echo a; echo b; } >/dev/null');
  });

  it('keeps a subshell grouped', () => {
    expectSameBehaviour('(cd /tmp && pwd) | cat\n');
  });
});

describe('assignment position', () => {
  it('leaves `NAME=value` as an argument when it is not in assignment position', () => {
    const script = ast('psql --dbname postgres \\\n  --set ON_ERROR_STOP=1 \\\n  -f file.sql\n');

    expect(script.commands).toHaveLength(1);

    const command = script.commands[0] as SimpleCommand;
    expect(command.name?.text).toBe('psql');
    expect(command.suffix?.map(item => (item.type === 'Word' ? item.text : item.type)))
      .toEqual(['--dbname', 'postgres', '--set', 'ON_ERROR_STOP=1', '-f', 'file.sql']);
  });

  it('parses an assignment inside a function body', () => {
    const emitted = roundTrip('check() {\n  local label="$1"\n}\n');
    expect(emitted).toEqual('check() { local label="$1"; }');
  });

  it('treats operands of the declaration builtins as assignments', () => {
    const command = ast('export FOO=bar BAZ=qux\n').commands[0] as SimpleCommand;
    expect(command.suffix?.map(item => item.type)).toEqual(['AssignmentWord', 'AssignmentWord']);
  });

  it('keeps an assignment prefix on the command it applies to', () => {
    const command = ast('FOO=bar run it\n').commands[0] as SimpleCommand;
    expect(command.prefix?.map(item => item.text)).toEqual(['FOO=bar']);
    expect(command.name?.text).toBe('run');
  });

  it('keeps an assignment at the start of a case item body', () => {
    expectSameBehaviour('case x in\n  x)\n    mode=full\n    echo "$mode"\n    ;;\nesac\n');
  });
});

describe('words the lexer used to split', () => {
  it('keeps a process substitution whole', () => {
    const command = ast('diff <(echo a) <(echo b)\n').commands[0] as SimpleCommand;
    expect(command.suffix?.map(item => (item.type === 'Word' ? item.text : item.type)))
      .toEqual(['<(echo a)', '<(echo b)']);

    expectSameBehaviour('diff <(echo a) <(echo b) || true\n');
  });

  it('keeps a braced argument whole', () => {
    const command = ast('kubectl get ns -o jsonpath={.metadata.labels}\n').commands[0] as SimpleCommand;
    expect(command.suffix?.map(item => (item.type === 'Word' ? item.text : item.type)))
      .toEqual(['get', 'ns', '-o', 'jsonpath={.metadata.labels}']);
  });
});

describe('comments', () => {
  it('drops comments by default, preserving the old behaviour', () => {
    expect(parse('# why this exists\necho hi\n').commands.map(command => command.type))
      .toEqual(['SimpleCommand']);
  });

  it('retains comments when asked', () => {
    const emitted = roundTrip('# why this exists\necho hi\n');
    expect(emitted).toEqual('# why this exists\necho hi');
  });

  it('retains a comment inside a body', () => {
    const emitted = roundTrip('if true; then\n  # explain\n  echo hi\nfi\n');
    expect(emitted).toEqual('if true; then\n# explain\necho hi\nfi');
  });
});
