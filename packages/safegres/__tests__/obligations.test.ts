import {
  isLogObligation,
  isMaskObligation,
  isRowFilterObligation,
  isColumnMaskObligation,
  isAuditObligation,
  isSetHeaderObligation,
  isRateLimitObligation,
  isRewriteObligation,
  isRouteObligation,
  isCacheObligation,
  isCorsObligation,
  isReturnStatusObligation,
  isRequireAuthObligation,
  isAllowDestinationObligation,
  isDenyDestinationObligation,
  isProxyThroughObligation,
  isPostgresObligation,
  isIngressObligation,
  isEgressObligation,
  isSharedObligation,
  type SafegresObligation,
} from '../src';

describe('Obligation Type Guards', () => {
  describe('Shared Obligations', () => {
    it('should identify log obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'log',
        args: { level: 'info', message: 'Access granted' },
      };
      expect(isLogObligation(obligation)).toBe(true);
      expect(isSharedObligation(obligation)).toBe(true);
      expect(isPostgresObligation(obligation)).toBe(false);
    });

    it('should identify mask obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'mask',
        args: { fields: ['ssn', 'email'], strategy: 'redact' },
      };
      expect(isMaskObligation(obligation)).toBe(true);
      expect(isSharedObligation(obligation)).toBe(true);
    });
  });

  describe('Postgres Obligations', () => {
    it('should identify rowFilter obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'rowFilter',
        args: { expression: 'status = \'active\'' },
      };
      expect(isRowFilterObligation(obligation)).toBe(true);
      expect(isPostgresObligation(obligation)).toBe(true);
      expect(isIngressObligation(obligation)).toBe(false);
    });

    it('should identify columnMask obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'columnMask',
        args: { column: 'email', mask: '\'***@***.***\'' },
      };
      expect(isColumnMaskObligation(obligation)).toBe(true);
      expect(isPostgresObligation(obligation)).toBe(true);
    });

    it('should identify audit obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'audit',
        args: { action: 'read', table: 'users' },
      };
      expect(isAuditObligation(obligation)).toBe(true);
      expect(isPostgresObligation(obligation)).toBe(true);
    });
  });

  describe('Ingress Obligations', () => {
    it('should identify setHeader obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'setHeader',
        args: { name: 'X-Request-ID', value: '$request_id' },
      };
      expect(isSetHeaderObligation(obligation)).toBe(true);
      expect(isIngressObligation(obligation)).toBe(true);
      expect(isPostgresObligation(obligation)).toBe(false);
    });

    it('should identify rateLimit obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'rateLimit',
        args: { zone: 'api', rate: '10r/s', burst: 20 },
      };
      expect(isRateLimitObligation(obligation)).toBe(true);
      expect(isIngressObligation(obligation)).toBe(true);
    });

    it('should identify rewrite obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'rewrite',
        args: { pattern: '^/old/(.*)', replacement: '/new/$1' },
      };
      expect(isRewriteObligation(obligation)).toBe(true);
      expect(isIngressObligation(obligation)).toBe(true);
    });

    it('should identify route obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'route',
        args: { upstream: 'backend', weight: 100 },
      };
      expect(isRouteObligation(obligation)).toBe(true);
      expect(isIngressObligation(obligation)).toBe(true);
    });

    it('should identify cache obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'cache',
        args: { ttl: 3600, key: '$uri' },
      };
      expect(isCacheObligation(obligation)).toBe(true);
      expect(isIngressObligation(obligation)).toBe(true);
    });

    it('should identify cors obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'cors',
        args: {
          origins: ['https://example.com'],
          methods: ['GET', 'POST'],
          credentials: true,
        },
      };
      expect(isCorsObligation(obligation)).toBe(true);
      expect(isIngressObligation(obligation)).toBe(true);
    });

    it('should identify returnStatus obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'returnStatus',
        args: { status: 403, body: 'Forbidden' },
      };
      expect(isReturnStatusObligation(obligation)).toBe(true);
      expect(isIngressObligation(obligation)).toBe(true);
    });

    it('should identify requireAuth obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'requireAuth',
        args: { realm: 'API', type: 'bearer' },
      };
      expect(isRequireAuthObligation(obligation)).toBe(true);
      expect(isIngressObligation(obligation)).toBe(true);
    });
  });

  describe('Egress Obligations', () => {
    it('should identify allowDestination obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'allowDestination',
        args: { host: 'api.example.com', ports: [443] },
      };
      expect(isAllowDestinationObligation(obligation)).toBe(true);
      expect(isEgressObligation(obligation)).toBe(true);
      expect(isIngressObligation(obligation)).toBe(false);
    });

    it('should identify denyDestination obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'denyDestination',
        args: { host: 'malicious.com', reason: 'Blocked domain' },
      };
      expect(isDenyDestinationObligation(obligation)).toBe(true);
      expect(isEgressObligation(obligation)).toBe(true);
    });

    it('should identify proxyThrough obligations', () => {
      const obligation: SafegresObligation = {
        kind: 'proxyThrough',
        args: { proxy: 'http://proxy.internal:8080' },
      };
      expect(isProxyThroughObligation(obligation)).toBe(true);
      expect(isEgressObligation(obligation)).toBe(true);
    });
  });
});

