import {
  singularize,
  pluralize,
  singularizeLast,
  pluralizeLast,
  distinctPluralize,
  distinctPluralizeLast,
  lcFirst,
  ucFirst,
  toCamelCase,
  toPascalCase,
  toScreamingSnake,
  underscore,
  fixCapitalisedPlural,
  toFieldName,
  toQueryName,
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

  it('should canonicalize malformed trailing triple-s words', () => {
    expect(singularize('classs')).toBe('class');
    expect(singularize('Classs')).toBe('Class');
    expect(singularize('hazardClasss')).toBe('hazardClass');
    expect(singularize('hazardClassses')).toBe('hazardClass');
    expect(singularize('CLASSS')).toBe('CLASS');
  });
});

describe('pluralize', () => {
  it('should pluralize regular words', () => {
    expect(pluralize('User')).toBe('Users');
    expect(pluralize('user')).toBe('users');
    expect(pluralize('Person')).toBe('People');
    expect(pluralize('Category')).toBe('Categories');
  });

  it('should normalize class variants', () => {
    expect(pluralize('class')).toBe('classes');
    expect(pluralize('Class')).toBe('Classes');
    expect(pluralize('hazardClass')).toBe('hazardClasses');
    expect(pluralize('HazardClass')).toBe('HazardClasses');
    expect(pluralize('hazardClasss')).toBe('hazardClasses');
    expect(pluralize('classs')).toBe('classes');
  });

  it('should preserve already-plural Latin words', () => {
    expect(pluralize('Schemata')).toBe('Schemata');
    expect(pluralize('schemata')).toBe('schemata');
  });

  it.each([
    ['class', 'classes'],
    ['glass', 'glasses'],
    ['boss', 'bosses'],
    ['process', 'processes'],
    ['address', 'addresses'],
    ['witness', 'witnesses'],
    ['abyss', 'abysses'],
  ])(
    'should handle -ss noun roundtrip for %s -> %s',
    (singularWord, pluralWord) => {
      expect(pluralize(singularWord)).toBe(pluralWord);
      expect(singularize(pluralWord)).toBe(singularWord);
    }
  );
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

  it('should normalize malformed class suffixes in the final segment', () => {
    expect(singularizeLast('hazardClassses')).toBe('hazardClass');
    expect(singularizeLast('HazardClassses')).toBe('HazardClass');
  });
});

describe('pluralizeLast', () => {
  it('should pluralize only the last word in compound names', () => {
    expect(pluralizeLast('user_profile')).toBe('user_profiles');
    expect(pluralizeLast('UserProfile')).toBe('UserProfiles');
    expect(pluralizeLast('order_item')).toBe('order_items');
    expect(pluralizeLast('OrderItem')).toBe('OrderItems');
  });

  it('should normalize malformed class suffixes in the final segment', () => {
    expect(pluralizeLast('hazardClass')).toBe('hazardClasses');
    expect(pluralizeLast('HazardClass')).toBe('HazardClasses');
    expect(pluralizeLast('hazardClasss')).toBe('hazardClasses');
    expect(pluralizeLast('HazardClasss')).toBe('HazardClasses');
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

  it('should normalize malformed class variants', () => {
    expect(distinctPluralize('classs')).toBe('classes');
    expect(distinctPluralize('hazardClasss')).toBe('hazardClasses');
  });
});

describe('distinctPluralizeLast', () => {
  it('should distinctly pluralize only the last word', () => {
    expect(distinctPluralizeLast('user_profile')).toBe('user_profiles');
    expect(distinctPluralizeLast('UserProfile')).toBe('UserProfiles');
  });

  it('should normalize malformed class variants in the final segment', () => {
    expect(distinctPluralizeLast('hazardClasss')).toBe('hazardClasses');
    expect(distinctPluralizeLast('HazardClasss')).toBe('HazardClasses');
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

describe('toCamelCase', () => {
  it('should convert snake_case to camelCase', () => {
    expect(toCamelCase('user_profile')).toBe('userProfile');
    expect(toCamelCase('order_item')).toBe('orderItem');
    expect(toCamelCase('api_schema')).toBe('apiSchema');
  });

  it('should convert hyphenated strings to camelCase', () => {
    expect(toCamelCase('user-profile')).toBe('userProfile');
    expect(toCamelCase('order-item')).toBe('orderItem');
    expect(toCamelCase('my-component')).toBe('myComponent');
  });

  it('should convert PascalCase to camelCase', () => {
    expect(toCamelCase('UserProfile')).toBe('userProfile');
    expect(toCamelCase('HelloWorld')).toBe('helloWorld');
  });

  it('should handle single words', () => {
    expect(toCamelCase('user')).toBe('user');
    expect(toCamelCase('User')).toBe('user');
  });
});

describe('toPascalCase', () => {
  it('should convert snake_case to PascalCase', () => {
    expect(toPascalCase('user_profile')).toBe('UserProfile');
    expect(toPascalCase('order_item')).toBe('OrderItem');
    expect(toPascalCase('api_schema')).toBe('ApiSchema');
  });

  it('should convert hyphenated strings to PascalCase', () => {
    expect(toPascalCase('user-profile')).toBe('UserProfile');
    expect(toPascalCase('order-item')).toBe('OrderItem');
    expect(toPascalCase('my-component')).toBe('MyComponent');
  });

  it('should convert camelCase to PascalCase', () => {
    expect(toPascalCase('userProfile')).toBe('UserProfile');
    expect(toPascalCase('helloWorld')).toBe('HelloWorld');
  });

  it('should handle single words', () => {
    expect(toPascalCase('user')).toBe('User');
    expect(toPascalCase('User')).toBe('User');
  });
});

describe('toScreamingSnake', () => {
  it('should convert camelCase to SCREAMING_SNAKE_CASE', () => {
    expect(toScreamingSnake('userProfile')).toBe('USER_PROFILE');
    expect(toScreamingSnake('orderItem')).toBe('ORDER_ITEM');
  });

  it('should convert PascalCase to SCREAMING_SNAKE_CASE', () => {
    expect(toScreamingSnake('UserProfile')).toBe('USER_PROFILE');
    expect(toScreamingSnake('OrderItem')).toBe('ORDER_ITEM');
  });

  it('should handle single words', () => {
    expect(toScreamingSnake('user')).toBe('USER');
    expect(toScreamingSnake('User')).toBe('USER');
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

  it('should normalize malformed class variants', () => {
    expect(toFieldName('Classes')).toBe('class');
    expect(toFieldName('HazardClasses')).toBe('hazardClass');
    expect(toFieldName('HazardClassses')).toBe('hazardClass');
  });
});

describe('toQueryName', () => {
  it('should convert singular PascalCase to plural camelCase', () => {
    expect(toQueryName('User')).toBe('users');
    expect(toQueryName('OrderItem')).toBe('orderItems');
    expect(toQueryName('Category')).toBe('categories');
    expect(toQueryName('Class')).toBe('classes');
    expect(toQueryName('HazardClass')).toBe('hazardClasses');
  });
});
