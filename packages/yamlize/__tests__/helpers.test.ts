import { namespaceEnvFrom, mergeNullable, job } from '../src';

describe('namespaceEnvFrom', () => {
  it('returns standard secrets and config envFrom entries', () => {
    const result = namespaceEnvFrom('my-namespace');
    expect(result).toEqual([
      { secretRef: { name: 'my-namespace-secrets', optional: true } },
      { configMapRef: { name: 'my-namespace-config', optional: true } },
    ]);
  });

  it('handles hyphenated namespace names', () => {
    const result = namespaceEnvFrom('prod-app-ns');
    expect(result[0]).toEqual({ secretRef: { name: 'prod-app-ns-secrets', optional: true } });
    expect(result[1]).toEqual({ configMapRef: { name: 'prod-app-ns-config', optional: true } });
  });
});

describe('mergeNullable', () => {
  it('null overrides inherit from base', () => {
    const base = { image: 'nginx:v1', replicas: 2, timeout: 300 };
    const overrides: Partial<typeof base> = { image: null as unknown as string, replicas: null as unknown as number, timeout: null as unknown as number };
    const result = mergeNullable(base, overrides);
    expect(result).toEqual(base);
  });

  it('undefined overrides inherit from base', () => {
    const base = { image: 'nginx:v1', replicas: 2 };
    const overrides: Partial<typeof base> = { image: undefined, replicas: undefined };
    const result = mergeNullable(base, overrides);
    expect(result).toEqual(base);
  });

  it('non-null overrides replace base values', () => {
    const base = { image: 'nginx:v1', replicas: 1, timeout: 300 };
    const overrides = { image: 'custom:v2', replicas: 3 };
    const result = mergeNullable(base, overrides);
    expect(result.image).toBe('custom:v2');
    expect(result.replicas).toBe(3);
    expect(result.timeout).toBe(300);
  });

  it('mixed null and non-null overrides work correctly', () => {
    const base = { a: 'base-a', b: 'base-b', c: 'base-c' };
    const overrides: Partial<typeof base> = { a: 'override-a', b: null as unknown as string, c: undefined };
    const result = mergeNullable(base, overrides);
    expect(result.a).toBe('override-a');
    expect(result.b).toBe('base-b');
    expect(result.c).toBe('base-c');
  });
});

describe('job builder', () => {
  it('produces valid Job structure', () => {
    const result = job({
      name: 'build-job',
      namespace: 'ci',
      image: 'node:18',
      command: ['npm', 'run', 'build'],
    });

    expect(result.apiVersion).toBe('batch/v1');
    expect(result.kind).toBe('Job');
    expect(result.metadata.name).toBe('build-job');
    expect(result.metadata.namespace).toBe('ci');
    expect(result.spec!.backoffLimit).toBe(0);

    const template = result.spec!.template as Record<string, unknown>;
    const podSpec = template.spec as Record<string, unknown>;
    expect(podSpec.restartPolicy).toBe('Never');

    const containers = podSpec.containers as Array<Record<string, unknown>>;
    expect(containers).toHaveLength(1);
    expect(containers[0].name).toBe('build-job');
    expect(containers[0].image).toBe('node:18');
    expect(containers[0].command).toEqual(['npm', 'run', 'build']);
  });

  it('includes envFrom for namespace secrets', () => {
    const result = job({
      name: 'my-job',
      namespace: 'ns',
      image: 'img',
      envFrom: [
        { secretRef: { name: 'ns-secrets', optional: true } },
        { configMapRef: { name: 'ns-config', optional: true } },
      ],
    });

    const containers = ((result.spec!.template as Record<string, unknown>).spec as Record<string, unknown>).containers as Array<Record<string, unknown>>;
    expect(containers[0].envFrom).toHaveLength(2);
  });

  it('respects custom backoffLimit and restartPolicy', () => {
    const result = job({
      name: 'retry-job',
      namespace: 'ns',
      image: 'img',
      backoffLimit: 3,
      restartPolicy: 'OnFailure',
    });

    expect(result.spec!.backoffLimit).toBe(3);
    const template = result.spec!.template as Record<string, unknown>;
    const podSpec = template.spec as Record<string, unknown>;
    expect(podSpec.restartPolicy).toBe('OnFailure');
  });
});
