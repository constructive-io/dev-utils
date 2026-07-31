import {
  fuzzyFindByName,
  namesMatch,
  normalizeName,
  normalizeNameSingular,
} from '../src';

describe('normalizeName', () => {
  it('should lowercase and strip underscores', () => {
    expect(normalizeName('delivery_zone')).toBe('deliveryzone');
    expect(normalizeName('DeliveryZone')).toBe('deliveryzone');
    expect(normalizeName('deliveryZones')).toBe('deliveryzones');
    expect(normalizeName('DELIVERY_ZONE')).toBe('deliveryzone');
    expect(normalizeName('shipments')).toBe('shipments');
    expect(normalizeName('Shipment')).toBe('shipment');
  });
});

describe('normalizeNameSingular', () => {
  it('should normalize and strip trailing s', () => {
    expect(normalizeNameSingular('shipments')).toBe('shipment');
    expect(normalizeNameSingular('routes')).toBe('route');
    expect(normalizeNameSingular('deliveryZones')).toBe('deliveryzone');
    expect(normalizeNameSingular('delivery_zones')).toBe('deliveryzone');
  });

  it('should not strip s from names that do not end in s', () => {
    expect(normalizeNameSingular('DeliveryZone')).toBe('deliveryzone');
    expect(normalizeNameSingular('Shipment')).toBe('shipment');
    expect(normalizeNameSingular('Route')).toBe('route');
  });
});

describe('fuzzyFindByName', () => {
  const tables = [
    { name: 'Shipment' },
    { name: 'DeliveryZone' },
    { name: 'Route' },
    { name: 'DriverVehicleAssignment' },
  ];

  it('should match exact names', () => {
    expect(fuzzyFindByName(tables, 'Shipment', (t) => t.name)).toEqual({
      name: 'Shipment',
    });
    expect(fuzzyFindByName(tables, 'Route', (t) => t.name)).toEqual({
      name: 'Route',
    });
  });

  it('should match snake_case codec names to PascalCase table names', () => {
    expect(fuzzyFindByName(tables, 'delivery_zone', (t) => t.name)).toEqual({
      name: 'DeliveryZone',
    });
    expect(
      fuzzyFindByName(tables, 'driver_vehicle_assignments', (t) => t.name),
    ).toEqual({ name: 'DriverVehicleAssignment' });
  });

  it('should match plural camelCase codec names to PascalCase table names', () => {
    expect(fuzzyFindByName(tables, 'shipments', (t) => t.name)).toEqual({
      name: 'Shipment',
    });
    expect(fuzzyFindByName(tables, 'routes', (t) => t.name)).toEqual({
      name: 'Route',
    });
    expect(
      fuzzyFindByName(tables, 'driverVehicleAssignments', (t) => t.name),
    ).toEqual({ name: 'DriverVehicleAssignment' });
  });

  it('should return undefined for no match', () => {
    expect(fuzzyFindByName(tables, 'NonExistent', (t) => t.name)).toBeUndefined();
    expect(fuzzyFindByName(tables, 'zzz', (t) => t.name)).toBeUndefined();
  });

  it('should prefer exact match over fuzzy match', () => {
    const items = [{ name: 'routes' }, { name: 'Route' }];
    expect(fuzzyFindByName(items, 'routes', (t) => t.name)).toEqual({
      name: 'routes',
    });
    expect(fuzzyFindByName(items, 'Route', (t) => t.name)).toEqual({
      name: 'Route',
    });
  });
});

describe('namesMatch', () => {
  it('should match identical names', () => {
    expect(namesMatch('Shipment', 'Shipment')).toBe(true);
  });

  it('should match case-insensitive names', () => {
    expect(namesMatch('shipment', 'Shipment')).toBe(true);
    expect(namesMatch('ROUTE', 'route')).toBe(true);
  });

  it('should match snake_case to PascalCase', () => {
    expect(namesMatch('delivery_zone', 'DeliveryZone')).toBe(true);
  });

  it('should match plural to singular', () => {
    expect(namesMatch('shipments', 'Shipment')).toBe(true);
    expect(namesMatch('routes', 'Route')).toBe(true);
  });

  it('should not match unrelated names', () => {
    expect(namesMatch('User', 'Post')).toBe(false);
    expect(namesMatch('Route', 'DeliveryZone')).toBe(false);
  });
});

describe('case helpers: toCamelCase, toPascalCase, toScreamingSnake', () => {
  // Import from index to verify they're exported
  const {
    toCamelCase,
    toPascalCase,
    toScreamingSnake,
  } = require('../src');

  it('toCamelCase should convert hyphenated and underscored strings', () => {
    expect(toCamelCase('user-profile')).toBe('userProfile');
    expect(toCamelCase('user_profile')).toBe('userProfile');
    expect(toCamelCase('UserProfile')).toBe('userProfile');
    expect(toCamelCase('some-long-name')).toBe('someLongName');
  });

  it('toPascalCase should convert hyphenated and underscored strings', () => {
    expect(toPascalCase('user-profile')).toBe('UserProfile');
    expect(toPascalCase('user_profile')).toBe('UserProfile');
    expect(toPascalCase('userProfile')).toBe('UserProfile');
  });

  it('toScreamingSnake should convert camelCase and PascalCase', () => {
    expect(toScreamingSnake('userProfile')).toBe('USER_PROFILE');
    expect(toScreamingSnake('UserProfile')).toBe('USER_PROFILE');
    expect(toScreamingSnake('displayName')).toBe('DISPLAY_NAME');
  });
});
