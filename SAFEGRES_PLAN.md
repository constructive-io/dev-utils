# Safegres: Unified Security System Plan

This document outlines the plan for **safegres** - a unified security system that extends TypeScript-based policy evaluation from postgres (RLS) to ingress and egress layers.

## Overview

Safegres unifies three security domains under a single policy model:

1. **Postgres (RLS)**: Row-Level Security policies controlling database access
2. **Ingress**: HTTP request filtering, rate limiting, routing
3. **Egress**: Outbound connection control, destination allowlists

The system combines the existing PolicyEngine types with RLS AST node types from constructive-db into a unified schema that can compile to multiple targets (PostgreSQL RLS, Nginx, Envoy, etc.).

## Design Principles

1. **Single Source of Truth**: Define access rules once, compile to multiple targets
2. **Intent-Based**: Rules describe business intent, not implementation details
3. **Composable**: Conditions can be combined with AND/OR/NOT logic
4. **Type-Safe**: Full TypeScript type definitions for all constructs
5. **Deterministic**: Pure functions with no side effects during evaluation
6. **Auditable**: Clear mapping from business rules to technical implementation

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │         SafegresPolicy              │
                    │  (Unified Policy Definition)        │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
    │  PostgreSQL     │     │     Nginx       │     │     Envoy       │
    │  Compiler       │     │    Compiler     │     │    Compiler     │
    └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
             │                       │                       │
             ▼                       ▼                       ▼
    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
    │  CREATE POLICY  │     │   nginx.conf    │     │   xDS Config    │
    │  SQL Statements │     │   Directives    │     │   (Future)      │
    └─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Unified Type System

### Core Types

These types are shared across all security layers:

```typescript
// Effect represents the outcome of a policy decision
type Effect = 'allow' | 'deny';

// Reason explains why a decision was made
interface Reason {
  code: string;           // Stable identifier for analytics
  message: string;        // Human-readable explanation
  path?: string;          // Context field path (e.g., "request.path")
  meta?: Record<string, unknown>;
}

// Decision is the result of policy evaluation
interface Decision {
  effect: Effect;
  reasons: Reason[];
  obligations?: Obligation[];
  trace?: TraceStep[];
}
```

### Condition Node Types

Conditions are the core building blocks for expressing access control logic. They are designed to work across all three layers (postgres, ingress, egress).

#### Identity Conditions (Who can access)

```typescript
// Direct user ID comparison
// Postgres: owner_id = current_user_id()
// Ingress: subject = ctx.identity.subject
interface DirectOwner {
  entity_field: string;
}

// Multiple ownership fields (OR logic)
// Postgres: sender_id = current_user_id() OR receiver_id = current_user_id()
interface DirectOwnerAny {
  entity_fields: string[];
}

// Role/group membership check
// Postgres: EXISTS (SELECT 1 FROM sprt WHERE actor_id = current_user_id() AND ...)
// Ingress: ctx.identity.roles.includes(role)
interface Membership {
  membership_type: 'App Member' | 'Organization Member' | 'Group Member' | number;
  permission?: string;
  is_admin?: boolean;
  is_owner?: boolean;
}

// Scoped membership with entity binding
// Postgres: entity_id IN (SELECT entity_id FROM sprt WHERE actor_id = current_user_id())
interface MembershipByField {
  entity_field: string;
  membership_type: 'App Member' | 'Organization Member' | 'Group Member' | number;
  permission?: string;
  is_admin?: boolean;
  is_owner?: boolean;
}

// JOIN-based membership through related tables
interface MembershipByJoin {
  entity_field: string;
  obj_table_id?: string;
  obj_table?: string;
  obj_schema?: string;
  obj_field_id?: string;
  obj_field?: string;
  membership_type: 'App Member' | 'Organization Member' | 'Group Member' | number;
  permission?: string;
}

// Hierarchical visibility using closure table
// Postgres: EXISTS (SELECT 1 FROM hierarchy_sprt WHERE ...)
interface OrgHierarchy {
  direction: 'up' | 'down';
  entity_field?: string;  // Default: 'entity_id'
  anchor_field: string;
  max_depth?: number;
}
```

#### Temporal Conditions (When access is valid)

