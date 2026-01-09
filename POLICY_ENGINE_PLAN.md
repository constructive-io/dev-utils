# Policy Engine & Nginx Compilation Plan

## Overview

A TypeScript-based policy engine where **TypeScript IS the policy language**, with compilation to Nginx configurations. Policies are pure functions that return Decisions, which can be compiled to if/switch control flow structures and then to target formats (Nginx, WASM, etc.).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Policy Authoring                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  PolicyModule (TypeScript)                                   │    │
│  │  - Pure function: (ctx, data, helpers) => Decision          │    │
│  │  - Constrained syntax (no side effects, deterministic)      │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Policy Compilation                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Intermediate Representation (IR)                            │    │
│  │  - Normalized if/else chains                                 │    │
│  │  - Switch statements for multi-branch decisions              │    │
│  │  - Condition trees (AND/OR/NOT)                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │  Nginx   │  │   WASM   │  │  Other   │
              │  Config  │  │ Bytecode │  │ Targets  │
              └──────────┘  └──────────┘  └──────────┘
```

## Packages

### 1. `policy-engine` (Core)

The foundation - types, helpers, and runtime evaluator.

```
packages/policy-engine/
├── src/
│   ├── types.ts           # Core types (Decision, PolicyModule, etc.)
│   ├── helpers.ts         # PolicyHelpers implementation (all, any, match, get)
│   ├── evaluator.ts       # Runtime policy evaluation with sandboxing
│   ├── validator.ts       # Static validation of policy modules
│   └── index.ts
├── __tests__/
└── __fixtures__/
```

**Core Types:**

```typescript
// Effect: the outcome of a policy decision
type Effect = "allow" | "deny";

// Reason: explains why a decision was made
interface Reason {
  code: string;              // stable identifier for analytics
  message: string;           // human-readable
  path?: string;             // e.g., "request.route"
  meta?: Record<string, unknown>;
}

// Obligation: side effects to apply (maps to Nginx directives)
interface Obligation {
  kind: "setHeader" | "rateLimit" | "rewrite" | "log" | "mask" | "route";
  args: Record<string, unknown>;
}

// Decision: the result of policy evaluation
interface Decision {
  effect: Effect;
  reasons: Reason[];
  obligations?: Obligation[];
  trace?: Array<{ step: string; ok: boolean; meta?: unknown }>;
}

// PolicyContext: request + identity + environment
interface PolicyContext {
  request: {
    id: string;
    time: string;
    ip?: string;
    method?: string;
    host?: string;
    path?: string;
    headers?: Record<string, string>;
    namespace?: string;
    service?: string;
    operation?: string;
    destination?: { host: string; port?: number; protocol?: string };
  };
  identity: {
    subject: string;
    roles?: string[];
    groups?: string[];
    claims?: Record<string, unknown>;
  };
  env: {
    tenantId?: string;
    cluster?: string;
    region?: string;
    stage?: "dev" | "staging" | "prod";
  };
}

// PolicyData: static config/facts
interface PolicyData {
  nsBindings?: Record<string, { groups: string[]; roles?: string[] }>;
  egressAllow?: Record<string, Array<{ host: string; ports?: number[] }>>;
  rbac?: Record<string, { allowOps: string[] }>;
  [key: string]: unknown;
}

// PolicyHelpers: safe, deterministic operations
interface PolicyHelpers {
  all<T>(items: readonly T[], pred: (x: T) => boolean): boolean;
  any<T>(items: readonly T[], pred: (x: T) => boolean): boolean;
  none<T>(items: readonly T[], pred: (x: T) => boolean): boolean;
  count<T>(items: readonly T[], pred: (x: T) => boolean): number;
  match: {
    exact(a?: string, b?: string): boolean;
    prefix(value: string | undefined, prefix: string): boolean;
    glob(value: string | undefined, pattern: string): boolean;
    regex(value: string | undefined, pattern: string): boolean;
  };
  get<T>(obj: unknown, path: string, fallback: T): T;
}

