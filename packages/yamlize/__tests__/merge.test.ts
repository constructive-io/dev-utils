import { deployment, merge } from '../src';
import type { K8sManifest } from '../src';

describe('merge', () => {
  it('applies overrides to base manifest', () => {
    const base = deployment({
      name: 'app',
      namespace: 'default',
      image: 'nginx:1.0',
      replicas: 1,
    });

    const result = merge(base, {
      spec: { replicas: 3 } as Record<string, unknown>,
    });

    expect(result.spec!.replicas).toBe(3);
    expect(result.metadata.name).toBe('app');
  });

  it('deep-merges nested objects', () => {
    const base: K8sManifest = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'svc',
        labels: { a: '1', b: '2' },
      },
    };

    const result = merge(base, {
      metadata: { name: 'svc', labels: { b: '3', c: '4' } },
    });

    expect(result.metadata.labels).toEqual({ a: '1', b: '3', c: '4' });
  });

  it('null/undefined overrides are ignored (inherit from base)', () => {
    const base: K8sManifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'app',
        namespace: 'prod',
        labels: { env: 'prod' },
      },
      spec: { replicas: 2 },
    };

    const result = merge(base, {
      metadata: { namespace: undefined, labels: undefined },
      spec: undefined,
    } as Partial<K8sManifest>);

    expect(result.metadata.namespace).toBe('prod');
    expect(result.metadata.labels).toEqual({ env: 'prod' });
    expect(result.spec!.replicas).toBe(2);
  });

  it('replaces arrays entirely (no element-level merge)', () => {
    const base: K8sManifest = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: 'svc' },
      spec: {
        ports: [{ port: 80 }, { port: 443 }],
      },
    };

    const result = merge(base, {
      spec: { ports: [{ port: 8080 }] } as Record<string, unknown>,
    });

    const ports = result.spec!.ports as Array<Record<string, unknown>>;
    expect(ports).toHaveLength(1);
    expect(ports[0].port).toBe(8080);
  });

  it('preserves base fields not present in overrides', () => {
    const base: K8sManifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'app',
        namespace: 'prod',
        annotations: { 'note': 'keep' },
      },
      spec: { replicas: 1 },
    };

    const result = merge(base, {
      metadata: { name: 'app', labels: { new: 'label' } },
    });

    expect(result.metadata.annotations).toEqual({ note: 'keep' });
    expect(result.metadata.labels).toEqual({ new: 'label' });
    expect(result.metadata.namespace).toBe('prod');
  });
});