```typescript
// Time-window based access control
// Postgres: publish_at <= now() AND (expires_at IS NULL OR expires_at > now())
interface Temporal {
  valid_from_field?: string;
  valid_until_field?: string;
  valid_from_inclusive?: boolean;  // Default: true
  valid_until_inclusive?: boolean; // Default: false
}

// Published content visibility
interface Publishable {
  is_published_field: string;
}
```

#### Resource Conditions (What can be accessed)

```typescript
// URL path matching (ingress)
interface PathMatch {
  pattern: string;  // Glob or regex
  method?: string;  // HTTP method filter
}

// Host/domain matching (ingress/egress)
interface HostMatch {
  pattern: string;  // Glob pattern (e.g., "*.example.com")
}

// Egress destination rules
interface DestinationMatch {
  host: string;
  ports?: number[];
  protocol?: string;
}
```

#### Composition Conditions

```typescript
// Boolean expression composition
interface BoolExpr {
  boolop: 'AND_EXPR' | 'OR_EXPR' | 'NOT_EXPR';
  args: SafegresCondition[];
}

// Shorthand for OR composition
type AnyOf = SafegresCondition[];

// Shorthand for AND composition
type AllOf = SafegresCondition[];

// Negation
type Not = SafegresCondition;

// Constant conditions
interface True {}
interface False {}
```

### Unified Condition Type

```typescript
type SafegresCondition =
  // Identity conditions
  | { DirectOwner: DirectOwner }
  | { DirectOwnerAny: DirectOwnerAny }
  | { Membership: Membership }
  | { MembershipByField: MembershipByField }
  | { MembershipByJoin: MembershipByJoin }
  | { OrgHierarchy: OrgHierarchy }
  // Temporal conditions
  | { Temporal: Temporal }
  | { Publishable: Publishable }
  // Resource conditions (ingress/egress)
  | { PathMatch: PathMatch }
  | { HostMatch: HostMatch }
  | { DestinationMatch: DestinationMatch }
  // Composition
  | { BoolExpr: BoolExpr }
  | { AnyOf: SafegresCondition[] }
  | { AllOf: SafegresCondition[] }
  | { Not: SafegresCondition }
  // Constants
  | { True: {} }
  | { False: {} };
```

### Obligation Types

Obligations are side effects applied after a decision. They are layer-specific:

```typescript
type SafegresObligation =
  // Shared obligations
  | { kind: 'log'; args: { level: string; message: string; fields?: Record<string, unknown> } }
  | { kind: 'mask'; args: { fields: string[]; strategy: 'redact' | 'hash' | 'partial' } }
  // Postgres-specific
  | { kind: 'rowFilter'; args: { expression: string } }
  | { kind: 'columnMask'; args: { column: string; mask: string } }
  | { kind: 'audit'; args: { action: string; table: string } }
  // Ingress-specific
  | { kind: 'setHeader'; args: { name: string; value: string } }
  | { kind: 'rateLimit'; args: { zone: string; rate: string; burst?: number } }
  | { kind: 'rewrite'; args: { pattern: string; replacement: string } }
  | { kind: 'route'; args: { upstream: string; weight?: number } }
  | { kind: 'cache'; args: { ttl: number; key?: string } }
  | { kind: 'cors'; args: { origins: string[]; methods?: string[]; headers?: string[] } }
  // Egress-specific
  | { kind: 'allowDestination'; args: { host: string; ports?: number[] } }
  | { kind: 'denyDestination'; args: { host: string; reason?: string } };
```

### Policy and Rule Types

```typescript
// Target specifies where a policy applies
interface SafegresTarget {
  layer: 'postgres' | 'ingress' | 'egress';
  // Postgres targets
  schema?: string;
  table?: string;
  // Ingress/egress targets
  host?: string;
  path?: string;
  destination?: string;
}

// Rule defines a single access pattern
interface SafegresRule {
  name: string;
  description?: string;
  // Who: actors this rule applies to
  actors: string[];  // Role names (e.g., 'authenticated', 'anonymous', 'admin')
  // What: actions/privileges
  actions: string[];  // Postgres: select/insert/update/delete, HTTP: get/post/put/delete
  // When: condition that must be true
  condition: SafegresCondition;
  // Effect: allow or deny
  effect: Effect;
  // Side effects
  obligations?: SafegresObligation[];
  // Options
  permissive?: boolean;  // Default: true
  disabled?: boolean;
}

// Policy is a versioned, composable policy unit
interface SafegresPolicy {
  id: string;
  version: string;
  description?: string;
  // Where this policy applies
  target: SafegresTarget;
  // Access rules
  rules: SafegresRule[];
  // Metadata
  tags?: string[];
}
```

