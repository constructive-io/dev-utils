import {
  allow,
  allowWith,
  deny,
  evaluatePolicies,
  evaluatePolicy,
} from '../src/evaluator';
import type { PolicyContext, PolicyData,PolicyModule } from '../src/types';

describe('evaluatePolicy', () => {
  const createContext = (overrides?: Partial<PolicyContext>): PolicyContext => ({
    request: {
      id: 'req-123',
      time: new Date().toISOString(),
      method: 'GET',
      path: '/api/users',
      ...overrides?.request,
    },
    identity: {
      subject: 'user-456',
      roles: ['user'],
      groups: [],
      claims: {},
      ...overrides?.identity,
    },
    env: {
      stage: 'dev',
      ...overrides?.env,
    },
  });

  const createData = (overrides?: Partial<PolicyData>): PolicyData => ({
    ...overrides,
  });

  it('evaluates a simple allow policy', () => {
    const policy: PolicyModule = {
      id: 'test.allow',
      version: '1.0.0',
      evaluate: () => ({
        effect: 'allow',
        reasons: [{ code: 'allowed', message: 'Access granted' }],
      }),
    };

    const result = evaluatePolicy(policy, createContext(), createData());

    expect(result.decision.effect).toBe('allow');
    expect(result.decision.reasons[0].code).toBe('allowed');
    expect(result.moduleId).toBe('test.allow');
    expect(result.moduleVersion).toBe('1.0.0');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('evaluates a simple deny policy', () => {
    const policy: PolicyModule = {
      id: 'test.deny',
      version: '1.0.0',
      evaluate: () => ({
        effect: 'deny',
        reasons: [{ code: 'denied', message: 'Access denied' }],
      }),
    };

    const result = evaluatePolicy(policy, createContext(), createData());

    expect(result.decision.effect).toBe('deny');
    expect(result.decision.reasons[0].code).toBe('denied');
  });

  it('passes context and data to policy', () => {
    const policy: PolicyModule = {
      id: 'test.context',
      version: '1.0.0',
      evaluate: (ctx, data, h) => {
        if (h.match.prefix(ctx.request.path, '/api')) {
          return {
            effect: 'allow',
            reasons: [{ code: 'api_access', message: 'API access granted' }],
          };
        }
        return {
          effect: 'deny',
          reasons: [{ code: 'not_api', message: 'Not an API path' }],
        };
      },
    };

    const apiResult = evaluatePolicy(
      policy,
      createContext({ request: { id: '1', time: '', path: '/api/users' } }),
      createData()
    );
    expect(apiResult.decision.effect).toBe('allow');

    const webResult = evaluatePolicy(
      policy,
      createContext({ request: { id: '1', time: '', path: '/web/home' } }),
      createData()
    );
    expect(webResult.decision.effect).toBe('deny');
  });

  it('handles policy that uses helpers', () => {
    const policy: PolicyModule = {
      id: 'test.helpers',
      version: '1.0.0',
      evaluate: (ctx, data, h) => {
        const roles = ctx.identity.roles ?? [];
        if (h.any(roles, (r) => r === 'admin')) {
          return {
            effect: 'allow',
            reasons: [{ code: 'admin', message: 'Admin access' }],
          };
        }
        return {
          effect: 'deny',
          reasons: [{ code: 'not_admin', message: 'Admin required' }],
        };
      },
    };

    const adminResult = evaluatePolicy(
      policy,
      createContext({ identity: { subject: 'admin', roles: ['admin'] } }),
      createData()
    );
    expect(adminResult.decision.effect).toBe('allow');

    const userResult = evaluatePolicy(
      policy,
      createContext({ identity: { subject: 'user', roles: ['user'] } }),
      createData()
    );
    expect(userResult.decision.effect).toBe('deny');
  });

  it('handles policy that throws', () => {
    const policy: PolicyModule = {
      id: 'test.throws',
      version: '1.0.0',
      evaluate: () => {
        throw new Error('Policy error');
      },
    };

    const result = evaluatePolicy(policy, createContext(), createData());

    expect(result.decision.effect).toBe('deny');
    expect(result.decision.reasons[0].code).toBe('evaluation_error');
    expect(result.decision.reasons[0].message).toContain('Policy error');
  });

  it('handles policy that returns invalid decision', () => {
    const policy: PolicyModule = {
      id: 'test.invalid',
      version: '1.0.0',
      evaluate: () => null as unknown as ReturnType<PolicyModule['evaluate']>,
    };

    const result = evaluatePolicy(policy, createContext(), createData());

    expect(result.decision.effect).toBe('deny');
    expect(result.decision.reasons[0].code).toBe('invalid_decision');
  });

  it('includes obligations in decision', () => {
    const policy: PolicyModule = {
      id: 'test.obligations',
      version: '1.0.0',
      evaluate: () => ({
        effect: 'allow',
        reasons: [{ code: 'allowed', message: 'Access granted' }],
        obligations: [
          { kind: 'setHeader', args: { name: 'X-User', value: 'test' } },
          { kind: 'rateLimit', args: { rate: '100r/s' } },
        ],
      }),
    };

    const result = evaluatePolicy(policy, createContext(), createData());

    expect(result.decision.obligations).toHaveLength(2);
    expect(result.decision.obligations?.[0].kind).toBe('setHeader');
    expect(result.decision.obligations?.[1].kind).toBe('rateLimit');
  });
});

describe('evaluatePolicies', () => {
  const createContext = (): PolicyContext => ({
    request: { id: 'req-123', time: new Date().toISOString() },
    identity: { subject: 'user-456' },
    env: {},
  });

  it('allows when all policies allow', () => {
    const policies: PolicyModule[] = [
      {
        id: 'policy1',
        version: '1.0.0',
        evaluate: () => ({
          effect: 'allow',
          reasons: [{ code: 'p1_ok', message: 'Policy 1 OK' }],
        }),
      },
      {
        id: 'policy2',
        version: '1.0.0',
        evaluate: () => ({
          effect: 'allow',
          reasons: [{ code: 'p2_ok', message: 'Policy 2 OK' }],
        }),
      },
    ];

    const result = evaluatePolicies(policies, createContext(), {});

    expect(result.decision.effect).toBe('allow');
    expect(result.decision.reasons).toHaveLength(2);
  });

  it('denies when any policy denies (deny overrides)', () => {
    const policies: PolicyModule[] = [
      {
        id: 'policy1',
        version: '1.0.0',
        evaluate: () => ({
          effect: 'allow',
          reasons: [{ code: 'p1_ok', message: 'Policy 1 OK' }],
        }),
      },
      {
        id: 'policy2',
        version: '1.0.0',
        evaluate: () => ({
          effect: 'deny',
          reasons: [{ code: 'p2_deny', message: 'Policy 2 denied' }],
        }),
      },
      {
        id: 'policy3',
        version: '1.0.0',
        evaluate: () => ({
          effect: 'allow',
          reasons: [{ code: 'p3_ok', message: 'Policy 3 OK' }],
        }),
      },
    ];

    const result = evaluatePolicies(policies, createContext(), {});

    expect(result.decision.effect).toBe('deny');
    expect(result.decision.reasons[0].code).toBe('p2_deny');
  });

  it('short-circuits on first deny', () => {
    let policy3Called = false;

    const policies: PolicyModule[] = [
      {
        id: 'policy1',
        version: '1.0.0',
        evaluate: () => ({
          effect: 'allow',
          reasons: [{ code: 'p1_ok', message: 'Policy 1 OK' }],
        }),
      },
      {
        id: 'policy2',
        version: '1.0.0',
        evaluate: () => ({
          effect: 'deny',
          reasons: [{ code: 'p2_deny', message: 'Policy 2 denied' }],
        }),
      },
      {
        id: 'policy3',
        version: '1.0.0',
        evaluate: () => {
          policy3Called = true;
          return {
            effect: 'allow',
            reasons: [{ code: 'p3_ok', message: 'Policy 3 OK' }],
          };
        },
      },
    ];

    evaluatePolicies(policies, createContext(), {});

    expect(policy3Called).toBe(false);
  });

  it('combines obligations from all allowing policies', () => {
    const policies: PolicyModule[] = [
      {
        id: 'policy1',
        version: '1.0.0',
        evaluate: () => ({
          effect: 'allow',
          reasons: [{ code: 'p1_ok', message: 'Policy 1 OK' }],
          obligations: [{ kind: 'setHeader', args: { name: 'X-P1', value: '1' } }],
        }),
      },
      {
        id: 'policy2',
        version: '1.0.0',
        evaluate: () => ({
          effect: 'allow',
          reasons: [{ code: 'p2_ok', message: 'Policy 2 OK' }],
          obligations: [{ kind: 'rateLimit', args: { rate: '100r/s' } }],
        }),
      },
    ];

    const result = evaluatePolicies(policies, createContext(), {});

    expect(result.decision.obligations).toHaveLength(2);
  });

  it('includes trace when explain is enabled', () => {
    const policies: PolicyModule[] = [
      {
        id: 'policy1',
        version: '1.0.0',
        evaluate: () => ({
          effect: 'allow',
          reasons: [{ code: 'p1_ok', message: 'Policy 1 OK' }],
        }),
      },
      {
        id: 'policy2',
        version: '2.0.0',
        evaluate: () => ({
          effect: 'allow',
          reasons: [{ code: 'p2_ok', message: 'Policy 2 OK' }],
        }),
      },
    ];

    const result = evaluatePolicies(policies, createContext(), {}, { explain: true });

    expect(result.decision.trace).toHaveLength(2);
    expect(result.decision.trace?.[0].step).toBe('policy1@1.0.0');
    expect(result.decision.trace?.[1].step).toBe('policy2@2.0.0');
  });
});

describe('decision helpers', () => {
  it('allow creates allow decision', () => {
    const decision = allow('ok', 'Access granted');

    expect(decision.effect).toBe('allow');
    expect(decision.reasons[0].code).toBe('ok');
    expect(decision.reasons[0].message).toBe('Access granted');
  });

  it('deny creates deny decision', () => {
    const decision = deny('forbidden', 'Access denied');

    expect(decision.effect).toBe('deny');
    expect(decision.reasons[0].code).toBe('forbidden');
    expect(decision.reasons[0].message).toBe('Access denied');
  });

  it('allowWith creates allow decision with obligations', () => {
    const decision = allowWith('ok', 'Access granted', [
      { kind: 'setHeader', args: { name: 'X-User', value: 'test' } },
    ]);

    expect(decision.effect).toBe('allow');
    expect(decision.obligations).toHaveLength(1);
    expect(decision.obligations?.[0].kind).toBe('setHeader');
  });
});
