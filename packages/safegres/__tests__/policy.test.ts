import {
  createPolicy,
  createRule,
  postgresTarget,
  ingressTarget,
  egressTarget,
  validatePolicy,
  directOwner,
  membershipByField,
  publishable,
  anyOf,
  always,
  type SafegresPolicy,
  type SafegresRule,
} from '../src';

describe('Policy Types', () => {
  describe('createPolicy', () => {
    it('should create a policy with required fields', () => {
      const policy = createPolicy(
        'test.policy',
        '1.0.0',
        postgresTarget('public', 'users'),
        []
      );

      expect(policy.id).toBe('test.policy');
      expect(policy.version).toBe('1.0.0');
      expect(policy.target.layer).toBe('postgres');
      expect(policy.target.schema).toBe('public');
      expect(policy.target.table).toBe('users');
      expect(policy.rules).toEqual([]);
    });

    it('should create a policy with optional fields', () => {
      const policy = createPolicy(
        'test.policy',
        '1.0.0',
        postgresTarget('public', 'users'),
        [],
        {
          description: 'Test policy',
          tags: ['test', 'users'],
          disabled: false,
        }
      );

      expect(policy.description).toBe('Test policy');
      expect(policy.tags).toEqual(['test', 'users']);
      expect(policy.disabled).toBe(false);
    });
  });

  describe('createRule', () => {
    it('should create a rule with required fields', () => {
      const rule = createRule(
        'owner_access',
        ['authenticated'],
        ['select', 'update'],
        directOwner('owner_id'),
        'allow'
      );

      expect(rule.name).toBe('owner_access');
      expect(rule.actors).toEqual(['authenticated']);
      expect(rule.actions).toEqual(['select', 'update']);
      expect(rule.effect).toBe('allow');
    });

    it('should create a rule with optional fields', () => {
      const rule = createRule(
        'owner_access',
        ['authenticated'],
        ['select'],
        directOwner('owner_id'),
        'allow',
        {
          description: 'Owner can access their records',
          permissive: true,
          priority: 10,
        }
      );

      expect(rule.description).toBe('Owner can access their records');
      expect(rule.permissive).toBe(true);
      expect(rule.priority).toBe(10);
    });
  });

  describe('Target Builders', () => {
    it('should create postgres target', () => {
      const target = postgresTarget('public', 'posts', 'SELECT');
      expect(target).toEqual({
        layer: 'postgres',
        schema: 'public',
        table: 'posts',
        operation: 'SELECT',
      });
    });

    it('should create ingress target', () => {
      const target = ingressTarget('api.example.com', '/api/*', 'default');
      expect(target).toEqual({
        layer: 'ingress',
        host: 'api.example.com',
        path: '/api/*',
        namespace: 'default',
      });
    });

    it('should create egress target', () => {
      const target = egressTarget('*.s3.amazonaws.com', 'production');
      expect(target).toEqual({
        layer: 'egress',
        destination: '*.s3.amazonaws.com',
        namespace: 'production',
      });
    });
  });
});

describe('Policy Validation', () => {
  it('should validate a valid policy', () => {
    const policy = createPolicy(
      'test.policy',
      '1.0.0',
      postgresTarget('public', 'users'),
      [
        createRule(
          'owner_access',
          ['authenticated'],
          ['select'],
          directOwner('owner_id'),
          'allow'
        ),
      ]
    );

    const result = validatePolicy(policy);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should report missing id', () => {
    const policy: SafegresPolicy = {
      id: '',
      version: '1.0.0',
      target: postgresTarget('public', 'users'),
      rules: [],
    };

    const result = validatePolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'MISSING_ID' })
    );
  });

  it('should report missing version', () => {
    const policy: SafegresPolicy = {
      id: 'test.policy',
      version: '',
      target: postgresTarget('public', 'users'),
      rules: [],
    };

    const result = validatePolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'MISSING_VERSION' })
    );
  });

  it('should report missing target', () => {
    const policy = {
      id: 'test.policy',
      version: '1.0.0',
      rules: [],
    } as SafegresPolicy;

    const result = validatePolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'MISSING_TARGET' })
    );
  });

  it('should warn about empty rules', () => {
    const policy = createPolicy(
      'test.policy',
      '1.0.0',
      postgresTarget('public', 'users'),
      []
    );

    const result = validatePolicy(policy);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'NO_RULES' })
    );
  });

  it('should report missing rule name', () => {
    const policy: SafegresPolicy = {
      id: 'test.policy',
      version: '1.0.0',
      target: postgresTarget('public', 'users'),
      rules: [
        {
          name: '',
          actors: ['authenticated'],
          actions: ['select'],
          condition: always(),
          effect: 'allow',
        },
      ],
    };

    const result = validatePolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'MISSING_RULE_NAME' })
    );
  });

  it('should report missing actors', () => {
    const policy: SafegresPolicy = {
      id: 'test.policy',
      version: '1.0.0',
      target: postgresTarget('public', 'users'),
      rules: [
        {
          name: 'test_rule',
          actors: [],
          actions: ['select'],
          condition: always(),
          effect: 'allow',
        },
      ],
    };

    const result = validatePolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'MISSING_ACTORS' })
    );
  });

  it('should report missing actions', () => {
    const policy: SafegresPolicy = {
      id: 'test.policy',
      version: '1.0.0',
      target: postgresTarget('public', 'users'),
      rules: [
        {
          name: 'test_rule',
          actors: ['authenticated'],
          actions: [],
          condition: always(),
          effect: 'allow',
        },
      ],
    };

    const result = validatePolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'MISSING_ACTIONS' })
    );
  });
});

describe('Complete Policy Example', () => {
  it('should create a complete posts access policy', () => {
    const postsPolicy = createPolicy(
      'constructive.posts.access',
      '1.0.0',
      postgresTarget('public', 'posts'),
      [
        createRule(
          'owner_full_access',
          ['authenticated'],
          ['select', 'insert', 'update', 'delete'],
          directOwner('owner_id'),
          'allow',
          { description: 'Owners have full access to their posts' }
        ),
        createRule(
          'org_members_read',
          ['authenticated'],
          ['select'],
          membershipByField('entity_id', 'Organization Member', {
            permission: 'read_posts',
          }),
          'allow',
          { description: 'Org members can read posts' }
        ),
        createRule(
          'published_public',
          ['anonymous', 'authenticated'],
          ['select'],
          publishable('is_published'),
          'allow',
          { description: 'Published posts are public' }
        ),
      ],
      {
        description: 'Access rules for the posts table',
        tags: ['posts', 'content'],
      }
    );

    const result = validatePolicy(postsPolicy);
    expect(result.valid).toBe(true);
    expect(postsPolicy.rules).toHaveLength(3);
    expect(postsPolicy.rules[0].name).toBe('owner_full_access');
    expect(postsPolicy.rules[1].name).toBe('org_members_read');
    expect(postsPolicy.rules[2].name).toBe('published_public');
  });
});