### Context Types

```typescript
// Unified context for policy evaluation
interface SafegresContext {
  // Request information
  request: {
    id: string;
    time: string;
    ip?: string;
    method?: string;
    host?: string;
    path?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
    // Kubernetes/mesh
    namespace?: string;
    service?: string;
    operation?: string;
    // Egress
    destination?: { host: string; port?: number; protocol?: string };
  };
  // Identity information
  identity: {
    subject: string;
    roles?: string[];
    groups?: string[];
    claims?: Record<string, unknown>;
    // Postgres-specific (from JWT claims)
    user_id?: string;
    database_id?: string;
  };
  // Environment
  env: {
    tenantId?: string;
    cluster?: string;
    region?: string;
    stage?: 'dev' | 'staging' | 'prod';
    vars?: Record<string, string>;
  };
}
```

## Package Structure

```
packages/
├── safegres/                    # Core unified types and runtime
│   ├── src/
│   │   ├── types/
│   │   │   ├── core.ts          # Effect, Decision, Reason
│   │   │   ├── conditions.ts    # All condition node types
│   │   │   ├── obligations.ts   # All obligation types
│   │   │   ├── policy.ts        # SafegresPolicy, SafegresRule
│   │   │   ├── context.ts       # SafegresContext
│   │   │   └── index.ts
│   │   ├── helpers/
│   │   │   ├── match.ts         # String matching (exact, prefix, glob, regex)
│   │   │   ├── quantifiers.ts   # all, any, none, count, find
│   │   │   ├── access.ts        # get, defined, empty, includes
│   │   │   └── index.ts
│   │   ├── evaluator/
│   │   │   ├── evaluate.ts      # Runtime policy evaluation
│   │   │   ├── validator.ts     # Policy validation
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── package.json
│   └── README.md
│
├── safegres-postgres/           # PostgreSQL RLS compiler
│   ├── src/
│   │   ├── compiler.ts          # SafegresPolicy -> SQL
│   │   ├── ast.ts               # AST generation helpers
│   │   ├── deparser.ts          # AST -> SQL string
│   │   └── index.ts
│   ├── package.json
│   └── README.md
│
├── safegres-nginx/              # Nginx compiler (uses nginx-parser)
│   ├── src/
│   │   ├── compiler.ts          # SafegresPolicy -> Nginx AST
│   │   └── index.ts
│   ├── package.json
│   └── README.md
│
├── policy-engine/               # (existing) Runtime evaluation
├── nginx-parser/                # (existing) Nginx parser/deparser
├── docker-parser/               # (existing) Dockerfile parser
└── bash-parser/                 # (existing) Bash parser
```

## Implementation Phases

### Phase 1: Repository Setup and Core Types

1. Rename repository from `dockerjs` to `safegres`
2. Update all package licenses to "All Rights Reserved, Interweb, Inc."
3. Set all packages to `publishConfig: { access: "restricted" }`
4. Create `safegres` package with unified types
5. Export all condition node types
6. Export all obligation types
7. Export policy and rule types

### Phase 2: Helpers and Evaluation

1. Port helpers from policy-engine to safegres
2. Extend helpers with RLS-specific operations:
   - `membershipCheck`: Check SPRT membership
   - `hierarchyCheck`: Check org hierarchy visibility
   - `temporalCheck`: Check time-window constraints
3. Implement condition evaluator for runtime evaluation
4. Implement policy validator

### Phase 3: PostgreSQL Compiler

1. Create `safegres-postgres` package
2. Implement condition-to-AST transformation:
   - `DirectOwner` -> `col = current_user_id()`
   - `Membership` -> `EXISTS (SELECT 1 FROM sprt ...)`
   - `MembershipByField` -> `field IN (SELECT entity_id FROM sprt ...)`
   - `OrgHierarchy` -> `EXISTS (SELECT 1 FROM hierarchy_sprt ...)`
   - `Temporal` -> `field <= now() AND ...`
   - `BoolExpr` -> `AND/OR/NOT` composition
3. Implement AST deparser (SQL generation)
4. Generate CREATE POLICY statements