// PolicyModule: a versioned, composable policy
interface PolicyModule {
  id: string;
  version: string;
  description?: string;
  expects?: {
    data?: string[];
    claims?: string[];
  };
  evaluate: (ctx: PolicyContext, data: PolicyData, h: PolicyHelpers) => Decision;
}
```

### 2. `policy-ir` (Intermediate Representation)

Normalized control flow structures for compilation.

```
packages/policy-ir/
├── src/
│   ├── types.ts           # IR node types
│   ├── builder.ts         # Fluent API for building IR
│   ├── optimizer.ts       # Simplify/optimize IR trees
│   └── index.ts
├── __tests__/
```

**IR Types (If/Switch based):**

```typescript
// Condition types
type Condition =
  | { type: "compare"; left: Expression; op: "==" | "!=" | ">" | "<" | ">=" | "<="; right: Expression }
  | { type: "match"; value: Expression; pattern: string; matchType: "exact" | "prefix" | "glob" | "regex" }
  | { type: "in"; value: Expression; list: Expression[] }
  | { type: "exists"; path: string }
  | { type: "and"; conditions: Condition[] }
  | { type: "or"; conditions: Condition[] }
  | { type: "not"; condition: Condition };

// Expression types
type Expression =
  | { type: "literal"; value: string | number | boolean }
  | { type: "path"; path: string }  // e.g., "ctx.request.path"
  | { type: "call"; fn: string; args: Expression[] };

// Statement types (if/switch)
type Statement =
  | { type: "if"; condition: Condition; then: Statement[]; else?: Statement[] }
  | { type: "switch"; value: Expression; cases: Array<{ match: Expression; body: Statement[] }>; default?: Statement[] }
  | { type: "return"; decision: DecisionIR }
  | { type: "assign"; variable: string; value: Expression };

// Decision in IR form
interface DecisionIR {
  effect: "allow" | "deny";
  reasonCode: string;
  reasonMessage: string;
  obligations?: ObligationIR[];
}

interface ObligationIR {
  kind: string;
  args: Record<string, Expression>;
}

// Complete IR program
interface PolicyIR {
  id: string;
  version: string;
  inputs: string[];  // required context paths
  body: Statement[];
}
```

### 3. `nginx-parser` (Parser/Deparser)

Parse and generate Nginx configurations, following docker-parser patterns.

```
packages/nginx-parser/
├── src/
│   ├── types.ts           # Nginx AST types
│   ├── lexer.ts           # Tokenizer
│   ├── parser.ts          # Parser
│   ├── deparser.ts        # Generate config from AST
│   ├── clean.ts           # cleanTree for testing
│   └── index.ts
├── __tests__/
│   ├── parser.test.ts
│   ├── deparser.test.ts
│   └── roundtrip.test.ts
├── __fixtures__/
│   └── nginx/
│       ├── basic/
│       ├── locations/
│       └── upstreams/
└── test-utils/
```

**Nginx AST Types:**

```typescript
interface NginxConfig {
  type: "NginxConfig";
  directives: Directive[];
  blocks: Block[];
}

interface Directive {
  type: "Directive";
  name: string;
  args: string[];
  range?: Range;
}

interface Block {
  type: "Block";
  name: string;
  args: string[];
  directives: Directive[];
  blocks: Block[];
  range?: Range;
}

// Specific block types
interface HttpBlock extends Block {
  name: "http";
}

interface ServerBlock extends Block {
  name: "server";
}

interface LocationBlock extends Block {
  name: "location";
  modifier?: "=" | "~" | "~*" | "^~";
  path: string;
}

interface UpstreamBlock extends Block {
  name: "upstream";
  upstreamName: string;
}

interface IfBlock extends Block {
  name: "if";
  condition: string;
}

interface MapBlock extends Block {
  name: "map";
  source: string;
  variable: string;
}
```

### 4. `policy-to-nginx` (Compiler)

Compile Policy IR to Nginx configuration.

```
packages/policy-to-nginx/
├── src/
│   ├── compiler.ts        # Main compilation logic
│   ├── templates.ts       # Nginx config templates
│   ├── obligations.ts     # Obligation -> Nginx directive mapping
│   └── index.ts
├── __tests__/
```

**Obligation to Nginx Mapping:**

```typescript
// setHeader -> add_header / proxy_set_header
{ kind: "setHeader", args: { name: "X-Namespace", value: "$ns" } }
// => add_header X-Namespace $ns;

// rateLimit -> limit_req_zone + limit_req
{ kind: "rateLimit", args: { zone: "api", rate: "10r/s", burst: 20 } }
// => limit_req zone=api burst=20 nodelay;

// rewrite -> rewrite / return
{ kind: "rewrite", args: { from: "/old", to: "/new", type: "permanent" } }
// => rewrite ^/old$ /new permanent;

