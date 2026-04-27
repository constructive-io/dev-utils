import { parse } from '../src/parser';
import { LogicalExpression,Pipeline, SimpleCommand } from '../src/types';

describe('bash-parser', () => {
  describe('parse', () => {
    it('should parse a simple command', () => {
      const source = 'echo hello';
      const ast = parse(source);

      expect(ast.type).toBe('Script');
      expect(ast.commands).toHaveLength(1);
      
      const cmd = ast.commands[0] as SimpleCommand;
      expect(cmd.type).toBe('SimpleCommand');
      expect(cmd.name?.text).toBe('echo');
      expect(cmd.suffix).toHaveLength(1);
      expect(cmd.suffix?.[0].type).toBe('Word');
    });

    it('should parse command with multiple arguments', () => {
      const source = 'ls -la /tmp';
      const ast = parse(source);

      const cmd = ast.commands[0] as SimpleCommand;
      expect(cmd.name?.text).toBe('ls');
      expect(cmd.suffix).toHaveLength(2);
    });

    it('should parse pipeline', () => {
      const source = 'cat file | grep pattern';
      const ast = parse(source);

      const pipeline = ast.commands[0] as Pipeline;
      expect(pipeline.type).toBe('Pipeline');
      expect(pipeline.commands).toHaveLength(2);
    });

    it('should parse logical AND', () => {
      const source = 'cmd1 && cmd2';
      const ast = parse(source);

      const expr = ast.commands[0] as LogicalExpression;
      expect(expr.type).toBe('LogicalExpression');
      expect(expr.op).toBe('&&');
    });

    it('should parse logical OR', () => {
      const source = 'cmd1 || cmd2';
      const ast = parse(source);

      const expr = ast.commands[0] as LogicalExpression;
      expect(expr.type).toBe('LogicalExpression');
      expect(expr.op).toBe('||');
    });

    it('should parse redirect output', () => {
      const source = 'echo hello > file.txt';
      const ast = parse(source);

      const cmd = ast.commands[0] as SimpleCommand;
      expect(cmd.suffix).toBeDefined();
      const redirect = cmd.suffix?.find(s => s.type === 'Redirect');
      expect(redirect).toBeDefined();
      if (redirect?.type === 'Redirect') {
        expect(redirect.op).toBe('>');
        expect(redirect.file?.text).toBe('file.txt');
      }
    });

    it('should parse redirect input', () => {
      const source = 'cat < input.txt';
      const ast = parse(source);

      const cmd = ast.commands[0] as SimpleCommand;
      const redirect = cmd.suffix?.find(s => s.type === 'Redirect');
      expect(redirect).toBeDefined();
      if (redirect?.type === 'Redirect') {
        expect(redirect.op).toBe('<');
      }
    });

    it('should parse append redirect', () => {
      const source = 'echo hello >> file.txt';
      const ast = parse(source);

      const cmd = ast.commands[0] as SimpleCommand;
      const redirect = cmd.suffix?.find(s => s.type === 'Redirect');
      if (redirect?.type === 'Redirect') {
        expect(redirect.op).toBe('>>');
      }
    });

    it('should parse assignment', () => {
      const source = 'VAR=value';
      const ast = parse(source);

      const cmd = ast.commands[0] as SimpleCommand;
      expect(cmd.prefix).toHaveLength(1);
      expect(cmd.prefix?.[0].text).toBe('VAR=value');
    });

    it('should parse assignment with command', () => {
      const source = 'VAR=value echo $VAR';
      const ast = parse(source);

      const cmd = ast.commands[0] as SimpleCommand;
      expect(cmd.prefix).toHaveLength(1);
      expect(cmd.name?.text).toBe('echo');
    });

    it('should parse subshell', () => {
      const source = '(echo hello)';
      const ast = parse(source);

      expect(ast.commands[0].type).toBe('Subshell');
    });

    it('should parse if statement', () => {
      const source = 'if test -f file; then echo exists; fi';
      const ast = parse(source);

      expect(ast.commands[0].type).toBe('IfClause');
    });

    it('should parse while loop', () => {
      const source = 'while true; do echo loop; done';
      const ast = parse(source);

      expect(ast.commands[0].type).toBe('WhileClause');
    });

    it('should parse for loop', () => {
      const source = 'for i in 1 2 3; do echo $i; done';
      const ast = parse(source);

      const forClause = ast.commands[0];
      expect(forClause.type).toBe('ForClause');
      if (forClause.type === 'ForClause') {
        expect(forClause.name).toBe('i');
        expect(forClause.wordlist).toHaveLength(3);
      }
    });

    it('should parse function definition', () => {
      const source = 'myfunc() { echo hello; }';
      const ast = parse(source);

      expect(ast.commands[0].type).toBe('FunctionDefinition');
      if (ast.commands[0].type === 'FunctionDefinition') {
        expect(ast.commands[0].name).toBe('myfunc');
      }
    });

    it('should parse multiple commands', () => {
      const source = 'echo one; echo two';
      const ast = parse(source);

      expect(ast.commands).toHaveLength(2);
    });

    it('should parse quoted strings', () => {
      const source = 'echo "hello world"';
      const ast = parse(source);

      const cmd = ast.commands[0] as SimpleCommand;
      expect(cmd.suffix?.[0].type).toBe('Word');
      if (cmd.suffix?.[0].type === 'Word') {
        expect(cmd.suffix[0].text).toBe('"hello world"');
      }
    });

    it('should parse single quoted strings', () => {
      const source = "echo 'hello world'";
      const ast = parse(source);

      const cmd = ast.commands[0] as SimpleCommand;
      if (cmd.suffix?.[0].type === 'Word') {
        expect(cmd.suffix[0].text).toBe("'hello world'");
      }
    });

    it('should parse variable expansion', () => {
      const source = 'echo $HOME';
      const ast = parse(source);

      const cmd = ast.commands[0] as SimpleCommand;
      if (cmd.suffix?.[0].type === 'Word') {
        expect(cmd.suffix[0].text).toBe('$HOME');
      }
    });

    it('should parse command substitution', () => {
      const source = 'echo $(pwd)';
      const ast = parse(source);

      const cmd = ast.commands[0] as SimpleCommand;
      if (cmd.suffix?.[0].type === 'Word') {
        expect(cmd.suffix[0].text).toBe('$(pwd)');
      }
    });
  });
});
