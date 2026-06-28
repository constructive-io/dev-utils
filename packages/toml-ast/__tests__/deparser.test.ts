import { deparse } from '../src/deparser';
import type { TomlDocument } from '../src/types';

describe('toml deparser', () => {
  it('deparses key-value pair', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{
        type: 'KeyValue',
        key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'title', style: 'bare' }] },
        value: { type: 'StringValue', value: 'TOML Example', style: 'basic' },
      }],
    };
    expect(deparse(ast)).toBe('title = "TOML Example"');
  });

  it('deparses integer value', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{
        type: 'KeyValue',
        key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'port', style: 'bare' }] },
        value: { type: 'IntegerValue', value: 8080, raw: '8080' },
      }],
    };
    expect(deparse(ast)).toBe('port = 8080');
  });

  it('deparses boolean value', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{
        type: 'KeyValue',
        key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'enabled', style: 'bare' }] },
        value: { type: 'BooleanValue', value: true },
      }],
    };
    expect(deparse(ast)).toBe('enabled = true');
  });

  it('deparses table', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{
        type: 'Table',
        key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'server', style: 'bare' }] },
        body: [{
          type: 'KeyValue',
          key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'host', style: 'bare' }] },
          value: { type: 'StringValue', value: 'localhost', style: 'basic' },
        }],
      }],
    };
    expect(deparse(ast)).toBe('[server]\nhost = "localhost"');
  });

  it('deparses array of tables', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{
        type: 'ArrayOfTables',
        key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'products', style: 'bare' }] },
        body: [{
          type: 'KeyValue',
          key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'name', style: 'bare' }] },
          value: { type: 'StringValue', value: 'Hammer', style: 'basic' },
        }],
      }],
    };
    expect(deparse(ast)).toBe('[[products]]\nname = "Hammer"');
  });

  it('deparses inline table', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{
        type: 'KeyValue',
        key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'point', style: 'bare' }] },
        value: {
          type: 'InlineTable',
          entries: [
            {
              type: 'KeyValue',
              key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'x', style: 'bare' }] },
              value: { type: 'IntegerValue', value: 1, raw: '1' },
            },
            {
              type: 'KeyValue',
              key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'y', style: 'bare' }] },
              value: { type: 'IntegerValue', value: 2, raw: '2' },
            },
          ],
        },
      }],
    };
    expect(deparse(ast)).toBe('point = { x = 1, y = 2 }');
  });

  it('deparses array', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{
        type: 'KeyValue',
        key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'ports', style: 'bare' }] },
        value: {
          type: 'ArrayValue',
          elements: [
            { type: 'IntegerValue', value: 80, raw: '80' },
            { type: 'IntegerValue', value: 443, raw: '443' },
          ],
        },
      }],
    };
    expect(deparse(ast)).toBe('ports = [80, 443]');
  });

  it('deparses dotted key', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{
        type: 'KeyValue',
        key: {
          type: 'Key',
          parts: [
            { type: 'KeyPart', value: 'server', style: 'bare' },
            { type: 'KeyPart', value: 'host', style: 'bare' },
          ],
        },
        value: { type: 'StringValue', value: 'localhost', style: 'basic' },
      }],
    };
    expect(deparse(ast)).toBe('server.host = "localhost"');
  });

  it('deparses quoted key', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{
        type: 'KeyValue',
        key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'special key', style: 'basic' }] },
        value: { type: 'IntegerValue', value: 42, raw: '42' },
      }],
    };
    expect(deparse(ast)).toBe('"special key" = 42');
  });

  it('deparses comment', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{ type: 'Comment', value: 'This is a comment' }],
    };
    expect(deparse(ast)).toBe('# This is a comment');
  });

  it('deparses literal string', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{
        type: 'KeyValue',
        key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'path', style: 'bare' }] },
        value: { type: 'StringValue', value: 'C:\\Users\\name', style: 'literal' },
      }],
    };
    expect(deparse(ast)).toBe("path = 'C:\\Users\\name'");
  });

  it('deparses escaped basic string', () => {
    const ast: TomlDocument = {
      type: 'TomlDocument',
      body: [{
        type: 'KeyValue',
        key: { type: 'Key', parts: [{ type: 'KeyPart', value: 'msg', style: 'bare' }] },
        value: { type: 'StringValue', value: 'line1\nline2', style: 'basic' },
      }],
    };
    expect(deparse(ast)).toBe('msg = "line1\\nline2"');
  });
});
