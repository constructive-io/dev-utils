import { cleanTree } from '../src/clean';
import { deparse } from '../src/deparser';
import { parse } from '../src/parser';

describe('toml roundtrip', () => {
  describe('parse -> deparse -> parse', () => {
    it('roundtrips simple key-value', () => {
      const input = 'title = "TOML Example"';
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips integer', () => {
      const input = 'port = 8080';
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips boolean', () => {
      const input = 'enabled = true';
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips table', () => {
      const input = `[server]\nhost = "localhost"\nport = 8080`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips dotted key', () => {
      const input = 'server.host = "localhost"';
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips inline table', () => {
      const input = 'point = { x = 1, y = 2 }';
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips simple array', () => {
      const input = 'ports = [80, 443]';
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips array of tables', () => {
      const input = `[[products]]\nname = "Hammer"\nsku = 738594937`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips literal string', () => {
      const input = "path = 'C:\\Users\\name'";
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips hex integer', () => {
      const input = 'color = 0xff';
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips float', () => {
      const input = 'pi = 3.14';
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips datetime', () => {
      const input = 'dt = 1979-05-27T07:32:00Z';
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips complex document', () => {
      const input = `title = "My Config"

[database]
server = "192.168.1.1"
ports = [8001, 8001, 8002]
enabled = true

[servers.alpha]
ip = "10.0.0.1"
dc = "eqdc10"

[[products]]
name = "Hammer"
sku = 738594937

[[products]]
name = "Nail"
sku = 284758393`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips Traefik-style config', () => {
      const input = `[entryPoints.web]
address = ":80"

[entryPoints.websecure]
address = ":443"

[api]
dashboard = true

[certificatesResolvers.myresolver.acme]
email = "admin@example.com"
storage = "acme.json"

[certificatesResolvers.myresolver.acme.httpChallenge]
entryPoint = "web"`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);
      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });
  });
});