// route -> proxy_pass / upstream selection
{ kind: "route", args: { upstream: "backend", path: "/api" } }
// => proxy_pass http://backend;

// log -> access_log with custom format
{ kind: "log", args: { format: "policy", path: "/var/log/nginx/policy.log" } }
// => access_log /var/log/nginx/policy.log policy;
```

**Compilation Strategy:**

Policy conditions compile to Nginx `if` blocks or `map` directives:

```nginx
# From policy condition: ctx.request.path starts with "/api"
map $uri $is_api {
    default 0;
    ~^/api 1;
}

# From policy condition: identity.claims.ns == request.namespace
# (requires external auth module to set $jwt_ns)
if ($jwt_ns != $namespace) {
    return 403;
}

# From obligation: setHeader
add_header X-Policy-Decision "allow";

# From obligation: rateLimit
limit_req zone=policy_limit burst=10 nodelay;
```

## Implementation Order

### Phase 1: Core Types & Runtime
1. Create `policy-engine` package with core types
2. Implement PolicyHelpers (all, any, match, get)
3. Implement runtime evaluator with sandboxing
4. Add tests with example policies

### Phase 2: Nginx Parser/Deparser
1. Create `nginx-parser` package structure
2. Implement lexer (tokenize nginx.conf)
3. Implement parser (tokens -> AST)
4. Implement deparser (AST -> nginx.conf)
5. Add fixtures and round-trip tests

### Phase 3: Intermediate Representation
1. Create `policy-ir` package with IR types
2. Implement IR builder (fluent API)
3. Implement IR optimizer (simplify conditions)
4. Add tests

### Phase 4: Policy to Nginx Compiler
1. Create `policy-to-nginx` package
2. Implement obligation -> directive mapping
3. Implement condition -> if/map compilation
4. Implement full policy -> nginx.conf compilation
5. Add integration tests

### Phase 5: Heterogeneous Integration
1. Add policy-engine as dependency to docker-parser
2. Parse Dockerfile -> extract policy hints from labels/comments
3. Generate nginx.conf from Docker + policy definitions

## Example: End-to-End Flow

**Input: TypeScript Policy**
```typescript
const policy: PolicyModule = {
  id: "api.ratelimit",
  version: "1.0.0",
  evaluate(ctx, data, h) {
    if (h.match.prefix(ctx.request.path, "/api/public")) {
      return {
        effect: "allow",
        reasons: [{ code: "public_api", message: "Public API access" }],
        obligations: [{ kind: "rateLimit", args: { rate: "100r/s" } }]
      };
    }
    if (!ctx.identity.subject) {
      return {
        effect: "deny",
        reasons: [{ code: "unauthenticated", message: "Auth required" }]
      };
    }
    return {
      effect: "allow",
      reasons: [{ code: "authenticated", message: "Authenticated access" }],
      obligations: [
        { kind: "rateLimit", args: { rate: "1000r/s" } },
        { kind: "setHeader", args: { name: "X-User", value: ctx.identity.subject } }
      ]
    };
  }
};
```

**Output: Nginx Config**
```nginx
# Generated from policy: api.ratelimit v1.0.0

limit_req_zone $binary_remote_addr zone=public_api:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=authenticated:10m rate=1000r/s;

server {
    listen 80;
    
    # Public API - rate limited, no auth required
    location ^~ /api/public {
        limit_req zone=public_api burst=50 nodelay;
        proxy_pass http://backend;
    }
    
    # Authenticated API
    location /api {
        # Auth check (assumes auth_request or JWT module)
        auth_request /auth;
        
        # Deny if unauthenticated
        if ($auth_user = "") {
            return 403;
        }
        
        limit_req zone=authenticated burst=100 nodelay;
        add_header X-User $auth_user;
        proxy_pass http://backend;
    }
}
```

## Testing Strategy

1. **Unit Tests**: Each package has isolated tests
2. **Round-Trip Tests**: Parse -> Deparse -> Parse for nginx-parser
3. **Integration Tests**: Policy -> IR -> Nginx -> Validate
4. **Fixture-Based**: Real-world nginx configs and policies

## Open Questions

1. **Runtime vs Compile-time**: Should some policies evaluate at runtime (via Lua/njs) while others compile to static config?
2. **Auth Integration**: How to handle JWT claims in Nginx (auth_request, njs, lua)?
3. **Dynamic Data**: How to handle PolicyData that changes (reload configs vs runtime lookup)?
