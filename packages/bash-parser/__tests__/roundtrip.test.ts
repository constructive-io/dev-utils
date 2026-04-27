import { cleanTree } from '../src/clean';
import { deparse } from '../src/deparser';
import { parse } from '../src/parser';

describe('bash-parser round-trip', () => {
  /**
   * Round-trip test helper: parse -> deparse -> parse -> compare cleaned ASTs
   */
  function expectRoundTrip(source: string): void {
    const ast1 = parse(source);
    const deparsed = deparse(ast1);
    const ast2 = parse(deparsed);

    const clean1 = cleanTree(ast1);
    const clean2 = cleanTree(ast2);

    expect(clean2).toEqual(clean1);
  }

  describe('simple commands', () => {
    it('should round-trip simple command', () => {
      expectRoundTrip('echo hello');
    });

    it('should round-trip command with multiple arguments', () => {
      expectRoundTrip('ls -la /tmp');
    });

    it('should round-trip command with quoted string', () => {
      expectRoundTrip('echo "hello world"');
    });

    it('should round-trip command with single quoted string', () => {
      expectRoundTrip("echo 'hello world'");
    });

    it('should round-trip command with variable', () => {
      expectRoundTrip('echo $HOME');
    });

    it('should round-trip command with command substitution', () => {
      expectRoundTrip('echo $(pwd)');
    });
  });

  describe('pipelines', () => {
    it('should round-trip simple pipeline', () => {
      expectRoundTrip('cat file | grep pattern');
    });

    it('should round-trip multi-stage pipeline', () => {
      expectRoundTrip('cat file | grep pattern | sort');
    });
  });

  describe('logical operators', () => {
    it('should round-trip logical AND', () => {
      expectRoundTrip('cmd1 && cmd2');
    });

    it('should round-trip logical OR', () => {
      expectRoundTrip('cmd1 || cmd2');
    });

    it('should round-trip chained logical operators', () => {
      expectRoundTrip('cmd1 && cmd2 || cmd3');
    });
  });

  describe('redirections', () => {
    it('should round-trip output redirect', () => {
      expectRoundTrip('echo hello > file.txt');
    });

    it('should round-trip input redirect', () => {
      expectRoundTrip('cat < input.txt');
    });

    it('should round-trip append redirect', () => {
      expectRoundTrip('echo hello >> file.txt');
    });

    it('should round-trip stderr redirect', () => {
      expectRoundTrip('cmd 2> error.txt');
    });
  });

  describe('assignments', () => {
    it('should round-trip simple assignment', () => {
      expectRoundTrip('VAR=value');
    });

    it('should round-trip assignment with command', () => {
      expectRoundTrip('VAR=value echo $VAR');
    });
  });

  describe('control flow', () => {
    it('should round-trip if statement', () => {
      expectRoundTrip('if test -f file; then echo exists; fi');
    });

    it('should round-trip while loop', () => {
      expectRoundTrip('while true; do echo loop; done');
    });

    it('should round-trip for loop', () => {
      expectRoundTrip('for i in 1 2 3; do echo $i; done');
    });
  });

  describe('grouping', () => {
    it('should round-trip subshell', () => {
      expectRoundTrip('(echo hello)');
    });
  });

  describe('functions', () => {
    it('should round-trip function definition', () => {
      expectRoundTrip('myfunc() { echo hello; }');
    });
  });
});
