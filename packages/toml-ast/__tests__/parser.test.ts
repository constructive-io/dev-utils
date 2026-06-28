import { parse } from '../src/parser';
import { cleanTree } from '../src/clean';

describe('toml parser', () => {
  describe('key-value pairs', () => {
    it('parses bare key with string value', () => {
      const ast = parse('title = "TOML Example"');
      const clean = cleanTree(ast);
      expect(clean.body).toHaveLength(1);
      expect(clean.body[0]).toEqual({
        type: 'KeyValue',
        key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'title', style: 'bare' }] },
        value: { type: 'StringValue', value: 'TOML Example', style: 'basic' },
      });
    });

    it('parses integer value', () => {
      const ast = parse('port = 8080');
      const kv = cleanTree(ast).body[0];
      expect(kv.type).toBe('KeyValue');
      if (kv.type === 'KeyValue') {
        expect(kv.value).toEqual({ type: 'IntegerValue', value: 8080, raw: '8080' });
      }
    });

    it('parses float value', () => {
      const ast = parse('pi = 3.14');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue') {
        expect(kv.value).toEqual({ type: 'FloatValue', value: 3.14, raw: '3.14' });
      }
    });

    it('parses boolean values', () => {
      const ast = parse('enabled = true\ndebug = false');
      const clean = cleanTree(ast);
      expect(clean.body).toHaveLength(2);
      if (clean.body[0].type === 'KeyValue') {
        expect(clean.body[0].value).toEqual({ type: 'BooleanValue', value: true });
      }
      if (clean.body[1].type === 'KeyValue') {
        expect(clean.body[1].value).toEqual({ type: 'BooleanValue', value: false });
      }
    });

    it('parses dotted keys', () => {
      const ast = parse('server.host = "localhost"');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue') {
        expect(kv.key.parts).toHaveLength(2);
        expect(kv.key.parts[0].value).toBe('server');
        expect(kv.key.parts[1].value).toBe('host');
      }
    });

    it('parses quoted keys', () => {
      const ast = parse('"special key" = 42');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue') {
        expect(kv.key.parts[0].style).toBe('basic');
        expect(kv.key.parts[0].value).toBe('special key');
      }
    });

    it('parses literal string keys', () => {
      const ast = parse("'literal.key' = true");
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue') {
        expect(kv.key.parts[0].style).toBe('literal');
        expect(kv.key.parts[0].value).toBe('literal.key');
      }
    });
  });

  describe('string types', () => {
    it('parses basic strings with escape sequences', () => {
      const ast = parse('path = "C:\\\\Users\\\\name"');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'StringValue') {
        expect(kv.value.value).toBe('C:\\Users\\name');
      }
    });

    it('parses literal strings', () => {
      const ast = parse("path = 'C:\\Users\\name'");
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'StringValue') {
        expect(kv.value.value).toBe('C:\\Users\\name');
        expect(kv.value.style).toBe('literal');
      }
    });

    it('parses multiline basic strings', () => {
      const input = 'desc = """\nline 1\nline 2"""';
      const ast = parse(input);
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'StringValue') {
        expect(kv.value.value).toBe('line 1\nline 2');
        expect(kv.value.style).toBe('basic-multiline');
      }
    });

    it('parses multiline literal strings', () => {
      const input = "desc = '''\nline 1\nline 2'''";
      const ast = parse(input);
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'StringValue') {
        expect(kv.value.value).toBe('line 1\nline 2');
        expect(kv.value.style).toBe('literal-multiline');
      }
    });
  });

  describe('numbers', () => {
    it('parses hex integers', () => {
      const ast = parse('color = 0xff');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'IntegerValue') {
        expect(kv.value.value).toBe(255);
        expect(kv.value.raw).toBe('0xff');
      }
    });

    it('parses octal integers', () => {
      const ast = parse('perm = 0o755');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'IntegerValue') {
        expect(kv.value.value).toBe(493);
      }
    });

    it('parses binary integers', () => {
      const ast = parse('mask = 0b11010110');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'IntegerValue') {
        expect(kv.value.value).toBe(214);
      }
    });

    it('parses integers with underscores', () => {
      const ast = parse('big = 1_000_000');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'IntegerValue') {
        expect(kv.value.value).toBe(1000000);
        expect(kv.value.raw).toBe('1_000_000');
      }
    });

    it('parses float with exponent', () => {
      const ast = parse('val = 5e+22');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'FloatValue') {
        expect(kv.value.value).toBe(5e+22);
      }
    });

    it('parses special float values', () => {
      const ast = parse('a = inf\nb = -inf\nc = nan');
      const clean = cleanTree(ast);
      if (clean.body[0].type === 'KeyValue' && clean.body[0].value.type === 'FloatValue') {
        expect(clean.body[0].value.value).toBe(Infinity);
      }
      if (clean.body[1].type === 'KeyValue' && clean.body[1].value.type === 'FloatValue') {
        expect(clean.body[1].value.value).toBe(-Infinity);
      }
      if (clean.body[2].type === 'KeyValue' && clean.body[2].value.type === 'FloatValue') {
        expect(clean.body[2].value.value).toBeNaN();
      }
    });

    it('parses signed integers', () => {
      const ast = parse('pos = +42\nneg = -17');
      const clean = cleanTree(ast);
      if (clean.body[0].type === 'KeyValue' && clean.body[0].value.type === 'IntegerValue') {
        expect(clean.body[0].value.value).toBe(42);
      }
      if (clean.body[1].type === 'KeyValue' && clean.body[1].value.type === 'IntegerValue') {
        expect(clean.body[1].value.value).toBe(-17);
      }
    });
  });

  describe('datetime', () => {
    it('parses offset datetime', () => {
      const ast = parse('dt = 1979-05-27T07:32:00Z');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'DateTimeValue') {
        expect(kv.value.style).toBe('offset-datetime');
        expect(kv.value.value).toBe('1979-05-27T07:32:00Z');
      }
    });

    it('parses local date', () => {
      const ast = parse('ld = 1979-05-27');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'DateTimeValue') {
        expect(kv.value.style).toBe('local-date');
      }
    });

    it('parses local time', () => {
      const ast = parse('lt = 07:32:00');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'DateTimeValue') {
        expect(kv.value.style).toBe('local-time');
      }
    });
  });

  describe('arrays', () => {
    it('parses simple array', () => {
      const ast = parse('ports = [8001, 8001, 8002]');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'ArrayValue') {
        expect(kv.value.elements).toHaveLength(3);
      }
    });

    it('parses multiline array', () => {
      const input = `colors = [
  "red",
  "green",
  "blue",
]`;
      const ast = parse(input);
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'ArrayValue') {
        expect(kv.value.elements).toHaveLength(3);
        if (kv.value.elements[0].type === 'StringValue') {
          expect(kv.value.elements[0].value).toBe('red');
        }
      }
    });

    it('parses nested arrays', () => {
      const ast = parse('data = [[1, 2], [3, 4]]');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'ArrayValue') {
        expect(kv.value.elements).toHaveLength(2);
        expect(kv.value.elements[0].type).toBe('ArrayValue');
      }
    });

    it('parses empty array', () => {
      const ast = parse('empty = []');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'ArrayValue') {
        expect(kv.value.elements).toHaveLength(0);
      }
    });
  });

  describe('inline tables', () => {
    it('parses inline table', () => {
      const ast = parse('point = { x = 1, y = 2 }');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'InlineTable') {
        expect(kv.value.entries).toHaveLength(2);
      }
    });

    it('parses empty inline table', () => {
      const ast = parse('empty = {}');
      const kv = cleanTree(ast).body[0];
      if (kv.type === 'KeyValue' && kv.value.type === 'InlineTable') {
        expect(kv.value.entries).toHaveLength(0);
      }
    });
  });

  describe('tables', () => {
    it('parses simple table', () => {
      const input = `[server]
host = "localhost"
port = 8080`;
      const ast = parse(input);
      const clean = cleanTree(ast);
      expect(clean.body).toHaveLength(1);
      expect(clean.body[0].type).toBe('Table');
      if (clean.body[0].type === 'Table') {
        expect(clean.body[0].key.parts[0].value).toBe('server');
        expect(clean.body[0].body).toHaveLength(2);
      }
    });

    it('parses dotted table key', () => {
      const input = `[servers.alpha]
ip = "10.0.0.1"`;
      const ast = parse(input);
      const clean = cleanTree(ast);
      if (clean.body[0].type === 'Table') {
        expect(clean.body[0].key.parts).toHaveLength(2);
        expect(clean.body[0].key.parts[0].value).toBe('servers');
        expect(clean.body[0].key.parts[1].value).toBe('alpha');
      }
    });

    it('parses multiple tables', () => {
      const input = `[database]
server = "192.168.1.1"

[server]
host = "localhost"`;
      const ast = parse(input);
      const clean = cleanTree(ast);
      expect(clean.body).toHaveLength(2);
      expect(clean.body[0].type).toBe('Table');
      expect(clean.body[1].type).toBe('Table');
    });
  });

  describe('array of tables', () => {
    it('parses array of tables', () => {
      const input = `[[products]]
name = "Hammer"
sku = 738594937

[[products]]
name = "Nail"
sku = 284758393`;
      const ast = parse(input);
      const clean = cleanTree(ast);
      expect(clean.body).toHaveLength(2);
      expect(clean.body[0].type).toBe('ArrayOfTables');
      expect(clean.body[1].type).toBe('ArrayOfTables');
      if (clean.body[0].type === 'ArrayOfTables') {
        expect(clean.body[0].body).toHaveLength(2);
      }
    });
  });

  describe('comments', () => {
    it('parses comments', () => {
      const input = `# This is a comment
key = "value" # inline comment`;
      const ast = parse(input);
      const clean = cleanTree(ast);
      expect(clean.body[0].type).toBe('Comment');
    });
  });

  describe('complex documents', () => {
    it('parses a Traefik-like config', () => {
      const input = `[entryPoints]
  [entryPoints.web]
  address = ":80"
  [entryPoints.websecure]
  address = ":443"

[certificatesResolvers.myresolver.acme]
email = "admin@example.com"
storage = "acme.json"
  [certificatesResolvers.myresolver.acme.httpChallenge]
  entryPoint = "web"`;
      const ast = parse(input);
      expect(ast.type).toBe('TomlDocument');
      expect(ast.body.length).toBeGreaterThan(0);
    });

    it('parses root key-values before tables', () => {
      const input = `title = "My Config"
version = 2

[database]
enabled = true`;
      const ast = parse(input);
      const clean = cleanTree(ast);
      expect(clean.body[0].type).toBe('KeyValue');
      expect(clean.body[1].type).toBe('KeyValue');
      expect(clean.body[2].type).toBe('Table');
    });
  });
});
