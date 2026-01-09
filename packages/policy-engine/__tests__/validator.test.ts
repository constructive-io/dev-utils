import type { PolicyContext, PolicyData, PolicyModule, Reason } from '../src/types';
import {
  validate,
  validateContext,
  validateData,
  validateModule,
} from '../src/validator';

describe('validateModule', () => {
  it('validates a correct module', () => {
    const module: PolicyModule = {
      id: 'test.policy',
      version: '1.0.0',
      evaluate: () => ({
        effect: 'allow',
        reasons: [{ code: 'ok', message: 'OK' }],
      }),
    };

    const result = validateModule(module);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-object module', () => {
    const result = validateModule(null);

    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('invalid_module');
  });

  it('rejects module without id', () => {
    const module = {
      version: '1.0.0',
      evaluate: () => ({ effect: 'allow' as const, reasons: [] as Reason[] }),
    };

    const result = validateModule(module);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_id')).toBe(true);
  });

  it('rejects module with empty id', () => {
    const module = {
      id: '',
      version: '1.0.0',
      evaluate: () => ({ effect: 'allow' as const, reasons: [] as Reason[] }),
    };

    const result = validateModule(module);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_id')).toBe(true);
  });

  it('rejects module without version', () => {
    const module = {
      id: 'test.policy',
      evaluate: () => ({ effect: 'allow' as const, reasons: [] as Reason[] }),
    };

    const result = validateModule(module);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_version')).toBe(true);
  });

  it('rejects module without evaluate function', () => {
    const module = {
      id: 'test.policy',
      version: '1.0.0',
    };

    const result = validateModule(module);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_evaluate')).toBe(true);
  });

  it('warns about invalid description type', () => {
    const module = {
      id: 'test.policy',
      version: '1.0.0',
      description: 123,
      evaluate: () => ({ effect: 'allow' as const, reasons: [] as Reason[] }),
    };

    const result = validateModule(module);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === 'invalid_description')).toBe(true);
  });

  it('warns about invalid expects type', () => {
    const module = {
      id: 'test.policy',
      version: '1.0.0',
      expects: 'invalid',
      evaluate: () => ({ effect: 'allow' as const, reasons: [] as Reason[] }),
    };

    const result = validateModule(module);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === 'invalid_expects')).toBe(true);
  });

  it('warns about invalid expects.data type', () => {
    const module = {
      id: 'test.policy',
      version: '1.0.0',
      expects: { data: 'not-an-array' },
      evaluate: () => ({ effect: 'allow' as const, reasons: [] as Reason[] }),
    };

    const result = validateModule(module);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === 'invalid_expects_data')).toBe(true);
  });
});

describe('validateContext', () => {
  const createModule = (expects?: PolicyModule['expects']): PolicyModule => ({
    id: 'test.policy',
    version: '1.0.0',
    expects,
    evaluate: () => ({ effect: 'allow', reasons: [] as Reason[] }),
  });

  const createContext = (overrides?: Partial<PolicyContext>): PolicyContext => ({
    request: {
      id: 'req-123',
      time: new Date().toISOString(),
      path: '/api/users',
      ...overrides?.request,
    },
    identity: {
      subject: 'user-456',
      claims: { ns: 'default', role: 'user' },
      ...overrides?.identity,
    },
    env: {
      stage: 'dev',
      ...overrides?.env,
    },
  });

  it('passes when no expects defined', () => {
    const result = validateContext(createModule(), createContext());

    expect(result.valid).toBe(true);
  });

  it('passes when all expected request fields present', () => {
    const module = createModule({ request: ['path', 'id'] });
    const result = validateContext(module, createContext());

    expect(result.valid).toBe(true);
  });

  it('fails when expected request field missing', () => {
    const module = createModule({ request: ['method'] });
    const ctx = createContext();
    delete ctx.request.method;

    const result = validateContext(module, ctx);

    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('missing_request_field');
    expect(result.errors[0].path).toBe('request.method');
  });

  it('passes when all expected claims present', () => {
    const module = createModule({ claims: ['ns', 'role'] });
    const result = validateContext(module, createContext());

    expect(result.valid).toBe(true);
  });

  it('fails when expected claim missing', () => {
    const module = createModule({ claims: ['admin_level'] });
    const result = validateContext(module, createContext());

    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('missing_claim');
    expect(result.errors[0].path).toBe('identity.claims.admin_level');
  });

  it('passes when all expected env fields present', () => {
    const module = createModule({ env: ['stage'] });
    const result = validateContext(module, createContext());

    expect(result.valid).toBe(true);
  });

  it('fails when expected env field missing', () => {
    const module = createModule({ env: ['cluster'] });
    const result = validateContext(module, createContext());

    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('missing_env_field');
  });
});

describe('validateData', () => {
  const createModule = (expects?: PolicyModule['expects']): PolicyModule => ({
    id: 'test.policy',
    version: '1.0.0',
    expects,
    evaluate: () => ({ effect: 'allow', reasons: [] as Reason[] }),
  });

  it('passes when no expects defined', () => {
    const result = validateData(createModule(), {});

    expect(result.valid).toBe(true);
  });

  it('passes when all expected data fields present', () => {
    const module = createModule({ data: ['rbac', 'nsBindings'] });
    const data: PolicyData = {
      rbac: { admin: { allowOps: ['*'] } },
      nsBindings: { default: { groups: ['users'] } },
    };

    const result = validateData(module, data);

    expect(result.valid).toBe(true);
  });

  it('fails when expected data field missing', () => {
    const module = createModule({ data: ['egressAllow'] });
    const data: PolicyData = {};

    const result = validateData(module, data);

    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('missing_data_field');
    expect(result.errors[0].path).toBe('data.egressAllow');
  });
});

describe('validate', () => {
  it('validates module, context, and data together', () => {
    const module: PolicyModule = {
      id: 'test.policy',
      version: '1.0.0',
      expects: {
        request: ['path'],
        claims: ['ns'],
        data: ['rbac'],
      },
      evaluate: () => ({ effect: 'allow', reasons: [] }),
    };

    const ctx: PolicyContext = {
      request: { id: '1', time: '', path: '/api' },
      identity: { subject: 'user', claims: { ns: 'default' } },
      env: {},
    };

    const data: PolicyData = {
      rbac: { user: { allowOps: ['read'] } },
    };

    const result = validate(module, ctx, data);

    expect(result.valid).toBe(true);
  });

  it('collects errors from all validations', () => {
    const module: PolicyModule = {
      id: 'test.policy',
      version: '1.0.0',
      expects: {
        request: ['method'],
        claims: ['admin'],
        data: ['secrets'],
      },
      evaluate: () => ({ effect: 'allow', reasons: [] }),
    };

    const ctx: PolicyContext = {
      request: { id: '1', time: '' },
      identity: { subject: 'user', claims: {} },
      env: {},
    };

    const data: PolicyData = {};

    const result = validate(module, ctx, data);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('fails early if module is invalid', () => {
    const result = validate(null);

    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('invalid_module');
  });
});