### Phase 4: Nginx Compiler

1. Create `safegres-nginx` package
2. Implement condition-to-Nginx transformation:
   - `PathMatch` -> `location` blocks
   - `HostMatch` -> `server_name` directives
   - `Membership` -> `if` blocks with variable checks
3. Implement obligation-to-Nginx transformation:
   - `setHeader` -> `add_header`, `proxy_set_header`
   - `rateLimit` -> `limit_req_zone`, `limit_req`
   - `rewrite` -> `rewrite`, `return`
   - `route` -> `proxy_pass`, upstream selection
   - `cache` -> `proxy_cache` directives
   - `cors` -> CORS headers

### Phase 5: Integration and Testing

1. Create comprehensive test fixtures
2. Test round-trip: Policy -> Postgres SQL -> verify
3. Test round-trip: Policy -> Nginx config -> verify
4. Integration tests with constructive-db patterns
5. Performance benchmarks

## Example: Unified Policy Definition

```typescript
const postsAccessPolicy: SafegresPolicy = {
  id: 'constructive.posts.access',
  version: '1.0.0',
  description: 'Access rules for the posts table',
  target: {
    layer: 'postgres',
    schema: 'public',
    table: 'posts'
  },
  rules: [
    // Owners have full access
    {
      name: 'owner_full_access',
      actors: ['authenticated'],
      actions: ['select', 'insert', 'update', 'delete'],
      condition: { DirectOwner: { entity_field: 'owner_id' } },
      effect: 'allow'
    },
    // Org members can read
    {
      name: 'org_members_read',
      actors: ['authenticated'],
      actions: ['select'],
      condition: {
        MembershipByField: {
          entity_field: 'entity_id',
          membership_type: 'Organization Member',
          permission: 'read_posts'
        }
      },
      effect: 'allow'
    },
    // Admins can edit any post in their org
    {
      name: 'org_admins_edit',
      actors: ['authenticated'],
      actions: ['update', 'delete'],
      condition: {
        MembershipByField: {
          entity_field: 'entity_id',
          membership_type: 'Organization Member',
          is_admin: true
        }
      },
      effect: 'allow'
    },
    // Published posts are public
    {
      name: 'published_public',
      actors: ['anonymous', 'authenticated'],
      actions: ['select'],
      condition: { Publishable: { is_published_field: 'is_published' } },
      effect: 'allow'
    }
  ]
};
```

### Compiled to PostgreSQL RLS

```sql
-- owner_full_access
CREATE POLICY posts_access_owner_full_access_sel ON public.posts
  FOR SELECT TO authenticated
  USING (owner_id = jwt_public.current_user_id());

CREATE POLICY posts_access_owner_full_access_ins ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = jwt_public.current_user_id());

CREATE POLICY posts_access_owner_full_access_upd ON public.posts
  FOR UPDATE TO authenticated
  USING (owner_id = jwt_public.current_user_id());

CREATE POLICY posts_access_owner_full_access_del ON public.posts
  FOR DELETE TO authenticated
  USING (owner_id = jwt_public.current_user_id());

-- org_members_read
CREATE POLICY posts_access_org_members_read_sel ON public.posts
  FOR SELECT TO authenticated
  USING (entity_id IN (
    SELECT org_sprt.entity_id 
    FROM private.org_sprt 
    WHERE org_sprt.actor_id = jwt_public.current_user_id()
      AND (org_sprt.permissions & B'00000001') = B'00000001'
  ));

-- org_admins_edit
CREATE POLICY posts_access_org_admins_edit_upd ON public.posts
  FOR UPDATE TO authenticated
  USING (entity_id IN (
    SELECT org_sprt.entity_id 
    FROM private.org_sprt 
    WHERE org_sprt.actor_id = jwt_public.current_user_id()
      AND org_sprt.is_admin = true
  ));

CREATE POLICY posts_access_org_admins_edit_del ON public.posts
  FOR DELETE TO authenticated
  USING (entity_id IN (
    SELECT org_sprt.entity_id 
    FROM private.org_sprt 
    WHERE org_sprt.actor_id = jwt_public.current_user_id()
      AND org_sprt.is_admin = true
  ));

-- published_public
CREATE POLICY posts_access_published_public_sel ON public.posts
  FOR SELECT TO anonymous, authenticated
  USING (is_published = true);
```

