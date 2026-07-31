import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

export const defaultIgnores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/esm/**',
  '**/coverage/**',
  '**/build/**',
  '**/generated/**',
  '**/*.d.ts'
];

export const files = ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'];

export const rules = {
  indent: ['error', 2],
  quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
  'quote-props': ['error', 'as-needed'],
  semi: ['error', 'always'],

  'simple-import-sort/imports': 'warn',
  'simple-import-sort/exports': 'warn',
  'unused-imports/no-unused-imports': 'warn',

  '@typescript-eslint/no-unused-vars': [
    'warn',
    { argsIgnorePattern: 'React|res|next|^_' }
  ],

  // empty interfaces are used as extension points / named aliases
  '@typescript-eslint/no-empty-object-type': [
    'error',
    { allowInterfaces: 'always' }
  ],

  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/no-var-requires': 'off',
  '@typescript-eslint/ban-ts-comment': 'off',
  '@typescript-eslint/no-unsafe-declaration-merging': 'off',
  'no-console': 'off',
  'prefer-const': 'off',
  'no-case-declarations': 'off',
  'no-implicit-globals': 'off'
};

/**
 * Build the shared config array.
 *
 * @param {{ ignores?: string[], files?: string[], rules?: Record<string, unknown> }} [options]
 */
export function createConfig(options = {}) {
  return [
    { ignores: options.ignores ?? defaultIgnores },
    {
      files: options.files ?? files,
      languageOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {
          ...globals.browser,
          ...globals.node,
          ...globals.es2021,
          ...globals.jest
        }
      },
      plugins: {
        '@typescript-eslint': tsPlugin,
        'simple-import-sort': simpleImportSort,
        'unused-imports': unusedImports
      },
      rules: {
        ...js.configs.recommended.rules,
        ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
        ...tsPlugin.configs.recommended.rules,
        ...prettier.rules,
        ...rules,
        ...options.rules
      }
    }
  ];
}

export default createConfig();
