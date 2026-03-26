import { inflektTree, toCamelCase, underscore } from '../src';

describe('inflektTree', () => {
  describe('basic key transformation', () => {
    it('should transform flat object keys from snake_case to camelCase', () => {
      const input = { user_name: 'John', user_age: 30 };
      const result = inflektTree(input, toCamelCase);
      expect(result).toEqual({ userName: 'John', userAge: 30 });
    });

    it('should transform flat object keys from camelCase to snake_case', () => {
      const input = { userName: 'John', userAge: 30 };
      const result = inflektTree(input, underscore);
      expect(result).toEqual({ user_name: 'John', user_age: 30 });
    });

    it('should handle empty objects', () => {
      const result = inflektTree({}, toCamelCase);
      expect(result).toEqual({});
    });
  });

  describe('nested objects', () => {
    it('should transform nested object keys', () => {
      const input = {
        user_name: 'John',
        user_profile: {
          profile_image: 'url',
          profile_bio: 'bio text',
        },
      };
      const result = inflektTree(input, toCamelCase);
      expect(result).toEqual({
        userName: 'John',
        userProfile: {
          profileImage: 'url',
          profileBio: 'bio text',
        },
      });
    });

    it('should handle deeply nested objects', () => {
      const input = {
        level_one: {
          level_two: {
            level_three: {
              deep_value: 'value',
            },
          },
        },
      };
      const result = inflektTree(input, toCamelCase);
      expect(result).toEqual({
        levelOne: {
          levelTwo: {
            levelThree: {
              deepValue: 'value',
            },
          },
        },
      });
    });
  });

  describe('arrays', () => {
    it('should transform keys in array of objects', () => {
      const input = {
        order_items: [
          { item_id: 1, item_name: 'Product A' },
          { item_id: 2, item_name: 'Product B' },
        ],
      };
      const result = inflektTree(input, toCamelCase);
      expect(result).toEqual({
        orderItems: [
          { itemId: 1, itemName: 'Product A' },
          { itemId: 2, itemName: 'Product B' },
        ],
      });
    });

    it('should handle arrays of primitives', () => {
      const input = { user_tags: ['tag1', 'tag2', 'tag3'] };
      const result = inflektTree(input, toCamelCase);
      expect(result).toEqual({ userTags: ['tag1', 'tag2', 'tag3'] });
    });

    it('should handle nested arrays', () => {
      const input = {
        data_matrix: [
          [{ cell_value: 1 }, { cell_value: 2 }],
          [{ cell_value: 3 }, { cell_value: 4 }],
        ],
      };
      const result = inflektTree(input, toCamelCase);
      expect(result).toEqual({
        dataMatrix: [
          [{ cellValue: 1 }, { cellValue: 2 }],
          [{ cellValue: 3 }, { cellValue: 4 }],
        ],
      });
    });
  });

  describe('mixed nested structures', () => {
    it('should handle complex mixed structures', () => {
      const input = {
        user_name: 'John',
        order_items: [
          {
            item_id: 1,
            item_details: {
              product_name: 'Widget',
              product_tags: ['new_arrival', 'sale_item'],
            },
          },
        ],
        user_metadata: {
          created_at: '2024-01-01',
          updated_at: '2024-01-02',
        },
      };
      const result = inflektTree(input, toCamelCase);
      expect(result).toEqual({
        userName: 'John',
        orderItems: [
          {
            itemId: 1,
            itemDetails: {
              productName: 'Widget',
              productTags: ['new_arrival', 'sale_item'],
            },
          },
        ],
        userMetadata: {
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02',
        },
      });
    });
  });

  describe('Date preservation', () => {
    it('should preserve Date objects', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const input = { created_at: date };
      const result = inflektTree(input, toCamelCase);

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.getTime()).toBe(date.getTime());
      expect(result.createdAt).not.toBe(date); // Should be a clone
    });

    it('should preserve nested Date objects', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const input = {
        user_data: {
          last_login: date,
        },
      };
      const result = inflektTree(input, toCamelCase);

      expect(result.userData.lastLogin).toBeInstanceOf(Date);
      expect(result.userData.lastLogin.getTime()).toBe(date.getTime());
    });
  });

  describe('null and undefined handling', () => {
    it('should return null for null input', () => {
      const result = inflektTree(null, toCamelCase);
      expect(result).toBeNull();
    });

    it('should return undefined for undefined input', () => {
      const result = inflektTree(undefined, toCamelCase);
      expect(result).toBeUndefined();
    });

    it('should preserve null values in objects', () => {
      const input = { user_name: null as null, user_age: 30 };
      const result = inflektTree(input, toCamelCase);
      expect(result).toEqual({ userName: null, userAge: 30 });
    });

    it('should preserve undefined values in objects', () => {
      const input = { user_name: undefined as undefined, user_age: 30 };
      const result = inflektTree(input, toCamelCase);
      expect(result).toEqual({ userName: undefined, userAge: 30 });
    });
  });

  describe('primitive inputs', () => {
    it('should return primitives as-is', () => {
      expect(inflektTree('string', toCamelCase)).toBe(
        'string'
      );
      expect(inflektTree(123, toCamelCase)).toBe(123);
      expect(inflektTree(true, toCamelCase)).toBe(true);
    });
  });

  describe('skip option', () => {
    it('should skip transformation for keys matching condition', () => {
      const input = {
        user_name: 'John',
        _private_field: 'secret',
        _another_private: 'data',
      };
      const result = inflektTree(input, toCamelCase, {
        skip: (key) => key.startsWith('_'),
      });
      expect(result).toEqual({
        userName: 'John',
        _private_field: 'secret',
        _another_private: 'data',
      });
    });

    it('should skip based on path depth', () => {
      const input = {
        top_level: {
          second_level: {
            third_level: {
              deep_key: 'value',
            },
          },
        },
      };
      const result = inflektTree(input, toCamelCase, {
        skip: (key, path) => path.length > 1, // only transform top 2 levels
      });
      expect(result).toEqual({
        topLevel: {
          secondLevel: {
            third_level: {
              deep_key: 'value',
            },
          },
        },
      });
    });

    it('should provide correct path for nested keys', () => {
      const paths: Array<{ key: string; path: string[] }> = [];
      const input = {
        user: {
          profile: {
            name: 'John',
          },
        },
      };
      inflektTree(input, (key) => key, {
        skip: (key, path) => {
          paths.push({ key, path: [...path] });
          return false;
        },
      });

      expect(paths).toEqual([
        { key: 'user', path: [] },
        { key: 'profile', path: ['user'] },
        { key: 'name', path: ['user', 'profile'] },
      ]);
    });

    it('should skip specific keys by name', () => {
      const input = {
        user_name: 'John',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      };
      const result = inflektTree(input, toCamelCase, {
        skip: (key) => key === 'created_at' || key === 'updated_at',
      });
      expect(result).toEqual({
        userName: 'John',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      });
    });

    it('should handle skip option with arrays', () => {
      const input = {
        items: [{ item_id: 1, _meta: 'data' }],
      };
      const result = inflektTree(input, toCamelCase, {
        skip: (key) => key.startsWith('_'),
      });
      expect(result).toEqual({
        items: [{ itemId: 1, _meta: 'data' }],
      });
    });
  });

  describe('roundtrip transformation', () => {
    it('should be able to convert to snake_case and back to camelCase', () => {
      const original = { userName: 'John', orderItems: [{ itemId: 1 }] };
      const snakeCase = inflektTree(original, underscore);
      const backToCamel = inflektTree(snakeCase, toCamelCase);
      expect(backToCamel).toEqual(original);
    });
  });
});
