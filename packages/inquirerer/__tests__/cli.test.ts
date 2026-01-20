import { parseArgv, extractFirst, getPackageJson, getPackageVersion, getPackageName } from '../src';

describe('CLI utilities', () => {
  describe('parseArgv', () => {
    it('parses flags and positional args', () => {
      const argv = parseArgv(['node', 'cli', 'generate', '--config', 'test.json', '-v']);
      expect(argv._).toEqual(['generate']);
      expect(argv['config']).toBe('test.json');
      expect(argv['v']).toBe(true);
    });
  });

  describe('extractFirst', () => {
    it('extracts first positional argument', () => {
      const { first, newArgv } = extractFirst({ _: ['init', 'myproject'], config: 'test.json' } as any);
      expect(first).toBe('init');
      expect(newArgv._).toEqual(['myproject']);
      expect((newArgv as any).config).toBe('test.json');
    });

    it('handles empty positional args', () => {
      const { first, newArgv } = extractFirst({ _: [] });
      expect(first).toBeUndefined();
      expect(newArgv._).toEqual([]);
    });
  });

  describe('package helpers', () => {
    it('gets package.json from __dirname', () => {
      const pkg = getPackageJson(__dirname);
      expect(pkg.name).toBe('inquirerer');
      expect(pkg.version).toBeDefined();
    });

    it('getPackageVersion returns version string', () => {
      const version = getPackageVersion(__dirname);
      expect(typeof version).toBe('string');
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('getPackageName returns name string', () => {
      const name = getPackageName(__dirname);
      expect(name).toBe('inquirerer');
    });
  });
});
