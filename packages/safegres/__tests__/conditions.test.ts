import {
  // Type guards
  isDirectOwner,
  isDirectOwnerAny,
  isMembership,
  isMembershipByField,
  isMembershipByJoin,
  isOrgHierarchy,
  isTemporal,
  isPublishable,
  isPathMatch,
  isHostMatch,
  isDestinationMatch,
  isFieldEquals,
  isFieldIn,
  isBoolExpr,
  isAnyOf,
  isAllOf,
  isNot,
  isTrue,
  isFalse,
  getConditionType,
  getConditionValue,
  // Builders
  directOwner,
  directOwnerAny,
  membership,
  membershipByField,
  membershipByJoin,
  orgHierarchy,
  temporal,
  publishable,
  pathMatch,
  hostMatch,
  destinationMatch,
  fieldEquals,
  fieldIn,
  allOf,
  anyOf,
  not,
  always,
  never,
} from '../src';

describe('Condition Type Guards', () => {
  describe('Identity Conditions', () => {
    it('should identify DirectOwner conditions', () => {
      const condition = directOwner('owner_id');
      expect(isDirectOwner(condition)).toBe(true);
      expect(isMembership(condition)).toBe(false);
    });

    it('should identify DirectOwnerAny conditions', () => {
      const condition = directOwnerAny(['sender_id', 'receiver_id']);
      expect(isDirectOwnerAny(condition)).toBe(true);
      expect(isDirectOwner(condition)).toBe(false);
    });

    it('should identify Membership conditions', () => {
      const condition = membership('Organization Member', { permission: 'read' });
      expect(isMembership(condition)).toBe(true);
      expect(isMembershipByField(condition)).toBe(false);
    });

    it('should identify MembershipByField conditions', () => {
      const condition = membershipByField('entity_id', 'Organization Member');
      expect(isMembershipByField(condition)).toBe(true);
      expect(isMembership(condition)).toBe(false);
    });

    it('should identify MembershipByJoin conditions', () => {
      const condition = membershipByJoin('entity_id', 'Organization Member', {
        obj_table: 'organizations',
        obj_field: 'id',
      });
      expect(isMembershipByJoin(condition)).toBe(true);
      expect(isMembershipByField(condition)).toBe(false);
    });

    it('should identify OrgHierarchy conditions', () => {
      const condition = orgHierarchy('down', 'org_id', { max_depth: 3 });
      expect(isOrgHierarchy(condition)).toBe(true);
      expect(isMembership(condition)).toBe(false);
    });
  });

  describe('Temporal Conditions', () => {
    it('should identify Temporal conditions', () => {
      const condition = temporal({
        valid_from_field: 'publish_at',
        valid_until_field: 'expires_at',
      });
      expect(isTemporal(condition)).toBe(true);
      expect(isPublishable(condition)).toBe(false);
    });

    it('should identify Publishable conditions', () => {
      const condition = publishable('is_published');
      expect(isPublishable(condition)).toBe(true);
      expect(isTemporal(condition)).toBe(false);
    });
  });

  describe('Resource Conditions', () => {
    it('should identify PathMatch conditions', () => {
      const condition = pathMatch('/api/*', 'GET');
      expect(isPathMatch(condition)).toBe(true);
      expect(isHostMatch(condition)).toBe(false);
    });

    it('should identify HostMatch conditions', () => {
      const condition = hostMatch('*.example.com');
      expect(isHostMatch(condition)).toBe(true);
      expect(isPathMatch(condition)).toBe(false);
    });

    it('should identify DestinationMatch conditions', () => {
      const condition = destinationMatch('api.example.com', { ports: [443] });
      expect(isDestinationMatch(condition)).toBe(true);
      expect(isHostMatch(condition)).toBe(false);
    });
  });

  describe('Comparison Conditions', () => {
    it('should identify FieldEquals conditions', () => {
      const condition = fieldEquals('status', 'active');
      expect(isFieldEquals(condition)).toBe(true);
      expect(isFieldIn(condition)).toBe(false);
    });

    it('should identify FieldIn conditions', () => {
      const condition = fieldIn('status', ['active', 'pending']);
      expect(isFieldIn(condition)).toBe(true);
      expect(isFieldEquals(condition)).toBe(false);
    });
  });

  describe('Composition Conditions', () => {
    it('should identify AllOf conditions', () => {
      const condition = allOf(
        directOwner('owner_id'),
        publishable('is_published')
      );
      expect(isAllOf(condition)).toBe(true);
      expect(isAnyOf(condition)).toBe(false);
    });

    it('should identify AnyOf conditions', () => {
      const condition = anyOf(
        directOwner('owner_id'),
        publishable('is_published')
      );
      expect(isAnyOf(condition)).toBe(true);
      expect(isAllOf(condition)).toBe(false);
    });

    it('should identify Not conditions', () => {
      const condition = not(publishable('is_published'));
      expect(isNot(condition)).toBe(true);
      expect(isAnyOf(condition)).toBe(false);
    });

    it('should return single condition for single-element allOf', () => {
      const inner = directOwner('owner_id');
      const condition = allOf(inner);
      expect(isDirectOwner(condition)).toBe(true);
    });

    it('should return single condition for single-element anyOf', () => {
      const inner = directOwner('owner_id');
      const condition = anyOf(inner);
      expect(isDirectOwner(condition)).toBe(true);
    });
  });

  describe('Constant Conditions', () => {
    it('should identify True conditions', () => {
      const condition = always();
      expect(isTrue(condition)).toBe(true);
      expect(isFalse(condition)).toBe(false);
    });

    it('should identify False conditions', () => {
      const condition = never();
      expect(isFalse(condition)).toBe(true);
      expect(isTrue(condition)).toBe(false);
    });

    it('should return True for empty allOf', () => {
      const condition = allOf();
      expect(isTrue(condition)).toBe(true);
    });

    it('should return False for empty anyOf', () => {
      const condition = anyOf();
      expect(isFalse(condition)).toBe(true);
    });
  });
});

