import { parse } from '../src/parser';
import type { Directive, HttpBlock, IfBlock,LocationBlock, MapBlock, ServerBlock, UpstreamBlock } from '../src/types';

describe('nginx parser', () => {
  describe('directives', () => {
    it('parses simple directive', () => {
      const input = 'worker_processes 4;';
      const ast = parse(input);

      expect(ast.type).toBe('NginxConfig');
      expect(ast.body).toHaveLength(1);
      
      const directive = ast.body[0] as Directive;
      expect(directive.type).toBe('Directive');
      expect(directive.name).toBe('worker_processes');
      expect(directive.args).toEqual(['4']);
    });

    it('parses directive with multiple arguments', () => {
      const input = 'error_log /var/log/nginx/error.log warn;';
      const ast = parse(input);

      const directive = ast.body[0] as Directive;
      expect(directive.name).toBe('error_log');
      expect(directive.args).toEqual(['/var/log/nginx/error.log', 'warn']);
    });

    it('parses directive with no arguments', () => {
      const input = 'daemon;';
      const ast = parse(input);

      const directive = ast.body[0] as Directive;
      expect(directive.name).toBe('daemon');
      expect(directive.args).toEqual([]);
    });

    it('parses multiple directives', () => {
      const input = `
        worker_processes 4;
        error_log /var/log/error.log;
        pid /var/run/nginx.pid;
      `;
      const ast = parse(input);

      expect(ast.body).toHaveLength(3);
    });
  });

  describe('comments', () => {
    it('parses comments', () => {
      const input = '# This is a comment';
      const ast = parse(input);

      expect(ast.body).toHaveLength(1);
      expect(ast.body[0].type).toBe('Comment');
    });

    it('parses comments with directives', () => {
      const input = `
        # Comment
        worker_processes 4;
      `;
      const ast = parse(input);

      expect(ast.body).toHaveLength(2);
      expect(ast.body[0].type).toBe('Comment');
      expect(ast.body[1].type).toBe('Directive');
    });
  });

  describe('server block', () => {
    it('parses empty server block', () => {
      const input = 'server { }';
      const ast = parse(input);

      expect(ast.body).toHaveLength(1);
      const server = ast.body[0] as ServerBlock;
      expect(server.type).toBe('ServerBlock');
      expect(server.body).toHaveLength(0);
    });

    it('parses server block with directives', () => {
      const input = `
        server {
          listen 80;
          server_name localhost;
        }
      `;
      const ast = parse(input);

      const server = ast.body[0] as ServerBlock;
      expect(server.type).toBe('ServerBlock');
      expect(server.body).toHaveLength(2);
      
      const listen = server.body[0] as Directive;
      expect(listen.name).toBe('listen');
      expect(listen.args).toEqual(['80']);
    });
  });

  describe('location block', () => {
    it('parses location block', () => {
      const input = `
        server {
          location / {
            root /var/www/html;
          }
        }
      `;
      const ast = parse(input);

      const server = ast.body[0] as ServerBlock;
      const location = server.body[0] as LocationBlock;
      expect(location.type).toBe('LocationBlock');
      expect(location.path).toBe('/');
      expect(location.modifier).toBeUndefined();
    });

    it('parses location with exact modifier', () => {
      const input = `
        location = /exact {
          return 200;
        }
      `;
      const ast = parse(input);

      const location = ast.body[0] as LocationBlock;
      expect(location.modifier).toBe('=');
      expect(location.path).toBe('/exact');
    });

    it('parses location with regex modifier', () => {
      const input = `
        location ~ \\.php$ {
          fastcgi_pass unix:/var/run/php-fpm.sock;
        }
      `;
      const ast = parse(input);

      const location = ast.body[0] as LocationBlock;
      expect(location.modifier).toBe('~');
      expect(location.path).toBe('\\.php$');
    });

    it('parses location with case-insensitive regex modifier', () => {
      const input = `
        location ~* \\.(jpg|png)$ {
          expires 30d;
        }
      `;
      const ast = parse(input);

      const location = ast.body[0] as LocationBlock;
      expect(location.modifier).toBe('~*');
    });

    it('parses location with prefix modifier', () => {
      const input = `
        location ^~ /images {
          root /data;
        }
      `;
      const ast = parse(input);

      const location = ast.body[0] as LocationBlock;
      expect(location.modifier).toBe('^~');
      expect(location.path).toBe('/images');
    });

    it('parses named location', () => {
      const input = `
        location @fallback {
          proxy_pass http://backend;
        }
      `;
      const ast = parse(input);

      const location = ast.body[0] as LocationBlock;
      expect(location.path).toBe('@fallback');
    });
  });

  describe('http block', () => {
    it('parses http block', () => {
      const input = `
        http {
          include mime.types;
          server {
            listen 80;
          }
        }
      `;
      const ast = parse(input);

      const http = ast.body[0] as HttpBlock;
      expect(http.type).toBe('HttpBlock');
      expect(http.body).toHaveLength(2);
    });
  });

  describe('upstream block', () => {
    it('parses upstream block', () => {
      const input = `
        upstream backend {
          server 127.0.0.1:8080;
          server 127.0.0.1:8081;
        }
      `;
      const ast = parse(input);

      const upstream = ast.body[0] as UpstreamBlock;
      expect(upstream.type).toBe('UpstreamBlock');
      expect(upstream.name).toBe('backend');
      expect(upstream.body).toHaveLength(2);
    });

    it('parses upstream with weights', () => {
      const input = `
        upstream backend {
          server 127.0.0.1:8080 weight=5;
          server 127.0.0.1:8081 backup;
        }
      `;
      const ast = parse(input);

      const upstream = ast.body[0] as UpstreamBlock;
      const server1 = upstream.body[0] as Directive;
      expect(server1.args).toContain('weight=5');
    });
  });

  describe('map block', () => {
    it('parses map block', () => {
      const input = `
        map $uri $new_uri {
          default "";
          /old /new;
        }
      `;
      const ast = parse(input);

      const map = ast.body[0] as MapBlock;
      expect(map.type).toBe('MapBlock');
      expect(map.source).toBe('$uri');
      expect(map.variable).toBe('$new_uri');
      expect(map.body).toHaveLength(2);
      expect(map.body[0].match).toBe('default');
      expect(map.body[0].value).toBe('');
    });
  });

  describe('if block', () => {
    it('parses if block', () => {
      const input = `
        if ($request_uri ~* "^/old") {
          return 301 /new;
        }
      `;
      const ast = parse(input);

      const ifBlock = ast.body[0] as IfBlock;
      expect(ifBlock.type).toBe('IfBlock');
      expect(ifBlock.condition).toContain('$request_uri');
    });
  });

  describe('events block', () => {
    it('parses events block', () => {
      const input = `
        events {
          worker_connections 1024;
          use epoll;
        }
      `;
      const ast = parse(input);

      expect(ast.body[0].type).toBe('EventsBlock');
    });
  });

  describe('nested blocks', () => {
    it('parses deeply nested structure', () => {
      const input = `
        http {
          server {
            location / {
              if ($request_method = POST) {
                return 405;
              }
            }
          }
        }
      `;
      const ast = parse(input);

      const http = ast.body[0] as HttpBlock;
      const server = http.body[0] as ServerBlock;
      const location = server.body[0] as LocationBlock;
      const ifBlock = location.body[0] as IfBlock;
      
      expect(ifBlock.type).toBe('IfBlock');
    });
  });

  describe('variables', () => {
    it('parses variables in directives', () => {
      const input = 'proxy_set_header Host $host;';
      const ast = parse(input);

      const directive = ast.body[0] as Directive;
      expect(directive.args).toContain('$host');
    });
  });

  describe('quoted strings', () => {
    it('parses double-quoted strings', () => {
      const input = 'return 200 "Hello World";';
      const ast = parse(input);

      const directive = ast.body[0] as Directive;
      expect(directive.args).toContain('Hello World');
    });

    it('parses single-quoted strings', () => {
      const input = "add_header X-Custom 'value';";
      const ast = parse(input);

      const directive = ast.body[0] as Directive;
      expect(directive.args).toContain('value');
    });
  });
});