## Example: Ingress Policy

```typescript
const apiIngressPolicy: SafegresPolicy = {
  id: 'constructive.api.ingress',
  version: '1.0.0',
  description: 'API ingress rules',
  target: {
    layer: 'ingress',
    host: 'api.example.com'
  },
  rules: [
    // Rate limit all requests
    {
      name: 'global_rate_limit',
      actors: ['*'],
      actions: ['*'],
      condition: { True: {} },
      effect: 'allow',
      obligations: [
        { kind: 'rateLimit', args: { zone: 'api', rate: '100r/s', burst: 50 } }
      ]
    },
    // Admin endpoints require admin role
    {
      name: 'admin_only',
      actors: ['admin'],
      actions: ['*'],
      condition: { PathMatch: { pattern: '/admin/*' } },
      effect: 'allow'
    },
    // Public health check
    {
      name: 'health_check',
      actors: ['*'],
      actions: ['get'],
      condition: { PathMatch: { pattern: '/health' } },
      effect: 'allow'
    }
  ]
};
```

### Compiled to Nginx

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;

server {
    server_name api.example.com;
    
    # Global rate limit
    limit_req zone=api burst=50 nodelay;
    
    # Admin endpoints
    location /admin/ {
        if ($jwt_claim_role != "admin") {
            return 403;
        }
        proxy_pass http://backend;
    }
    
    # Health check (public)
    location = /health {
        return 200 "OK";
    }
    
    # Default backend
    location / {
        proxy_pass http://backend;
    }
}
```

## Example: Egress Policy

```typescript
const egressPolicy: SafegresPolicy = {
  id: 'constructive.egress.allowlist',
  version: '1.0.0',
  description: 'Egress allowlist for production namespace',
  target: {
    layer: 'egress',
    destination: '*'
  },
  rules: [
    // Allow S3 access
    {
      name: 'allow_s3',
      actors: ['*'],
      actions: ['connect'],
      condition: { HostMatch: { pattern: '*.s3.amazonaws.com' } },
      effect: 'allow'
    },
    // Allow database connections
    {
      name: 'allow_database',
      actors: ['*'],
      actions: ['connect'],
      condition: {
        DestinationMatch: {
          host: 'db.internal',
          ports: [5432]
        }
      },
      effect: 'allow'
    },
    // Deny all other egress
    {
      name: 'deny_default',
      actors: ['*'],
      actions: ['*'],
      condition: { True: {} },
      effect: 'deny',
      obligations: [
        { kind: 'log', args: { level: 'warn', message: 'Blocked egress attempt' } }
      ]
    }
  ]
};
```

## Migration from Existing Systems

### From policy-engine

The existing `policy-engine` package will be preserved for backward compatibility. New code should use `safegres` directly. The migration path:

1. Import types from `safegres` instead of `policy-engine`
2. Convert `PolicyModule.evaluate` to `SafegresPolicy.rules`
3. Use condition nodes instead of imperative code

### From constructive-db RLS

The existing RLS system in constructive-db uses JSONB policy definitions. These map directly to safegres conditions:

| constructive-db | safegres |
|-----------------|----------|
| `direct_owner` template | `DirectOwner` condition |
| `direct_owner_any` template | `DirectOwnerAny` condition |
| `membership` template | `Membership` condition |
| `membership_by_field` template | `MembershipByField` condition |
| `membership_by_join` template | `MembershipByJoin` condition |
| `ast` template with `OrgHierarchy` | `OrgHierarchy` condition |
| `ast` template with `Temporal` | `Temporal` condition |
| `BoolExpr` with `AND_EXPR` | `AllOf` or `BoolExpr` |
| `BoolExpr` with `OR_EXPR` | `AnyOf` or `BoolExpr` |

## Related Documents

- [POLICY_ENGINE_PLAN.md](./POLICY_ENGINE_PLAN.md) - Original policy engine design
- [constructive-db RLS_POLICY_TYPES.md](../constructive-db/docs/RLS_POLICY_TYPES.md) - RLS policy benchmarks
- [constructive-db SPRT_TABLES.md](../constructive-db/docs/spec/04-sprt-shadow-tables.md) - SPRT architecture
- [constructive-db Rule Sets](../constructive-db/docs/spec/08-rule-sets.md) - Rule sets specification

## License

All Rights Reserved, Interweb, Inc.
