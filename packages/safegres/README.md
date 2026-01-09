# safegres

Unified security system for postgres, ingress, and egress policies.

## Overview

Safegres provides a unified type system and helpers for defining security policies that can be compiled to multiple targets:

- **PostgreSQL RLS**: Row-Level Security policies
- **Nginx**: HTTP request filtering, rate limiting, routing
- **Egress**: Outbound connection control

## Installation

```bash
pnpm add safegres
```

## Usage

### Defining Conditions

```typescript
import {
  directOwner,
  membership,
  membershipByField,
  publishable,
  allOf,
  anyOf,
} from 'safegres';

// Owner can access their own records
const ownerCondition = directOwner('owner_id');

// Organization members can read
const orgMemberCondition = membershipByField(
  'entity_id',
  'Organization Member',
  { permission: 'read' }
);

// Published content is public
const publishedCondition = publishable('is_published');

// Combine conditions
const readCondition = anyOf(
  ownerCondition,
  orgMemberCondition,
  publishedCondition
);
```

### Defining Policies

```typescript
import {
  createPolicy,
  createRule,
  postgresTarget,
  directOwner,
  membershipByField,
  publishable,
} from 'safegres';

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
      'allow'
    ),
    createRule(
      'org_members_read',
      ['authenticated'],
      ['select'],
      membershipByField('entity_id', 'Organization Member', { permission: 'read_posts' }),
      'allow'
    ),
    createRule(
      'published_public',
      ['anonymous', 'authenticated'],
      ['select'],
      publishable('is_published'),
      'allow'
    ),
  ]
);
```

### Using Helpers

```typescript
import { helpers, get, any, match } from 'safegres';

// Safe property access
const userId = get(ctx, 'identity.user_id', '');

// Quantifiers
const hasAdminRole = any(ctx.identity.roles ?? [], (r) => r === 'admin');

// String matching
const isApiPath = match.prefix(ctx.request.path, '/api/');
const isAllowedHost = match.glob(ctx.request.host, '*.example.com');
```

## Types

### Condition Types

- **Identity**: `DirectOwner`, `DirectOwnerAny`, `Membership`, `MembershipByField`, `MembershipByJoin`, `OrgHierarchy`
- **Temporal**: `Temporal`, `Publishable`
- **Resource**: `PathMatch`, `HostMatch`, `DestinationMatch`, `NamespaceMatch`, `ServiceMatch`
- **Comparison**: `FieldEquals`, `FieldEqualsField`, `FieldIn`, `FieldNotNull`, `FieldIsNull`
- **Composition**: `AllOf`, `AnyOf`, `Not`, `BoolExpr`
- **Constants**: `True`, `False`

### Obligation Types

- **Shared**: `log`, `mask`
- **Postgres**: `rowFilter`, `columnMask`, `audit`
- **Ingress**: `setHeader`, `rateLimit`, `rewrite`, `route`, `cache`, `cors`, `returnStatus`, `requireAuth`
- **Egress**: `allowDestination`, `denyDestination`, `proxyThrough`

## License

All Rights Reserved - Interweb, Inc.
