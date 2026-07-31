import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import type { YamlNode } from '../src';
import { fromYaml,toYaml, yamlize, yamlizeObject, yamlizeString } from '../src';

const fixturesDir = join(__dirname, '../__fixtures__');
const metaYaml = join(fixturesDir, 'meta/meta.yaml');
const outFile = join(fixturesDir, 'output/workflow.yaml');

describe('yamlize', () => {
  it('resolves imports and template variables from file', () => {
    yamlize(metaYaml, outFile, {
      git: {
        USER_NAME: 'Cosmology',
        USER_EMAIL: 'developers@cosmology.zone',
      },
      EMSCRIPTEN_VERSION: '3.1.59',
      NODE_VERSION: '20.x',
    });

    expect(existsSync(outFile)).toBe(true);
    const content = readFileSync(outFile, 'utf-8');
    expect(content).toContain('20.x');
    expect(content).toContain('Cosmology');
    expect(content).toContain('3.1.59');
  });

  afterAll(() => {
    // Clean up generated output
    if (existsSync(outFile)) {
      unlinkSync(outFile);
    }
  });
});

describe('yamlizeString', () => {
  it('resolves template variables in a YAML string', () => {
    const input = 'name: ${{yamlize.APP_NAME}}';
    const result = yamlizeString(input, { APP_NAME: 'my-app' });
    expect(result).toEqual({ name: 'my-app' });
  });

  it('resolves nested context variables', () => {
    const input = 'user: ${{yamlize.git.USER_NAME}}';
    const result = yamlizeString(input, { git: { USER_NAME: 'Dan' } });
    expect(result).toEqual({ user: 'Dan' });
  });

  it('throws on missing template variable', () => {
    const input = 'name: ${{yamlize.MISSING}}';
    expect(() => yamlizeString(input, {})).toThrow('Template var missing: MISSING');
  });

  it('passes through non-template strings unchanged', () => {
    const input = 'name: hello-world';
    const result = yamlizeString(input, {});
    expect(result).toEqual({ name: 'hello-world' });
  });
});

describe('yamlizeObject', () => {
  it('resolves template variables in a parsed object', () => {
    const obj = { name: '${{yamlize.APP_NAME}}', version: 1 };
    const result = yamlizeObject(obj, { APP_NAME: 'my-app' });
    expect(result).toEqual({ name: 'my-app', version: 1 });
  });

  it('handles arrays', () => {
    const obj = { items: ['${{yamlize.A}}', '${{yamlize.B}}'] };
    const result = yamlizeObject(obj, { A: 'x', B: 'y' });
    expect(result).toEqual({ items: ['x', 'y'] });
  });

  it('handles nested objects', () => {
    const obj = { outer: { inner: '${{yamlize.VAL}}' } };
    const result = yamlizeObject(obj, { VAL: 'deep' });
    expect(result).toEqual({ outer: { inner: 'deep' } });
  });

  it('passes through null and numbers unchanged', () => {
    const obj = { a: null, b: 42, c: true } as Record<string, YamlNode>;
    const result = yamlizeObject(obj, {});
    expect(result).toEqual({ a: null, b: 42, c: true });
  });
});

describe('toYaml / fromYaml', () => {
  it('round-trips a simple object', () => {
    const obj = { name: 'test', version: 1, enabled: true };
    const yaml = toYaml(obj);
    const parsed = fromYaml(yaml);
    expect(parsed).toEqual(obj);
  });

  it('round-trips nested objects', () => {
    const obj = {
      metadata: { name: 'app', namespace: 'default' },
      spec: { replicas: 3 },
    };
    const yaml = toYaml(obj);
    const parsed = fromYaml(yaml);
    expect(parsed).toEqual(obj);
  });

  it('round-trips arrays', () => {
    const obj = { items: ['a', 'b', 'c'] };
    const yaml = toYaml(obj);
    const parsed = fromYaml(yaml);
    expect(parsed).toEqual(obj);
  });
});
