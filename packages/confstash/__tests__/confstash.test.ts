import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  createConfigLoader,
  deepMerge,
  defaultSearchPlaces,
  defineConfig,
  findConfigSync,
  findUpDir
} from '../src';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'confstash-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const write = (rel: string, content: string) => {
  const p = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
};

describe('defaultSearchPlaces', () => {
  it('derives places from the tool name', () => {
    const places = defaultSearchPlaces('mytool');
    expect(places).toContain('mytool.config.js');
    expect(places).toContain('.mytoolrc.yaml');
    expect(places).toContain('mytool.json');
    expect(places).toContainEqual({ packageJson: 'mytool' });
  });
});

describe('findConfigSync', () => {
  it('finds a config file in the start directory', () => {
    const p = write('mytool.json', '{"a":1}');
    const found = findConfigSync(tmp, defaultSearchPlaces('mytool'));
    expect(found?.filepath).toBe(p);
  });

  it('walks up to parent directories', () => {
    const p = write('.mytoolrc.json', '{"a":1}');
    fs.mkdirSync(path.join(tmp, 'nested/deeper'), { recursive: true });
    const found = findConfigSync(path.join(tmp, 'nested/deeper'), defaultSearchPlaces('mytool'));
    expect(found?.filepath).toBe(p);
  });

  it('respects search place precedence within a directory', () => {
    write('mytool.json', '{"from":"json"}');
    const cfg = write('mytool.config.js', 'module.exports = { from: "js" };');
    const found = findConfigSync(tmp, defaultSearchPlaces('mytool'));
    expect(found?.filepath).toBe(cfg);
  });

  it('finds package.json keys', () => {
    write('package.json', '{"name":"x","mytool":{"a":1}}');
    const found = findConfigSync(tmp, [{ packageJson: 'mytool' }]);
    expect(found?.packageJsonKey).toBe('mytool');
  });

  it('returns null when nothing is found and walkUp is false', () => {
    expect(findConfigSync(tmp, ['nope.json'], false)).toBeNull();
  });
});

describe('findUpDir', () => {
  it('finds the directory containing a file', () => {
    write('pgpm.json', '{}');
    fs.mkdirSync(path.join(tmp, 'a/b'), { recursive: true });
    expect(findUpDir(path.join(tmp, 'a/b'), 'pgpm.json')).toBe(tmp);
  });

  it('returns null when not found', () => {
    expect(findUpDir(tmp, 'definitely-not-here.xyz')).toBeNull();
  });
});

describe('deepMerge', () => {
  it('merges nested objects with later values winning', () => {
    expect(deepMerge({ a: { b: 1, c: 2 } }, { a: { b: 3 } })).toEqual({ a: { b: 3, c: 2 } });
  });

  it('replaces arrays by default', () => {
    expect(deepMerge({ xs: [1, 2] }, { xs: [3] })).toEqual({ xs: [3] });
  });

  it('concats arrays when asked', () => {
    expect(deepMerge({ xs: [1] }, { xs: [2] }, 'concat')).toEqual({ xs: [1, 2] });
  });

  it('ignores undefined source values', () => {
    expect(deepMerge({ a: 1 }, { a: undefined, b: 2 })).toEqual({ a: 1, b: 2 });
  });
});

