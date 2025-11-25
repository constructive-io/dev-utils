import {
  isValidIdentifier,
  isValidIdentifierCamelized,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toKebabCase,
  toConstantCase,
} from '../src';

it('should convert strings to PascalCase', () => {
  expect(toPascalCase('hello_world')).toBe('HelloWorld');
  expect(toPascalCase('hello world')).toBe('HelloWorld');
  expect(toPascalCase('hello-world')).toBe('HelloWorld');
  expect(toPascalCase('Hello-World')).toBe('HelloWorld');
});

it('should convert strings to camelCase', () => {
  expect(toCamelCase('hello_world')).toBe('helloWorld');
  expect(toCamelCase('hello world')).toBe('helloWorld');
  expect(toCamelCase('hello-world')).toBe('helloWorld');
  expect(toCamelCase('Hello-World')).toBe('helloWorld');
  expect(toCamelCase('_hello_world')).toBe('helloWorld');
  expect(toCamelCase('123hello_world')).toBe('123helloWorld');
});

it('should validate valid JavaScript identifiers', () => {
  expect(isValidIdentifier('validIdentifier')).toBe(true);
  expect(isValidIdentifier('$validIdentifier')).toBe(true);
  expect(isValidIdentifier('_validIdentifier')).toBe(true);
  expect(isValidIdentifier('1invalidIdentifier')).toBe(false);
  expect(isValidIdentifier('invalid-Identifier')).toBe(false);
});

it('should validate valid JavaScript-like identifiers allowing internal hyphens', () => {
  expect(isValidIdentifierCamelized('valid-identifier')).toBe(true);
  expect(isValidIdentifierCamelized('$valid-identifier')).toBe(true);
  expect(isValidIdentifierCamelized('_valid-identifier')).toBe(true);
  expect(isValidIdentifierCamelized('1invalid-identifier')).toBe(false);
  expect(isValidIdentifierCamelized('-invalid-identifier')).toBe(false);
  expect(isValidIdentifierCamelized('invalid-identifier-')).toBe(true);
});

describe('toPascalCase', () => {
  test('converts normal string', () => {
    expect(toPascalCase('hello_world')).toBe('HelloWorld');
  });

  test('converts string with multiple underscores and mixed case', () => {
    expect(toPascalCase('Object_ID')).toBe('ObjectID');
    expect(toPascalCase('Postgre_SQL_View')).toBe('PostgreSQLView');
    expect(toPascalCase('postgre_sql_view')).toBe('PostgreSqlView');
  });

  test('handles string with multiple separators together', () => {
    expect(toPascalCase('hello___world--great')).toBe('HelloWorldGreat');
  });

  test('handles single word', () => {
    expect(toPascalCase('word')).toBe('Word');
  });

  test('handles empty string', () => {
    expect(toPascalCase('')).toBe('');
  });

  test('handles string with numbers', () => {
    expect(toPascalCase('version1_2_3')).toBe('Version123');
  });
});

describe('toCamelCase', () => {
  test('converts hyphenated string', () => {
    expect(toCamelCase('hello-world')).toBe('helloWorld');
  });

  test('converts underscored string', () => {
    expect(toCamelCase('hello_world')).toBe('helloWorld');
  });

  test('converts spaces', () => {
    expect(toCamelCase('hello world')).toBe('helloWorld');
  });

  test('handles mixed separators', () => {
    expect(toCamelCase('hello-world_now what')).toBe('helloWorldNowWhat');
  });

  test('handles empty string', () => {
    expect(toCamelCase('')).toBe('');
  });

  test('handles string starting with separators', () => {
    expect(toCamelCase('-hello_world')).toBe('helloWorld');
  });

  test('handles string with multiple separators together', () => {
    expect(toCamelCase('hello___world--great')).toBe('helloWorldGreat');
  });
});

