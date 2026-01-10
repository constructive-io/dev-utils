# policy-engine

<p align="center" width="100%">
  <img height="120" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/safegres/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/safegres/actions/workflows/ci.yml/badge.svg" />
  </a>
</p>

TypeScript policy engine with deterministic evaluation. Define authorization policies as pure TypeScript functions that return allow/deny decisions with obligations.

## Installation

```bash
npm install policy-engine
```

## Usage

### Define a Policy

```typescript
import type { PolicyModule } from 'policy-engine';

const policy: PolicyModule = {
  id: 'api.auth',
  version: '1.0.0',
  description: 'API authentication policy',
  
  expects: {
    request: ['path'],
    claims: ['sub'],
  },
  
  evaluate(ctx, data, h) {
    // Public endpoints - allow without auth
    if (h.match.prefix(ctx.request.path, '/api/public')) {
      return {
        effect: 'allow',
        reasons: [{ code: 'public', message: 'Public endpoint' }],
      };
    }
    
    // Require authentication for other endpoints
    if (!ctx.identity.subject) {
      return {
        effect: 'deny',
        reasons: [{ code: 'unauthenticated', message: 'Authentication required' }],
      };
    }
    
    return {
      effect: 'allow',
      reasons: [{ code: 'authenticated', message: 'User authenticated' }],
      obligations: [
        { kind: 'setHeader', args: { name: 'X-User-Id', value: ctx.identity.subject } },
      ],
    };
  },
};

export default policy;
```

### Evaluate a Policy

```typescript
import { evaluatePolicy } from 'policy-engine';
import policy from './my-policy';

const ctx = {
  request: {
    id: 'req-123',
    time: new Date().toISOString(),
    path: '/api/users',
    method: 'GET',
  },
  identity: {
    subject: 'user-456',
    roles: ['user'],
    claims: { sub: 'user-456' },
  },
  env: {
    stage: 'prod',
  },
};

const data = {
  rbac: {
    user: { allowOps: ['read'] },
    admin: { allowOps: ['read', 'write', 'delete'] },
  },
};

const result = evaluatePolicy(policy, ctx, data);

console.log(result.decision.effect); // 'allow' or 'deny'
console.log(result.decision.reasons); // explanation
console.log(result.decision.obligations); // side effects to apply
```

### Evaluate Multiple Policies

```typescript
import { evaluatePolicies } from 'policy-engine';

const result = evaluatePolicies([authPolicy, rbacPolicy, rateLimitPolicy], ctx, data);

// Uses "deny overrides" - any deny results in overall deny
// Obligations from all allowing policies are combined
```

## API

### Types

#### `Decision`
```typescript
interface Decision {
  effect: 'allow' | 'deny';
  reasons: Reason[];
  obligations?: Obligation[];
  trace?: TraceStep[];
}
```

#### `PolicyModule`
```typescript
interface PolicyModule {
  id: string;
  version: string;
  description?: string;
  expects?: PolicyExpects;
  evaluate: (ctx: PolicyContext, data: PolicyData, h: PolicyHelpers) => Decision;
}
```

#### `Obligation`
```typescript
interface Obligation {
  kind: 'setHeader' | 'rateLimit' | 'rewrite' | 'log' | 'mask' | 'route' | 'cache' | 'cors';
  args: Record<string, unknown>;
}
```

### Helpers

The `PolicyHelpers` object provides safe, deterministic operations:

```typescript
interface PolicyHelpers {
  // Quantifiers
  all<T>(items: T[], pred: (x: T) => boolean): boolean;
  any<T>(items: T[], pred: (x: T) => boolean): boolean;
  none<T>(items: T[], pred: (x: T) => boolean): boolean;
  count<T>(items: T[], pred: (x: T) => boolean): number;
  find<T>(items: T[], pred: (x: T) => boolean): T | undefined;
  
  // String matching
  match: {
    exact(a?: string, b?: string): boolean;
    iexact(a?: string, b?: string): boolean;
    prefix(value?: string, prefix: string): boolean;
    suffix(value?: string, suffix: string): boolean;
    glob(value?: string, pattern: string): boolean;
    regex(value?: string, pattern: string): boolean;
  };
  
  // Safe access
  get<T>(obj: unknown, path: string, fallback: T): T;
  defined(value: unknown): boolean;
  empty(value: unknown[] | string | undefined | null): boolean;
  includes<T>(list: T[], value: T): boolean;
}
```

### Validation

```typescript
import { validate, validateModule } from 'policy-engine';

// Validate module structure
const moduleResult = validateModule(policy);

// Validate module + context + data
const fullResult = validate(policy, ctx, data);

if (!fullResult.valid) {
  console.error(fullResult.errors);
}
```

## Design Principles

1. **TypeScript is the policy language** - No DSL to learn
2. **Pure functions** - No side effects, deterministic evaluation
3. **Safe helpers** - Never throw, always return sensible defaults
4. **Composable** - Combine multiple policies with deny-overrides
5. **Explainable** - Trace mode for debugging decisions

## License

MIT