describe('createConfigLoader', () => {
  interface Cfg {
    level?: string;
    rules?: Record<string, string>;
    list?: number[];
    extends?: string | string[];
  }

  it('loads JSON config over defaults', () => {
    write('mytool.json', '{"level":"high","rules":{"A1":"off"}}');
    const loader = createConfigLoader<Cfg>({
      tool: 'mytool',
      defaults: { level: 'low', rules: { A1: 'error', A2: 'warn' } }
    });
    const res = loader.loadSync({ cwd: tmp });
    expect(res.config).toEqual({ level: 'high', rules: { A1: 'off', A2: 'warn' } });
    expect(res.isEmpty).toBe(false);
    expect(res.filepath).toMatch(/mytool\.json$/);
  });

  it('returns defaults when no config exists', () => {
    const loader = createConfigLoader<Cfg>({ tool: 'mytool', defaults: { level: 'low' }, walkUp: false });
    const res = loader.loadSync({ cwd: tmp });
    expect(res.config).toEqual({ level: 'low' });
    expect(res.isEmpty).toBe(true);
  });

  it('loads YAML rc files', () => {
    write('.mytoolrc.yaml', 'level: medium\nrules:\n  A1: warn\n');
    const loader = createConfigLoader<Cfg>({ tool: 'mytool' });
    expect(loader.loadSync({ cwd: tmp }).config.level).toBe('medium');
  });

  it('loads extensionless rc files (JSON then YAML)', () => {
    write('.mytoolrc', 'level: yamlish');
    const loader = createConfigLoader<Cfg>({ tool: 'mytool' });
    expect(loader.loadSync({ cwd: tmp }).config.level).toBe('yamlish');
  });

  it('loads CommonJS config modules', () => {
    write('mytool.config.js', 'module.exports = { level: "js" };');
    const loader = createConfigLoader<Cfg>({ tool: 'mytool' });
    expect(loader.loadSync({ cwd: tmp }).config.level).toBe('js');
  });

  it('loads ESM config modules asynchronously', async () => {
    write('mytool.config.mjs', 'export default { level: "esm" };');
    const loader = createConfigLoader<Cfg>({ tool: 'mytool' });
    const res = await loader.load({ cwd: tmp });
    expect(res.config.level).toBe('esm');
  });

  it('loads package.json keys', () => {
    write('package.json', '{"name":"x","mytool":{"level":"pkg"}}');
    const loader = createConfigLoader<Cfg>({ tool: 'mytool' });
    expect(loader.loadSync({ cwd: tmp }).config.level).toBe('pkg');
  });

  it('resolves named presets via extends', () => {
    write('mytool.json', '{"extends":"mytool:strict","rules":{"A2":"off"}}');
    const loader = createConfigLoader<Cfg>({
      tool: 'mytool',
      presets: { 'mytool:strict': { level: 'strict', rules: { A1: 'error', A2: 'error' } } }
    });
    const res = loader.loadSync({ cwd: tmp });
    expect(res.config).toEqual({ level: 'strict', rules: { A1: 'error', A2: 'off' } });
    expect(res.layers.map((l) => l.source)).toEqual(['preset', 'file']);
  });

  it('resolves relative-path extends and chains', () => {
    write('base.json', '{"level":"base","rules":{"A1":"warn"}}');
    write('mid.json', '{"extends":"./base.json","rules":{"A2":"warn"}}');
    write('mytool.json', '{"extends":"./mid.json","rules":{"A2":"off"}}');
    const loader = createConfigLoader<Cfg>({ tool: 'mytool' });
    const res = loader.loadSync({ cwd: tmp });
    expect(res.config).toEqual({ level: 'base', rules: { A1: 'warn', A2: 'off' } });
  });

  it('throws on circular extends', () => {
    write('a.json', '{"extends":"./b.json"}');
    write('b.json', '{"extends":"./a.json"}');
    write('mytool.json', '{"extends":"./a.json"}');
    const loader = createConfigLoader<Cfg>({ tool: 'mytool' });
    expect(() => loader.loadSync({ cwd: tmp })).toThrow(/Circular "extends"/);
  });

  it('throws a helpful error for unknown extends', () => {
    write('mytool.json', '{"extends":"mytool:nope"}');
    const loader = createConfigLoader<Cfg>({
      tool: 'mytool',
      presets: { 'mytool:real': {} }
    });
    expect(() => loader.loadSync({ cwd: tmp })).toThrow(/mytool:real/);
  });

  it('applies env layer between file and overrides', () => {
    write('mytool.json', '{"level":"file"}');
    const loader = createConfigLoader<Cfg>({
      tool: 'mytool',
      envLayer: (env) => (env.MYTOOL_LEVEL ? { level: env.MYTOOL_LEVEL } : {})
    });
    const res = loader.loadSync({ cwd: tmp, env: { MYTOOL_LEVEL: 'env' } as NodeJS.ProcessEnv });
    expect(res.config.level).toBe('env');

    const res2 = loader.loadSync({
      cwd: tmp,
      env: { MYTOOL_LEVEL: 'env' } as NodeJS.ProcessEnv,
      overrides: { level: 'cli' }
    });
    expect(res2.config.level).toBe('cli');
  });

  it('loads an explicit configFile, skipping discovery', () => {
    write('elsewhere/custom.json', '{"level":"custom"}');
    write('mytool.json', '{"level":"discovered"}');
    const loader = createConfigLoader<Cfg>({ tool: 'mytool' });
    const res = loader.loadSync({ cwd: tmp, configFile: 'elsewhere/custom.json' });
    expect(res.config.level).toBe('custom');
  });

  it('runs validate on the merged config', () => {
    write('mytool.json', '{"level":"bad"}');
    const loader = createConfigLoader<Cfg>({
      tool: 'mytool',
      validate: (cfg) => {
        if (cfg.level === 'bad') throw new Error('level "bad" is not allowed');
      }
    });
    expect(() => loader.loadSync({ cwd: tmp })).toThrow(/not allowed/);
  });

  it('explainSync reports per-key provenance', () => {
    write('mytool.json', '{"rules":{"A1":"off"}}');
    const loader = createConfigLoader<Cfg>({
      tool: 'mytool',
      defaults: { level: 'low', rules: { A1: 'error', A2: 'warn' } }
    });
    const explained = loader.explainSync({ cwd: tmp });
    const byPath = Object.fromEntries(explained.map((e) => [e.path, e]));
    expect(byPath['level'].source).toBe('defaults');
    expect(byPath['rules.A1'].source).toBe('file');
    expect(byPath['rules.A2'].source).toBe('defaults');
  });
});

describe('defineConfig', () => {
  it('is an identity helper', () => {
    const cfg = defineConfig({ extends: 'x', level: 'a' });
    expect(cfg).toEqual({ extends: 'x', level: 'a' });
  });
});

describe('pgpm compatibility shape', () => {
  it('supports pgpm.config.js + pgpm.json search places with array-replace merge', () => {
    write('pgpm.json', '{"extensionsDir":"extensions","db":{"roles":["a","b"]}}');
    const loader = createConfigLoader<Record<string, any>>({
      tool: 'pgpm',
      searchPlaces: ['pgpm.config.js', 'pgpm.json'],
      defaults: { db: { roles: ['default'], host: 'localhost' } }
    });
    const res = loader.loadSync({ cwd: tmp, overrides: { db: { roles: ['c'] } } });
    expect(res.config.db.roles).toEqual(['c']);
    expect(res.config.db.host).toBe('localhost');
    expect(res.config.extensionsDir).toBe('extensions');
  });
});