describe('Condition Utilities', () => {
  it('should get condition type', () => {
    expect(getConditionType(directOwner('owner_id'))).toBe('DirectOwner');
    expect(getConditionType(membership('Organization Member'))).toBe('Membership');
    expect(getConditionType(always())).toBe('True');
  });

  it('should get condition value', () => {
    const condition = directOwner('owner_id');
    const value = getConditionValue<{ entity_field: string }>(condition);
    expect(value.entity_field).toBe('owner_id');
  });
});

describe('Condition Builders', () => {
  describe('directOwner', () => {
    it('should create DirectOwner condition', () => {
      const condition = directOwner('owner_id');
      expect(condition).toEqual({ DirectOwner: { entity_field: 'owner_id' } });
    });
  });

  describe('membership', () => {
    it('should create Membership condition with options', () => {
      const condition = membership('Organization Member', {
        permission: 'read',
        is_admin: true,
      });
      expect(condition).toEqual({
        Membership: {
          membership_type: 'Organization Member',
          permission: 'read',
          is_admin: true,
        },
      });
    });

    it('should create Membership condition with numeric type', () => {
      const condition = membership(42);
      expect(condition).toEqual({
        Membership: { membership_type: 42 },
      });
    });
  });

  describe('membershipByField', () => {
    it('should create MembershipByField condition', () => {
      const condition = membershipByField('entity_id', 'Organization Member', {
        permission: 'write',
      });
      expect(condition).toEqual({
        MembershipByField: {
          entity_field: 'entity_id',
          membership_type: 'Organization Member',
          permission: 'write',
        },
      });
    });
  });

  describe('orgHierarchy', () => {
    it('should create OrgHierarchy condition', () => {
      const condition = orgHierarchy('down', 'org_id', {
        entity_field: 'entity_id',
        max_depth: 5,
      });
      expect(condition).toEqual({
        OrgHierarchy: {
          direction: 'down',
          anchor_field: 'org_id',
          entity_field: 'entity_id',
          max_depth: 5,
        },
      });
    });
  });

  describe('temporal', () => {
    it('should create Temporal condition', () => {
      const condition = temporal({
        valid_from_field: 'start_date',
        valid_until_field: 'end_date',
        valid_from_inclusive: true,
        valid_until_inclusive: false,
      });
      expect(condition).toEqual({
        Temporal: {
          valid_from_field: 'start_date',
          valid_until_field: 'end_date',
          valid_from_inclusive: true,
          valid_until_inclusive: false,
        },
      });
    });
  });

  describe('pathMatch', () => {
    it('should create PathMatch condition', () => {
      const condition = pathMatch('/api/v1/*', 'POST');
      expect(condition).toEqual({
        PathMatch: { pattern: '/api/v1/*', method: 'POST' },
      });
    });
  });

  describe('destinationMatch', () => {
    it('should create DestinationMatch condition', () => {
      const condition = destinationMatch('api.example.com', {
        ports: [80, 443],
        protocol: 'https',
      });
      expect(condition).toEqual({
        DestinationMatch: {
          host: 'api.example.com',
          ports: [80, 443],
          protocol: 'https',
        },
      });
    });
  });
});
