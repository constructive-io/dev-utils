import objectPath from '../src';

describe('Object Path Operations', () => {
  let obj: any;

  beforeEach(() => {
    obj = {
      user: {
        name: 'John Doe',
        address: {
          street: '123 Main St',
          city: 'Anytown'
        },
        hobbies: ['reading', 'gaming', 'hiking']
      }
    };
  });

  describe('get', () => {
    it('should retrieve a value at a given path', () => {
      expect(objectPath.get(obj, 'user.name')).toBe('John Doe');
      expect(objectPath.get(obj, 'user.address.city')).toBe('Anytown');
      expect(objectPath.get(obj, 'user.hobbies[1]')).toBe('gaming');
      expect(obj).toMatchSnapshot();
    });

    it('should return undefined for non-existent paths', () => {
      expect(objectPath.get(obj, 'user.age')).toBeUndefined();
      expect(objectPath.get(obj, 'user.address.zip')).toBeUndefined();
      expect(objectPath.get(obj, 'user.hobbies[5]')).toBeUndefined();
      expect(obj).toMatchSnapshot();
    });
  });

  describe('set', () => {
    it('should set a value at a given path', () => {
      objectPath.set(obj, 'user.age', 30);
      expect(obj.user.age).toBe(30);

      objectPath.set(obj, 'user.address.zip', '12345');
      expect(obj.user.address.zip).toBe('12345');

      objectPath.set(obj, 'user.hobbies[2]', 'skiing');
      expect(obj.user.hobbies[2]).toBe('skiing');

      expect(obj).toMatchSnapshot();
    });

    it('should create nested structures if they do not exist', () => {
      objectPath.set(obj, 'user.contact.phone', '123-456-7890');
      expect(obj.user.contact.phone).toBe('123-456-7890');

      objectPath.set(obj, 'user.hobbies[3]', 'swimming');
      expect(obj.user.hobbies[3]).toBe('swimming');

      expect(obj).toMatchSnapshot();
    });
  });

  describe('has', () => {
    it('should return true if a path exists', () => {
      expect(objectPath.has(obj, 'user.name')).toBe(true);
      expect(objectPath.has(obj, 'user.address.city')).toBe(true);
      expect(objectPath.has(obj, 'user.hobbies[0]')).toBe(true);
      expect(obj).toMatchSnapshot();
    });

    it('should return false if a path does not exist', () => {
      expect(objectPath.has(obj, 'user.age')).toBe(false);
      expect(objectPath.has(obj, 'user.address.zip')).toBe(false);
      expect(objectPath.has(obj, 'user.hobbies[5]')).toBe(false);
      expect(obj).toMatchSnapshot();
    });
  });
});