describe('Obligation Layer Classification', () => {
  it('should correctly classify all postgres obligations', () => {
    const postgresObligations: SafegresObligation[] = [
      { kind: 'rowFilter', args: { expression: 'true' } },
      { kind: 'columnMask', args: { column: 'col', mask: 'mask' } },
      { kind: 'audit', args: { action: 'read', table: 'users' } },
    ];

    postgresObligations.forEach((o) => {
      expect(isPostgresObligation(o)).toBe(true);
      expect(isIngressObligation(o)).toBe(false);
      expect(isEgressObligation(o)).toBe(false);
    });
  });

  it('should correctly classify all ingress obligations', () => {
    const ingressObligations: SafegresObligation[] = [
      { kind: 'setHeader', args: { name: 'X-Test', value: 'test' } },
      { kind: 'rateLimit', args: { zone: 'test', rate: '1r/s' } },
      { kind: 'rewrite', args: { pattern: '/a', replacement: '/b' } },
      { kind: 'route', args: { upstream: 'backend' } },
      { kind: 'cache', args: { ttl: 60 } },
      { kind: 'cors', args: { origins: ['*'] } },
      { kind: 'returnStatus', args: { status: 200 } },
      { kind: 'requireAuth', args: {} },
    ];

    ingressObligations.forEach((o) => {
      expect(isIngressObligation(o)).toBe(true);
      expect(isPostgresObligation(o)).toBe(false);
      expect(isEgressObligation(o)).toBe(false);
    });
  });

  it('should correctly classify all egress obligations', () => {
    const egressObligations: SafegresObligation[] = [
      { kind: 'allowDestination', args: { host: 'example.com' } },
      { kind: 'denyDestination', args: { host: 'blocked.com' } },
      { kind: 'proxyThrough', args: { proxy: 'http://proxy:8080' } },
    ];

    egressObligations.forEach((o) => {
      expect(isEgressObligation(o)).toBe(true);
      expect(isPostgresObligation(o)).toBe(false);
      expect(isIngressObligation(o)).toBe(false);
    });
  });

  it('should correctly classify shared obligations', () => {
    const sharedObligations: SafegresObligation[] = [
      { kind: 'log', args: { level: 'info', message: 'test' } },
      { kind: 'mask', args: { fields: ['email'], strategy: 'redact' } },
    ];

    sharedObligations.forEach((o) => {
      expect(isSharedObligation(o)).toBe(true);
      expect(isPostgresObligation(o)).toBe(false);
      expect(isIngressObligation(o)).toBe(false);
      expect(isEgressObligation(o)).toBe(false);
    });
  });
});
