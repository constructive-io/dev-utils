import {
  singularize,
  pluralize,
  singularizeLast,
  pluralizeLast,
  distinctPluralize,
  distinctPluralizeLast,
  lcFirst,
  ucFirst,
  camelize,
  underscore,
  fixCapitalisedPlural,
  toFieldName,
  toQueryName,
  inflektObject,
} from '../src';

describe('singularize', () => {
  it('should singularize regular words', () => {
    expect(singularize('Users')).toBe('User');
    expect(singularize('users')).toBe('user');
    expect(singularize('People')).toBe('Person');
    expect(singularize('people')).toBe('person');
    expect(singularize('Categories')).toBe('Category');
  });

  it('should handle Latin suffix overrides', () => {
    expect(singularize('Schemata')).toBe('Schema');
    expect(singularize('schemata')).toBe('schema');
    expect(singularize('Criteria')).toBe('Criterion');
    expect(singularize('criteria')).toBe('criterion');
    expect(singularize('Phenomena')).toBe('Phenomenon');
    expect(singularize('Media')).toBe('Medium');
    expect(singularize('Memoranda')).toBe('Memorandum');
    expect(singularize('Strata')).toBe('Stratum');
    expect(singularize('Curricula')).toBe('Curriculum');
    expect(singularize('Data')).toBe('Datum');
  });

  it('should handle compound words with Latin suffixes', () => {
    expect(singularize('ApiSchemata')).toBe('ApiSchema');
    expect(singularize('UserMedia')).toBe('UserMedium');
    expect(singularize('TestCriteria')).toBe('TestCriterion');
  });

  it('should preserve case of suffix', () => {
    expect(singularize('apiSchemata')).toBe('apiSchema');
    expect(singularize('SCHEMATA')).toBe('SCHEMA');
  });
});

describe('pluralize', () => {
  it('should pluralize regular words', () => {
    expect(pluralize('User')).toBe('Users');
    expect(pluralize('user')).toBe('users');
    expect(pluralize('Person')).toBe('People');
    expect(pluralize('Category')).toBe('Categories');
  });
});

describe('singularizeLast', () => {
  it('should singularize only the last word in compound names', () => {
    expect(singularizeLast('user_profiles')).toBe('user_profile');
    expect(singularizeLast('UserProfiles')).toBe('UserProfile');
    expect(singularizeLast('order_items')).toBe('order_item');
    expect(singularizeLast('OrderItems')).toBe('OrderItem');
  });

  it('should handle Latin suffixes in compound names', () => {
    expect(singularizeLast('api_schemata')).toBe('api_schema');
    expect(singularizeLast('ApiSchemata')).toBe('ApiSchema');
  });
});

describe('pluralizeLast', () => {
  it('should pluralize only the last word in compound names', () => {
    expect(pluralizeLast('user_profile')).toBe('user_profiles');
    expect(pluralizeLast('UserProfile')).toBe('UserProfiles');
    expect(pluralizeLast('order_item')).toBe('order_items');
    expect(pluralizeLast('OrderItem')).toBe('OrderItems');
  });
});

describe('distinctPluralize', () => {
  it('should pluralize regular words', () => {
    expect(distinctPluralize('user')).toBe('users');
    expect(distinctPluralize('User')).toBe('Users');
  });

  it('should handle words where singular equals plural', () => {
    expect(distinctPluralize('sheep')).toBe('sheeps');
    expect(distinctPluralize('fish')).toBe('fishes');
  });

  it('should handle words ending in ch, s, sh, x, z', () => {
    expect(distinctPluralize('bus')).toBe('buses');
    expect(distinctPluralize('box')).toBe('boxes');
  });
});

describe('distinctPluralizeLast', () => {
  it('should distinctly pluralize only the last word', () => {
    expect(distinctPluralizeLast('user_profile')).toBe('user_profiles');
    expect(distinctPluralizeLast('UserProfile')).toBe('UserProfiles');
  });
});

describe('lcFirst', () => {
  it('should lowercase the first character', () => {
    expect(lcFirst('UserProfile')).toBe('userProfile');
    expect(lcFirst('User')).toBe('user');
    expect(lcFirst('ABC')).toBe('aBC');
  });

  it('should handle already lowercase strings', () => {
    expect(lcFirst('user')).toBe('user');
  });
});

describe('ucFirst', () => {
  it('should uppercase the first character', () => {
    expect(ucFirst('userProfile')).toBe('UserProfile');
    expect(ucFirst('user')).toBe('User');
    expect(ucFirst('abc')).toBe('Abc');
  });

  it('should handle already uppercase strings', () => {
    expect(ucFirst('User')).toBe('User');
  });
});

describe('camelize', () => {
  it('should convert snake_case to PascalCase by default', () => {
    expect(camelize('user_profile')).toBe('UserProfile');
    expect(camelize('order_item')).toBe('OrderItem');
    expect(camelize('api_schema')).toBe('ApiSchema');
  });

  it('should convert snake_case to camelCase when lowFirstLetter is true', () => {
    expect(camelize('user_profile', true)).toBe('userProfile');
    expect(camelize('order_item', true)).toBe('orderItem');
    expect(camelize('api_schema', true)).toBe('apiSchema');
  });

  it('should handle single words', () => {
    expect(camelize('user')).toBe('User');
    expect(camelize('user', true)).toBe('user');
  });
});

