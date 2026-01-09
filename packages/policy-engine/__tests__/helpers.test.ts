import { createHelpers } from '../src/helpers';
import type { PolicyHelpers } from '../src/types';

describe('PolicyHelpers', () => {
  let h: PolicyHelpers;

  beforeEach(() => {
    h = createHelpers();
  });

  describe('all', () => {
    it('returns true for empty array', () => {
      expect(h.all([], () => false)).toBe(true);
    });

    it('returns true when all items match', () => {
      expect(h.all([1, 2, 3], (x) => x > 0)).toBe(true);
    });

    it('returns false when any item does not match', () => {
      expect(h.all([1, 2, -1], (x) => x > 0)).toBe(false);
    });

    it('short-circuits on first false', () => {
      let count = 0;
      h.all([1, -1, 2], (x) => {
        count++;
        return x > 0;
      });
      expect(count).toBe(2);
    });
  });

  describe('any', () => {
    it('returns false for empty array', () => {
      expect(h.any([], () => true)).toBe(false);
    });

    it('returns true when any item matches', () => {
      expect(h.any([1, -2, 3], (x) => x < 0)).toBe(true);
    });

    it('returns false when no items match', () => {
      expect(h.any([1, 2, 3], (x) => x < 0)).toBe(false);
    });

    it('short-circuits on first true', () => {
      let count = 0;
      h.any([1, 2, 3], (x) => {
        count++;
        return x === 2;
      });
      expect(count).toBe(2);
    });
  });

  describe('none', () => {
    it('returns true for empty array', () => {
      expect(h.none([], () => true)).toBe(true);
    });

    it('returns true when no items match', () => {
      expect(h.none([1, 2, 3], (x) => x < 0)).toBe(true);
    });

    it('returns false when any item matches', () => {
      expect(h.none([1, -2, 3], (x) => x < 0)).toBe(false);
    });
  });

  describe('count', () => {
    it('returns 0 for empty array', () => {
      expect(h.count([], () => true)).toBe(0);
    });

    it('counts matching items', () => {
      expect(h.count([1, -2, 3, -4], (x) => x < 0)).toBe(2);
    });
  });

  describe('find', () => {
    it('returns undefined for empty array', () => {
      expect(h.find([], () => true)).toBeUndefined();
    });

    it('returns first matching item', () => {
      expect(h.find([1, 2, 3], (x) => x > 1)).toBe(2);
    });

    it('returns undefined when no match', () => {
      expect(h.find([1, 2, 3], (x) => x > 10)).toBeUndefined();
    });
  });

  describe('match.exact', () => {
    it('returns true for equal strings', () => {
      expect(h.match.exact('foo', 'foo')).toBe(true);
    });

    it('returns false for different strings', () => {
      expect(h.match.exact('foo', 'bar')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(h.match.exact(undefined, 'foo')).toBe(false);
      expect(h.match.exact('foo', undefined)).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(h.match.exact('Foo', 'foo')).toBe(false);
    });
  });

  describe('match.iexact', () => {
    it('returns true for case-insensitive match', () => {
      expect(h.match.iexact('Foo', 'foo')).toBe(true);
      expect(h.match.iexact('FOO', 'foo')).toBe(true);
    });

    it('returns false for different strings', () => {
      expect(h.match.iexact('foo', 'bar')).toBe(false);
    });
  });

  describe('match.prefix', () => {
    it('returns true when value starts with prefix', () => {
      expect(h.match.prefix('/api/users', '/api')).toBe(true);
    });

    it('returns false when value does not start with prefix', () => {
      expect(h.match.prefix('/web/users', '/api')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(h.match.prefix(undefined, '/api')).toBe(false);
    });
  });

  describe('match.suffix', () => {
    it('returns true when value ends with suffix', () => {
      expect(h.match.suffix('file.json', '.json')).toBe(true);
    });

    it('returns false when value does not end with suffix', () => {
      expect(h.match.suffix('file.xml', '.json')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(h.match.suffix(undefined, '.json')).toBe(false);
    });
  });

  describe('match.glob', () => {
    it('matches wildcard patterns', () => {
      expect(h.match.glob('api.example.com', '*.example.com')).toBe(true);
      expect(h.match.glob('foo.example.com', '*.example.com')).toBe(true);
    });

    it('matches single character wildcard', () => {
      expect(h.match.glob('file1.txt', 'file?.txt')).toBe(true);
      expect(h.match.glob('file12.txt', 'file?.txt')).toBe(false);
    });

    it('returns false for non-matching patterns', () => {
      expect(h.match.glob('other.com', '*.example.com')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(h.match.glob(undefined, '*.example.com')).toBe(false);
    });
  });

  describe('match.regex', () => {
    it('matches regex patterns', () => {
      expect(h.match.regex('/api/v1/users', '^/api/v\\d+')).toBe(true);
    });

    it('returns false for non-matching patterns', () => {
      expect(h.match.regex('/web/users', '^/api')).toBe(false);
    });

    it('returns false for invalid regex', () => {
      expect(h.match.regex('test', '[invalid')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(h.match.regex(undefined, '.*')).toBe(false);
    });
  });

  describe('get', () => {
    it('gets nested property', () => {
      const obj = { a: { b: { c: 'value' } } };
      expect(h.get(obj, 'a.b.c', 'default')).toBe('value');
    });

    it('returns fallback for missing property', () => {
      const obj = { a: { b: {} } };
      expect(h.get(obj, 'a.b.c', 'default')).toBe('default');
    });

    it('returns fallback for null object', () => {
      expect(h.get(null, 'a.b', 'default')).toBe('default');
    });

    it('returns fallback for undefined object', () => {
      expect(h.get(undefined, 'a.b', 'default')).toBe('default');
    });

    it('handles array indices', () => {
      const obj = { items: ['a', 'b', 'c'] };
      expect(h.get(obj, 'items.1', 'default')).toBe('b');
    });
  });

  describe('defined', () => {
    it('returns true for defined values', () => {
      expect(h.defined('')).toBe(true);
      expect(h.defined(0)).toBe(true);
      expect(h.defined(false)).toBe(true);
      expect(h.defined({})).toBe(true);
    });

    it('returns false for null and undefined', () => {
      expect(h.defined(null)).toBe(false);
      expect(h.defined(undefined)).toBe(false);
    });
  });

  describe('empty', () => {
    it('returns true for empty values', () => {
      expect(h.empty('')).toBe(true);
      expect(h.empty([])).toBe(true);
      expect(h.empty(null)).toBe(true);
      expect(h.empty(undefined)).toBe(true);
    });

    it('returns false for non-empty values', () => {
      expect(h.empty('hello')).toBe(false);
      expect(h.empty([1, 2])).toBe(false);
    });
  });

  describe('includes', () => {
    it('returns true when list contains value', () => {
      expect(h.includes(['a', 'b', 'c'], 'b')).toBe(true);
    });

    it('returns false when list does not contain value', () => {
      expect(h.includes(['a', 'b', 'c'], 'd')).toBe(false);
    });

    it('handles non-array input', () => {
      expect(h.includes(null as unknown as string[], 'a')).toBe(false);
    });
  });
});
