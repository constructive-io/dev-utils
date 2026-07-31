import base from '@constructive-io/eslint-config';

export default [
  ...base,
  { ignores: ['**/__fixtures__/output/**'] },
  {
    // terminal packages match/emit ANSI escape sequences on purpose
    files: ['packages/{yanse,clean-ansi,inquirerer}/**'],
    rules: {
      'no-control-regex': 'off'
    }
  },
  {
    // vendored port of noble-hashes; keep it diffable against upstream
    files: ['packages/noble-hashes/**'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off'
    }
  }
];
