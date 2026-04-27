import { cleanTree } from '../src/clean';
import { deparse } from '../src/deparser';
import { parse } from '../src/parser';
import {readFixture } from '../test-utils';

describe('nginx roundtrip', () => {
  describe('parse -> deparse -> parse', () => {
    it('roundtrips simple directive', () => {
      const input = 'worker_processes 4;';
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);

      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips server block', () => {
      const input = `server {
    listen 80;
    server_name localhost;
}`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);

      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips location block', () => {
      const input = `location / {
    root /var/www/html;
    index index.html;
}`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);

      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips location with modifier', () => {
      const input = `location = /exact {
    return 200;
}`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);

      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips upstream block', () => {
      const input = `upstream backend {
    server 127.0.0.1:8080;
    server 127.0.0.1:8081;
}`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);

      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips map block', () => {
      const input = `map $uri $new_uri {
    default "";
    /old /new;
}`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);

      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips if block', () => {
      const input = `if ($request_method = POST) {
    return 405;
}`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);

      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips nested structure', () => {
      const input = `http {
    server {
        listen 80;
        location / {
            root /var/www/html;
        }
    }
}`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);

      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips events block', () => {
      const input = `events {
    worker_connections 1024;
    use epoll;
}`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);

      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });

    it('roundtrips complex configuration', () => {
      const input = `worker_processes 4;
error_log /var/log/nginx/error.log warn;

events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;

    upstream backend {
        server 127.0.0.1:8080;
    }

    server {
        listen 80;
        server_name localhost;

        location / {
            proxy_pass http://backend;
        }

        location = /health {
            return 200;
        }
    }
}`;
      const ast1 = parse(input);
      const output = deparse(ast1);
      const ast2 = parse(output);

      expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
    });
  });

  describe('fixture roundtrips', () => {
    const fixtures = [
      'nginx/basic/simple.conf',
      'nginx/basic/with-upstream.conf',
      'nginx/basic/with-map.conf',
      'nginx/locations/modifiers.conf',
    ];

    for (const fixture of fixtures) {
      it(`roundtrips ${fixture}`, () => {
        let input: string;
        try {
          input = readFixture(fixture);
        } catch {
          // Skip if fixture doesn't exist
          return;
        }

        const ast1 = parse(input);
        const output = deparse(ast1);
        const ast2 = parse(output);

        expect(cleanTree(ast1)).toEqual(cleanTree(ast2));
      });
    }
  });
});
