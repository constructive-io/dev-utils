import { deployment, ingress, certificate, toYaml, toYamlMulti, fromYaml } from '../src';

describe('toYaml', () => {
  it('serializes a Deployment to YAML', () => {
    const manifest = deployment({
      name: 'web',
      namespace: 'default',
      image: 'nginx:latest',
      replicas: 2,
      labels: {
        'app.kubernetes.io/name': 'web',
        'app.kubernetes.io/instance': 'default-web',
      },
    });

    const yaml = toYaml(manifest);
    expect(yaml).toContain('apiVersion: apps/v1');
    expect(yaml).toContain('kind: Deployment');
    expect(yaml).toContain('name: web');
    expect(yaml).toContain('namespace: default');
    expect(yaml).toContain('replicas: 2');
    expect(yaml).toContain('image: "nginx:latest"');
  });

  it('serializes an Ingress with TLS', () => {
    const manifest = ingress({
      name: 'my-ingress',
      namespace: 'gateway',
      host: 'example.com',
      path: '/api',
      backend: { serviceName: 'api', servicePort: 80 },
      tls: { secretName: 'tls-secret', hosts: ['example.com'] },
    });

    const yaml = toYaml(manifest);
    expect(yaml).toContain('networking.k8s.io/v1');
    expect(yaml).toContain('kind: Ingress');
    expect(yaml).toContain('host: example.com');
    expect(yaml).toContain('secretName: tls-secret');
  });

  it('handles empty arrays as []', () => {
    const yaml = toYaml({
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: 'test' },
      spec: { items: [] },
    });
    expect(yaml).toContain('items: []');
  });
});

describe('toYamlMulti', () => {
  it('joins manifests with --- separator', () => {
    const m1 = deployment({ name: 'a', namespace: 'ns', image: 'img1' });
    const m2 = deployment({ name: 'b', namespace: 'ns', image: 'img2' });

    const yaml = toYamlMulti([m1, m2]);
    expect(yaml).toContain('---');
    expect(yaml).toContain('name: a');
    expect(yaml).toContain('name: b');
  });
});

describe('fromYaml', () => {
  it('round-trips a simple manifest', () => {
    const original = certificate({
      name: 'my-cert',
      namespace: 'gateway',
      dnsNames: ['example.com'],
      issuerRef: { name: 'letsencrypt-prod', kind: 'ClusterIssuer' },
      secretName: 'cert-tls',
    });

    const yaml = toYaml(original);
    const parsed = fromYaml(yaml);

    expect(parsed.apiVersion).toBe('cert-manager.io/v1');
    expect(parsed.kind).toBe('Certificate');
    expect(parsed.metadata.name).toBe('my-cert');
  });

  it('parses scalar types correctly', () => {
    const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  replicas: 3
`;
    const parsed = fromYaml(yaml);
    expect(parsed.apiVersion).toBe('apps/v1');
    expect((parsed.spec as Record<string, unknown>).replicas).toBe(3);
  });
});
