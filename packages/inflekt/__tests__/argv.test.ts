import { camelizeArgv } from '../src/argv';

describe('camelizeArgv', () => {
  it('should convert kebab-case keys to camelCase', () => {
    const argv = {
      'schema-file': 'test.graphql',
      'dry-run': true,
      output: 'dist'
    };
    
    const result = camelizeArgv(argv);
    
    expect(result).toEqual({
      schemaFile: 'test.graphql',
      dryRun: true,
      output: 'dist'
    });
  });

  it('should convert snake_case keys to camelCase', () => {
    const argv = {
      schema_file: 'test.graphql',
      dry_run: true,
      output_dir: 'dist'
    };
    
    const result = camelizeArgv(argv);
    
    expect(result).toEqual({
      schemaFile: 'test.graphql',
      dryRun: true,
      outputDir: 'dist'
    });
  });

  it('should preserve minimist internal _ key', () => {
    const argv = {
      'schema-file': 'test.graphql',
      _: ['arg1', 'arg2']
    };
    
    const result = camelizeArgv(argv);
    
    expect(result).toEqual({
      schemaFile: 'test.graphql',
      _: ['arg1', 'arg2']
    });
  });

  it('should skip keys starting with underscore', () => {
    const argv = {
      'schema-file': 'test.graphql',
      _private: 'secret',
      _internal_flag: true
    };
    
    const result = camelizeArgv(argv);
    
    expect(result).toEqual({
      schemaFile: 'test.graphql',
      _private: 'secret',
      _internal_flag: true
    });
  });

  it('should only transform top-level keys', () => {
    const argv = {
      'schema-file': 'test.graphql',
      config: {
        'nested-key': 'value',
        another_nested: 'data'
      }
    };
    
    const result = camelizeArgv(argv);
    
    expect(result).toEqual({
      schemaFile: 'test.graphql',
      config: {
        'nested-key': 'value',
        another_nested: 'data'
      }
    });
  });

  it('should handle arrays in values', () => {
    const argv = {
      'include-files': ['file1.ts', 'file2.ts'],
      _: [] as string[]
    };
    
    const result = camelizeArgv(argv);
    
    expect(result).toEqual({
      includeFiles: ['file1.ts', 'file2.ts'],
      _: []
    });
  });

  it('should handle mixed kebab-case and snake_case', () => {
    const argv = {
      'schema-file': 'test.graphql',
      output_dir: 'dist',
      'dry-run': true,
      verbose_mode: false
    };
    
    const result = camelizeArgv(argv);
    
    expect(result).toEqual({
      schemaFile: 'test.graphql',
      outputDir: 'dist',
      dryRun: true,
      verboseMode: false
    });
  });

  it('should preserve already camelCase keys', () => {
    const argv = {
      schemaFile: 'test.graphql',
      dryRun: true,
      _: [] as string[]
    };
    
    const result = camelizeArgv(argv);
    
    expect(result).toEqual({
      schemaFile: 'test.graphql',
      dryRun: true,
      _: []
    });
  });
});
