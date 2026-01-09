import { deparse } from '../src/deparser';
import { parse } from '../src/parser';

describe('bash-deparser', () => {
  describe('deparse', () => {
    it('should deparse simple command', () => {
      const ast = parse('echo hello');
      const result = deparse(ast);
      expect(result).toBe('echo hello');
    });

    it('should deparse command with multiple arguments', () => {
      const ast = parse('ls -la /tmp');
      const result = deparse(ast);
      expect(result).toBe('ls -la /tmp');
    });

    it('should deparse pipeline', () => {
      const ast = parse('cat file | grep pattern');
      const result = deparse(ast);
      expect(result).toBe('cat file | grep pattern');
    });

    it('should deparse logical AND', () => {
      const ast = parse('cmd1 && cmd2');
      const result = deparse(ast);
      expect(result).toBe('cmd1 && cmd2');
    });

    it('should deparse logical OR', () => {
      const ast = parse('cmd1 || cmd2');
      const result = deparse(ast);
      expect(result).toBe('cmd1 || cmd2');
    });

    it('should deparse redirect output', () => {
      const ast = parse('echo hello > file.txt');
      const result = deparse(ast);
      expect(result).toBe('echo hello >file.txt');
    });

    it('should deparse redirect input', () => {
      const ast = parse('cat < input.txt');
      const result = deparse(ast);
      expect(result).toBe('cat <input.txt');
    });

    it('should deparse append redirect', () => {
      const ast = parse('echo hello >> file.txt');
      const result = deparse(ast);
      expect(result).toBe('echo hello >>file.txt');
    });

    it('should deparse assignment', () => {
      const ast = parse('VAR=value');
      const result = deparse(ast);
      expect(result).toBe('VAR=value');
    });

    it('should deparse assignment with command', () => {
      const ast = parse('VAR=value echo $VAR');
      const result = deparse(ast);
      expect(result).toBe('VAR=value echo $VAR');
    });

    it('should deparse subshell', () => {
      const ast = parse('(echo hello)');
      const result = deparse(ast);
      expect(result).toBe('(echo hello)');
    });

    it('should deparse if statement', () => {
      const ast = parse('if test -f file; then echo exists; fi');
      const result = deparse(ast);
      expect(result).toContain('if');
      expect(result).toContain('then');
      expect(result).toContain('fi');
    });

    it('should deparse while loop', () => {
      const ast = parse('while true; do echo loop; done');
      const result = deparse(ast);
      expect(result).toContain('while');
      expect(result).toContain('do');
      expect(result).toContain('done');
    });

    it('should deparse for loop', () => {
      const ast = parse('for i in 1 2 3; do echo $i; done');
      const result = deparse(ast);
      expect(result).toContain('for');
      expect(result).toContain('in');
      expect(result).toContain('do');
      expect(result).toContain('done');
    });

    it('should deparse function definition', () => {
      const ast = parse('myfunc() { echo hello; }');
      const result = deparse(ast);
      expect(result).toContain('myfunc()');
    });

    it('should deparse multiple commands', () => {
      const ast = parse('echo one; echo two');
      const result = deparse(ast);
      expect(result).toContain('echo one');
      expect(result).toContain('echo two');
    });
  });
});
