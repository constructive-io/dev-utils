import { deparse } from '../src/deparser';
import { parse } from '../src/parser';

describe('nginx deparser', () => {
  describe('directives', () => {
    it('deparses simple directive', () => {
      const ast = parse('worker_processes 4;');
      const output = deparse(ast);

      expect(output).toBe('worker_processes 4;');
    });

    it('deparses directive with multiple arguments', () => {
      const ast = parse('error_log /var/log/nginx/error.log warn;');
      const output = deparse(ast);

      expect(output).toBe('error_log /var/log/nginx/error.log warn;');
    });

    it('deparses multiple directives', () => {
      const input = `worker_processes 4;
error_log /var/log/error.log;`;
      const ast = parse(input);
      const output = deparse(ast);

      expect(output).toContain('worker_processes 4;');
      expect(output).toContain('error_log /var/log/error.log;');
    });
  });

  describe('comments', () => {
    it('deparses comments', () => {
      const ast = parse('# This is a comment');
      const output = deparse(ast);

      expect(output).toBe('# This is a comment');
    });
  });

  describe('server block', () => {
    it('deparses server block', () => {
      const input = `server {
    listen 80;
    server_name localhost;
}`;
      const ast = parse(input);
      const output = deparse(ast);

      expect(output).toContain('server {');
      expect(output).toContain('listen 80;');
      expect(output).toContain('server_name localhost;');
      expect(output).toContain('}');
    });
  });

  describe('location block', () => {
    it('deparses location block', () => {
      const input = `location / {
    root /var/www/html;
}`;
      const ast = parse(input);
      const output = deparse(ast);

      expect(output).toContain('location / {');
      expect(output).toContain('root /var/www/html;');
    });

    it('deparses location with modifier', () => {
      const input = `location = /exact {
    return 200;
}`;
      const ast = parse(input);
      const output = deparse(ast);

      expect(output).toContain('location = /exact {');
    });

    it('deparses location with regex modifier', () => {
      const input = `location ~ \\.php$ {
    fastcgi_pass unix:/var/run/php-fpm.sock;
}`;
      const ast = parse(input);
      const output = deparse(ast);

      expect(output).toContain('location ~ \\.php$ {');
    });
  });

  describe('upstream block', () => {
    it('deparses upstream block', () => {
      const input = `upstream backend {
    server 127.0.0.1:8080;
    server 127.0.0.1:8081;
}`;
      const ast = parse(input);
      const output = deparse(ast);

      expect(output).toContain('upstream backend {');
      expect(output).toContain('server 127.0.0.1:8080;');
    });
  });

  describe('map block', () => {
    it('deparses map block', () => {
      const input = `map $uri $new_uri {
    default "";
    /old /new;
}`;
      const ast = parse(input);
      const output = deparse(ast);

      expect(output).toContain('map $uri $new_uri {');
      expect(output).toContain('default ;');
    });
  });

  describe('if block', () => {
    it('deparses if block', () => {
      const input = `if ($request_method = POST) {
    return 405;
}`;
      const ast = parse(input);
      const output = deparse(ast);

      expect(output).toContain('if (');
      expect(output).toContain('$request_method = POST');
      expect(output).toContain('return 405;');
    });
  });

  describe('http block', () => {
    it('deparses http block', () => {
      const input = `http {
    include mime.types;
}`;
      const ast = parse(input);
      const output = deparse(ast);

      expect(output).toContain('http {');
      expect(output).toContain('include mime.types;');
    });
  });

  describe('events block', () => {
    it('deparses events block', () => {
      const input = `events {
    worker_connections 1024;
}`;
      const ast = parse(input);
      const output = deparse(ast);

      expect(output).toContain('events {');
      expect(output).toContain('worker_connections 1024;');
    });
  });

  describe('nested blocks', () => {
    it('deparses nested structure with proper indentation', () => {
      const input = `http {
    server {
        location / {
            root /var/www/html;
        }
    }
}`;
      const ast = parse(input);
      const output = deparse(ast);

      expect(output).toContain('http {');
      expect(output).toContain('server {');
      expect(output).toContain('location / {');
      expect(output).toContain('root /var/www/html;');
    });
  });

  describe('custom options', () => {
    it('uses custom indent', () => {
      const input = `server {
    listen 80;
}`;
      const ast = parse(input);
      const output = deparse(ast, { indent: '  ' });

      expect(output).toContain('  listen 80;');
    });
  });
});