describe('underscore', () => {
  it('should convert PascalCase to snake_case', () => {
    expect(underscore('UserProfile')).toBe('user_profile');
    expect(underscore('OrderItem')).toBe('order_item');
    expect(underscore('ApiSchema')).toBe('api_schema');
  });

  it('should convert camelCase to snake_case', () => {
    expect(underscore('userProfile')).toBe('user_profile');
    expect(underscore('orderItem')).toBe('order_item');
  });

  it('should handle single words', () => {
    expect(underscore('User')).toBe('user');
    expect(underscore('user')).toBe('user');
  });
});

describe('fixCapitalisedPlural', () => {
  it('should fix capitalized S after numbers', () => {
    expect(fixCapitalisedPlural('Table1S')).toBe('Table1s');
    expect(fixCapitalisedPlural('blahTable1S')).toBe('blahTable1s');
    expect(fixCapitalisedPlural('Table1SConnection')).toBe('Table1sConnection');
  });

  it('should not affect normal strings', () => {
    expect(fixCapitalisedPlural('Users')).toBe('Users');
    expect(fixCapitalisedPlural('Table1')).toBe('Table1');
  });
});

describe('toFieldName', () => {
  it('should convert plural PascalCase to singular camelCase', () => {
    expect(toFieldName('Users')).toBe('user');
    expect(toFieldName('OrderItems')).toBe('orderItem');
    expect(toFieldName('Categories')).toBe('category');
  });

  it('should handle Latin suffixes', () => {
    expect(toFieldName('Schemata')).toBe('schema');
    expect(toFieldName('ApiSchemata')).toBe('apiSchema');
  });
});

describe('toQueryName', () => {
  it('should convert singular PascalCase to plural camelCase', () => {
    expect(toQueryName('User')).toBe('users');
    expect(toQueryName('OrderItem')).toBe('orderItems');
    expect(toQueryName('Category')).toBe('categories');
  });
});

describe('inflektObject', () => {
  it('should convert kebab-case keys to camelCase', () => {
    const input = {
      'schema-file': 'test.graphql',
      'dry-run': true,
      'api-names': ['api1', 'api2'],
    };
    const expected = {
      schemaFile: 'test.graphql',
      dryRun: true,
      apiNames: ['api1', 'api2'],
    };
    expect(inflektObject(input)).toEqual(expected);
  });

  it('should preserve camelCase keys', () => {
    const input = {
      endpoint: 'http://localhost:3000',
      output: './generated',
      verbose: false,
    };
    expect(inflektObject(input)).toEqual(input);
  });

  it('should handle mixed kebab-case and camelCase keys', () => {
    const input = {
      'schema-file': 'schema.graphql',
      endpoint: 'http://localhost:3000',
      'react-query': true,
      output: './dist',
      'browser-compatible': false,
    };
    const expected = {
      schemaFile: 'schema.graphql',
      endpoint: 'http://localhost:3000',
      reactQuery: true,
      output: './dist',
      browserCompatible: false,
    };
    expect(inflektObject(input)).toEqual(expected);
  });

  it('should handle empty objects', () => {
    expect(inflektObject({})).toEqual({});
  });

  it('should handle objects with various value types', () => {
    const input = {
      'string-value': 'test',
      'number-value': 42,
      'boolean-value': true,
      'null-value': null as null,
      'undefined-value': undefined as undefined,
      'array-value': [1, 2, 3],
      'object-value': { nested: 'value' },
    };
    const expected = {
      stringValue: 'test',
      numberValue: 42,
      booleanValue: true,
      nullValue: null as null,
      undefinedValue: undefined as undefined,
      arrayValue: [1, 2, 3],
      objectValue: { nested: 'value' },
    };
    expect(inflektObject(input)).toEqual(expected);
  });

  it('should handle multiple consecutive hyphens', () => {
    const input = {
      'multi-word-key-name': 'value',
    };
    const expected = {
      multiWordKeyName: 'value',
    };
    expect(inflektObject(input)).toEqual(expected);
  });

  it('should preserve single-word keys', () => {
    const input = {
      endpoint: 'url',
      schemas: ['public'],
      orm: true,
    };
    expect(inflektObject(input)).toEqual(input);
  });

  it('should handle CLI argument conversion use case', () => {
    const argv = {
      endpoint: 'http://localhost:5000/graphql',
      'schema-file': undefined as string | undefined,
      output: 'codegen',
      schemas: undefined as string[] | undefined,
      'api-names': undefined as string[] | undefined,
      'react-query': true,
      orm: false,
      'browser-compatible': true,
      authorization: 'Bearer token123',
      'dry-run': false,
      verbose: true,
    };
    const expected = {
      endpoint: 'http://localhost:5000/graphql',
      schemaFile: undefined as string | undefined,
      output: 'codegen',
      schemas: undefined as string[] | undefined,
      apiNames: undefined as string[] | undefined,
      reactQuery: true,
      orm: false,
      browserCompatible: true,
      authorization: 'Bearer token123',
      dryRun: false,
      verbose: true,
    };
    expect(inflektObject(argv)).toEqual(expected);
  });
});
