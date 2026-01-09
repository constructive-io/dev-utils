import {
  // Match helpers
  match,
  exact,
  iexact,
  prefix,
  suffix,
  contains,
  glob,
  regex,
  // Quantifier helpers
  all,
  any,
  none,
  count,
  find,
  filter,
  first,
  last,
  // Access helpers
  get,
  defined,
  empty,
  includes,
  truthy,
  falsy,
  equals,
  coalesce,
  // Combined helpers
  helpers,
  createHelpers,
} from '../src';

describe('Match Helpers', () => {
  describe('exact', () => {
    it('should match exact strings', () => {
      expect(exact('hello', 'hello')).toBe(true);
      expect(exact('hello', 'world')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(exact(undefined, 'hello')).toBe(false);
      expect(exact('hello', undefined)).toBe(false);
    });
  });

  describe('iexact', () => {
    it('should match case-insensitively', () => {
      expect(iexact('Hello', 'hello')).toBe(true);
      expect(iexact('HELLO', 'hello')).toBe(true);
      expect(iexact('hello', 'world')).toBe(false);
    });
  });

  describe('prefix', () => {
    it('should match prefixes', () => {
      expect(prefix('/api/users', '/api')).toBe(true);
      expect(prefix('/api/users', '/users')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(prefix(undefined, '/api')).toBe(false);
    });
  });

  describe('suffix', () => {
    it('should match suffixes', () => {
      expect(suffix('file.txt', '.txt')).toBe(true);
      expect(suffix('file.txt', '.json')).toBe(false);
    });
  });

  describe('contains', () => {
    it('should match substrings', () => {
      expect(contains('hello world', 'world')).toBe(true);
      expect(contains('hello world', 'foo')).toBe(false);
    });
  });

  describe('glob', () => {
    it('should match glob patterns with *', () => {
      expect(glob('api.example.com', '*.example.com')).toBe(true);
      expect(glob('api.other.com', '*.example.com')).toBe(false);
    });

    it('should match glob patterns with ?', () => {
      expect(glob('file1.txt', 'file?.txt')).toBe(true);
      expect(glob('file12.txt', 'file?.txt')).toBe(false);
    });

    it('should match exact patterns', () => {
      expect(glob('hello', 'hello')).toBe(true);
      expect(glob('hello', 'world')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(glob(undefined, '*.txt')).toBe(false);
    });
  });

  describe('regex', () => {
    it('should match regex patterns', () => {
      expect(regex('hello123', '^hello\\d+$')).toBe(true);
      expect(regex('hello', '^hello\\d+$')).toBe(false);
    });

    it('should support flags', () => {
      expect(regex('HELLO', 'hello', 'i')).toBe(true);
    });

    it('should return false for invalid patterns', () => {
      expect(regex('hello', '[')).toBe(false);
    });
  });

  describe('match object', () => {
    it('should provide all match functions', () => {
      expect(match.exact('a', 'a')).toBe(true);
      expect(match.prefix('/api', '/api')).toBe(true);
      expect(match.glob('test.txt', '*.txt')).toBe(true);
    });
  });
});

describe('Quantifier Helpers', () => {
  const numbers = [1, 2, 3, 4, 5];
  const isEven = (n: number) => n % 2 === 0;
  const isPositive = (n: number) => n > 0;
  const isNegative = (n: number) => n < 0;

  describe('all', () => {
    it('should return true if all items match', () => {
      expect(all(numbers, isPositive)).toBe(true);
    });

    it('should return false if any item does not match', () => {
      expect(all(numbers, isEven)).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(all([], isPositive)).toBe(true);
    });

    it('should return true for null/undefined', () => {
      expect(all(null, isPositive)).toBe(true);
      expect(all(undefined, isPositive)).toBe(true);
    });
  });

  describe('any', () => {
    it('should return true if any item matches', () => {
      expect(any(numbers, isEven)).toBe(true);
    });

    it('should return false if no items match', () => {
      expect(any(numbers, isNegative)).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(any([], isPositive)).toBe(false);
    });
  });

  describe('none', () => {
    it('should return true if no items match', () => {
      expect(none(numbers, isNegative)).toBe(true);
    });

    it('should return false if any item matches', () => {
      expect(none(numbers, isEven)).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(none([], isPositive)).toBe(true);
    });
  });

  describe('count', () => {
    it('should count matching items', () => {
      expect(count(numbers, isEven)).toBe(2);
      expect(count(numbers, isPositive)).toBe(5);
      expect(count(numbers, isNegative)).toBe(0);
    });

    it('should return 0 for empty array', () => {
      expect(count([], isPositive)).toBe(0);
    });
  });

  describe('find', () => {
    it('should find first matching item', () => {
      expect(find(numbers, isEven)).toBe(2);
    });

    it('should return undefined if no match', () => {
      expect(find(numbers, isNegative)).toBeUndefined();
    });

    it('should return undefined for empty array', () => {
      expect(find([], isPositive)).toBeUndefined();
    });
  });

  describe('filter', () => {
    it('should filter matching items', () => {
      expect(filter(numbers, isEven)).toEqual([2, 4]);
    });

    it('should return empty array if no match', () => {
      expect(filter(numbers, isNegative)).toEqual([]);
    });
  });

  describe('first', () => {
    it('should return first item', () => {
      expect(first(numbers)).toBe(1);
    });

    it('should return undefined for empty array', () => {
      expect(first([])).toBeUndefined();
    });
  });

  describe('last', () => {
    it('should return last item', () => {
      expect(last(numbers)).toBe(5);
    });

    it('should return undefined for empty array', () => {
      expect(last([])).toBeUndefined();
    });
  });
});

describe('Access Helpers', () => {
  const obj = {
    user: {
      name: 'Alice',
      roles: ['admin', 'user'],
      profile: {
        email: 'alice@example.com',
      },
    },
  };

  describe('get', () => {
    it('should get nested properties', () => {
      expect(get(obj, 'user.name', '')).toBe('Alice');
      expect(get(obj, 'user.profile.email', '')).toBe('alice@example.com');
    });

    it('should return fallback for missing properties', () => {
      expect(get(obj, 'user.age', 0)).toBe(0);
      expect(get(obj, 'user.profile.phone', 'N/A')).toBe('N/A');
    });

    it('should return fallback for null/undefined', () => {
      expect(get(null, 'user.name', 'default')).toBe('default');
      expect(get(undefined, 'user.name', 'default')).toBe('default');
    });
  });

  describe('defined', () => {
    it('should return true for defined values', () => {
      expect(defined('hello')).toBe(true);
      expect(defined(0)).toBe(true);
      expect(defined(false)).toBe(true);
      expect(defined('')).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(defined(null)).toBe(false);
      expect(defined(undefined)).toBe(false);
    });
  });

  describe('empty', () => {
    it('should return true for empty arrays/strings', () => {
      expect(empty([])).toBe(true);
      expect(empty('')).toBe(true);
    });

    it('should return false for non-empty arrays/strings', () => {
      expect(empty([1, 2, 3])).toBe(false);
      expect(empty('hello')).toBe(false);
    });

    it('should return true for null/undefined', () => {
      expect(empty(null)).toBe(true);
      expect(empty(undefined)).toBe(true);
    });
  });

  describe('includes', () => {
    it('should check if value is in list', () => {
      expect(includes(['a', 'b', 'c'], 'b')).toBe(true);
      expect(includes(['a', 'b', 'c'], 'd')).toBe(false);
    });

    it('should return false for null/undefined list', () => {
      expect(includes(null, 'a')).toBe(false);
      expect(includes(undefined, 'a')).toBe(false);
    });
  });

  describe('truthy', () => {
    it('should return true for truthy values', () => {
      expect(truthy('hello')).toBe(true);
      expect(truthy(1)).toBe(true);
      expect(truthy(true)).toBe(true);
    });

    it('should return false for falsy values', () => {
      expect(truthy('')).toBe(false);
      expect(truthy(0)).toBe(false);
      expect(truthy(false)).toBe(false);
      expect(truthy(null)).toBe(false);
    });
  });

  describe('falsy', () => {
    it('should return true for falsy values', () => {
      expect(falsy('')).toBe(true);
      expect(falsy(0)).toBe(true);
      expect(falsy(null)).toBe(true);
    });

    it('should return false for truthy values', () => {
      expect(falsy('hello')).toBe(false);
      expect(falsy(1)).toBe(false);
    });
  });

  describe('equals', () => {
    it('should compare primitives', () => {
      expect(equals('a', 'a')).toBe(true);
      expect(equals(1, 1)).toBe(true);
      expect(equals('a', 'b')).toBe(false);
    });

    it('should compare objects deeply', () => {
      expect(equals({ a: 1 }, { a: 1 })).toBe(true);
      expect(equals({ a: 1 }, { a: 2 })).toBe(false);
      expect(equals({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    });

    it('should handle null/undefined', () => {
      expect(equals(null, null)).toBe(true);
      expect(equals(undefined, undefined)).toBe(true);
      expect(equals(null, undefined)).toBe(false);
    });
  });

  describe('coalesce', () => {
    it('should return first defined value', () => {
      expect(coalesce(undefined, null, 'hello')).toBe('hello');
      expect(coalesce('first', 'second')).toBe('first');
    });

    it('should return undefined if all values are null/undefined', () => {
      expect(coalesce(undefined, null)).toBeUndefined();
    });
  });
});

describe('Combined Helpers', () => {
  it('should create helpers with all functions', () => {
    const h = createHelpers();
    expect(h.match).toBeDefined();
    expect(h.quantifiers).toBeDefined();
    expect(h.access).toBeDefined();
    expect(h.conditions).toBeDefined();
  });

  it('should provide shorthand access to common helpers', () => {
    expect(helpers.all([1, 2, 3], (n) => n > 0)).toBe(true);
    expect(helpers.any([1, 2, 3], (n) => n > 2)).toBe(true);
    expect(helpers.get({ a: 1 }, 'a', 0)).toBe(1);
    expect(helpers.defined('hello')).toBe(true);
    expect(helpers.empty([])).toBe(true);
    expect(helpers.includes([1, 2, 3], 2)).toBe(true);
  });
});