describe('toSnakeCase', () => {
  test('converts camelCase to snake_case', () => {
    expect(toSnakeCase('helloWorld')).toBe('hello_world');
  });

  test('converts PascalCase to snake_case', () => {
    expect(toSnakeCase('HelloWorld')).toBe('hello_world');
  });

  test('converts kebab-case to snake_case', () => {
    expect(toSnakeCase('hello-world')).toBe('hello_world');
  });

  test('converts space separated to snake_case', () => {
    expect(toSnakeCase('hello world')).toBe('hello_world');
  });

  test('handles mixed case with numbers', () => {
    expect(toSnakeCase('version2APIKey')).toBe('version_2_api_key');
  });

  test('handles already snake_case strings', () => {
    expect(toSnakeCase('hello_world')).toBe('hello_world');
  });

  test('handles multiple separators together', () => {
    expect(toSnakeCase('hello___world--great')).toBe('hello_world_great');
  });

  test('handles empty string', () => {
    expect(toSnakeCase('')).toBe('');
  });

  test('removes leading and trailing underscores', () => {
    expect(toSnakeCase('_hello_world_')).toBe('hello_world');
  });

  test('handles single word', () => {
    expect(toSnakeCase('hello')).toBe('hello');
  });

  test('handles consecutive capitals', () => {
    expect(toSnakeCase('HTTPSConnection')).toBe('https_connection');
  });
});

describe('toKebabCase', () => {
  test('converts camelCase to kebab-case', () => {
    expect(toKebabCase('helloWorld')).toBe('hello-world');
  });

  test('converts PascalCase to kebab-case', () => {
    expect(toKebabCase('HelloWorld')).toBe('hello-world');
  });

  test('converts snake_case to kebab-case', () => {
    expect(toKebabCase('hello_world')).toBe('hello-world');
  });

  test('converts space separated to kebab-case', () => {
    expect(toKebabCase('hello world')).toBe('hello-world');
  });

  test('handles mixed case with numbers', () => {
    expect(toKebabCase('version2APIKey')).toBe('version-2-api-key');
  });

  test('handles already kebab-case strings', () => {
    expect(toKebabCase('hello-world')).toBe('hello-world');
  });

  test('handles multiple separators together', () => {
    expect(toKebabCase('hello___world--great')).toBe('hello-world-great');
  });

  test('handles empty string', () => {
    expect(toKebabCase('')).toBe('');
  });

  test('removes leading and trailing hyphens', () => {
    expect(toKebabCase('-hello-world-')).toBe('hello-world');
  });

  test('handles single word', () => {
    expect(toKebabCase('hello')).toBe('hello');
  });

  test('handles consecutive capitals', () => {
    expect(toKebabCase('HTTPSConnection')).toBe('https-connection');
  });
});

describe('toConstantCase', () => {
  test('converts camelCase to CONSTANT_CASE', () => {
    expect(toConstantCase('helloWorld')).toBe('HELLO_WORLD');
  });

  test('converts PascalCase to CONSTANT_CASE', () => {
    expect(toConstantCase('HelloWorld')).toBe('HELLO_WORLD');
  });

  test('converts kebab-case to CONSTANT_CASE', () => {
    expect(toConstantCase('hello-world')).toBe('HELLO_WORLD');
  });

  test('converts snake_case to CONSTANT_CASE', () => {
    expect(toConstantCase('hello_world')).toBe('HELLO_WORLD');
  });

  test('converts space separated to CONSTANT_CASE', () => {
    expect(toConstantCase('hello world')).toBe('HELLO_WORLD');
  });

  test('handles mixed case with numbers', () => {
    expect(toConstantCase('version2APIKey')).toBe('VERSION_2_API_KEY');
  });

  test('handles already CONSTANT_CASE strings', () => {
    expect(toConstantCase('HELLO_WORLD')).toBe('HELLO_WORLD');
  });

  test('handles multiple separators together', () => {
    expect(toConstantCase('hello___world--great')).toBe('HELLO_WORLD_GREAT');
  });

  test('handles empty string', () => {
    expect(toConstantCase('')).toBe('');
  });

  test('removes leading and trailing underscores', () => {
    expect(toConstantCase('_hello_world_')).toBe('HELLO_WORLD');
  });

  test('handles single word', () => {
    expect(toConstantCase('hello')).toBe('HELLO');
  });

  test('handles consecutive capitals', () => {
    expect(toConstantCase('HTTPSConnection')).toBe('HTTPS_CONNECTION');
  });
});
