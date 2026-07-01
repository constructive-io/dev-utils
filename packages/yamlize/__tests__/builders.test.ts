import {
  deployment,
  statefulSet,
  service,
  ingress,
  certificate,
  configMap,
  secret,
  namespace,
} from '../src';

describe('deployment', () => {
  it('produces valid Deployment structure', () => {
    const result = deployment({
      name: 'my-app',
      namespace: 'default',
      image: 'nginx:latest',
      replicas: 3,
      ports: [{ name: 'http', containerPort: 8080, protocol: 'TCP' }],
      labels: {
        'app.kubernetes.io/name': 'my-app',
        'app.kubernetes.io/instance': 'default-my-app',
      },
    });

    expect(result.apiVersion).toBe('apps/v1');
    expect(result.kind).toBe('Deployment');
    expect(result.metadata.name).toBe('my-app');
    expect(result.metadata.namespace).toBe('default');
    expect(result.spec!.replicas).toBe(3);

    const template = result.spec!.template as Record<string, unknown>;
    const podSpec = template.spec as Record<string, unknown>;
    const containers = podSpec.containers as Array<Record<string, unknown>>;
    expect(containers).toHaveLength(1);
    expect(containers[0].name).toBe('my-app');
    expect(containers[0].image).toBe('nginx:latest');
  });

  it('sets selector from app.kubernetes.io labels', () => {
    const result = deployment({
      name: 'web',
      namespace: 'prod',
      image: 'web:v1',
      labels: {
        'app.kubernetes.io/name': 'web',
        'app.kubernetes.io/instance': 'prod-web',
        'app.kubernetes.io/managed-by': 'constructive-db',
      },
    });

    const selector = result.spec!.selector as Record<string, unknown>;
    const matchLabels = selector.matchLabels as Record<string, string>;
    expect(matchLabels['app.kubernetes.io/name']).toBe('web');
    expect(matchLabels['app.kubernetes.io/instance']).toBe('prod-web');
    expect(matchLabels['app.kubernetes.io/managed-by']).toBeUndefined();
  });

  it('includes envFrom when specified', () => {
    const result = deployment({
      name: 'app',
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

  it('includes health probes when healthCheck is provided', () => {
    const result = deployment({
      name: 'app',
      namespace: 'ns',
      image: 'img',
      healthCheck: { httpGet: { path: '/healthz', port: 8080 } },
    });

    const containers = ((result.spec!.template as Record<string, unknown>).spec as Record<string, unknown>).containers as Array<Record<string, unknown>>;
    expect(containers[0].livenessProbe).toBeDefined();
    expect(containers[0].readinessProbe).toBeDefined();
  });

  it('omits empty optional fields', () => {
    const result = deployment({
      name: 'minimal',
      namespace: 'default',
      image: 'alpine',
    });

    const containers = ((result.spec!.template as Record<string, unknown>).spec as Record<string, unknown>).containers as Array<Record<string, unknown>>;
    expect(containers[0].command).toBeUndefined();
    expect(containers[0].args).toBeUndefined();
    expect(containers[0].livenessProbe).toBeUndefined();
    expect(containers[0].resources).toBeUndefined();
  });

  it('includes terminationGracePeriodSeconds', () => {
    const result = deployment({
      name: 'app',
      namespace: 'ns',
      image: 'img',
      terminationGracePeriodSeconds: 60,
    });

    const podSpec = ((result.spec!.template as Record<string, unknown>).spec as Record<string, unknown>);
    expect(podSpec.terminationGracePeriodSeconds).toBe(60);
  });

  it('includes imagePullPolicy', () => {
    const result = deployment({
      name: 'app',
      namespace: 'ns',
      image: 'img',
      imagePullPolicy: 'IfNotPresent',
    });

    const containers = ((result.spec!.template as Record<string, unknown>).spec as Record<string, unknown>).containers as Array<Record<string, unknown>>;
    expect(containers[0].imagePullPolicy).toBe('IfNotPresent');
  });
});

describe('statefulSet', () => {
  it('produces valid StatefulSet with PVC', () => {
    const result = statefulSet({
      name: 'db',
      namespace: 'data',
      image: 'postgres:15',
      storageClass: 'standard',
      storageSize: '20Gi',
      labels: {
        'app.kubernetes.io/name': 'db',
        'app.kubernetes.io/instance': 'data-db',
      },
    });

    expect(result.apiVersion).toBe('apps/v1');
    expect(result.kind).toBe('StatefulSet');
    expect(result.spec!.serviceName).toBe('db');

    const vcts = result.spec!.volumeClaimTemplates as Array<Record<string, unknown>>;
    expect(vcts).toHaveLength(1);
    const vctSpec = vcts[0].spec as Record<string, unknown>;
    expect(vctSpec.storageClassName).toBe('standard');
    expect((vctSpec.resources as Record<string, unknown>).requests).toEqual({ storage: '20Gi' });
  });

  it('includes data volume mount by default', () => {
    const result = statefulSet({
      name: 'db',
      namespace: 'data',
      image: 'postgres:15',
      storageClass: 'ssd',
      storageSize: '10Gi',
    });

    const containers = ((result.spec!.template as Record<string, unknown>).spec as Record<string, unknown>).containers as Array<Record<string, unknown>>;
    const mounts = containers[0].volumeMounts as Array<Record<string, unknown>>;
    expect(mounts).toContainEqual({ name: 'data', mountPath: '/data' });
  });

  it('respects custom volumeMountPath', () => {
    const result = statefulSet({
      name: 'db',
      namespace: 'data',
      image: 'postgres:15',
      storageClass: 'ssd',
      storageSize: '10Gi',
      volumeMountPath: '/var/lib/postgresql',
    });

    const containers = ((result.spec!.template as Record<string, unknown>).spec as Record<string, unknown>).containers as Array<Record<string, unknown>>;
    const mounts = containers[0].volumeMounts as Array<Record<string, unknown>>;
    expect(mounts).toContainEqual({ name: 'data', mountPath: '/var/lib/postgresql' });
  });
});

describe('service', () => {
  it('produces valid Service structure', () => {
    const result = service({
      name: 'my-svc',
      namespace: 'default',
      selector: { 'app.kubernetes.io/name': 'my-app' },
      ports: [{ name: 'http', port: 80, targetPort: 8080 }],
    });

    expect(result.apiVersion).toBe('v1');
    expect(result.kind).toBe('Service');
    expect(result.spec!.type).toBe('ClusterIP');
    expect(result.spec!.selector).toEqual({ 'app.kubernetes.io/name': 'my-app' });
  });
});

describe('ingress', () => {
  it('produces valid Ingress structure', () => {
    const result = ingress({
      name: 'my-ingress',
      namespace: 'default',
      host: 'example.com',
      path: '/api',
      backend: { serviceName: 'api-svc', servicePort: 80 },
    });

    expect(result.apiVersion).toBe('networking.k8s.io/v1');
    expect(result.kind).toBe('Ingress');

    const rules = result.spec!.rules as Array<Record<string, unknown>>;
    expect(rules).toHaveLength(1);
    expect(rules[0].host).toBe('example.com');
  });

  it('includes TLS when specified', () => {
    const result = ingress({
      name: 'tls-ingress',
      namespace: 'default',
      host: 'secure.example.com',
      backend: { serviceName: 'svc', servicePort: 443 },
      tls: { secretName: 'tls-cert', hosts: ['secure.example.com'] },
    });

    expect(result.spec!.tls).toBeDefined();
    const tls = result.spec!.tls as Array<Record<string, unknown>>;
    expect(tls[0].secretName).toBe('tls-cert');
  });
});

describe('certificate', () => {
  it('produces valid cert-manager Certificate', () => {
    const result = certificate({
      name: 'my-cert',
      namespace: 'gateway',
      dnsNames: ['example.com', '*.example.com'],
      issuerRef: { name: 'letsencrypt-prod', kind: 'ClusterIssuer' },
      secretName: 'my-cert-tls',
    });

    expect(result.apiVersion).toBe('cert-manager.io/v1');
    expect(result.kind).toBe('Certificate');
    expect(result.spec!.secretName).toBe('my-cert-tls');
    expect(result.spec!.dnsNames).toEqual(['example.com', '*.example.com']);
    expect(result.spec!.issuerRef).toEqual({
      name: 'letsencrypt-prod',
      kind: 'ClusterIssuer',
    });
  });
});

describe('configMap', () => {
  it('produces valid ConfigMap', () => {
    const result = configMap({
      name: 'my-config',
      namespace: 'default',
      data: { KEY: 'value' },
    });

    expect(result.apiVersion).toBe('v1');
    expect(result.kind).toBe('ConfigMap');
  });
});

describe('secret', () => {
  it('produces valid Secret', () => {
    const result = secret({
      name: 'my-secret',
      namespace: 'default',
      type: 'Opaque',
      stringData: { password: 'secret123' },
    });

    expect(result.apiVersion).toBe('v1');
    expect(result.kind).toBe('Secret');
    expect(result.spec!.type).toBe('Opaque');
  });
});

describe('namespace', () => {
  it('produces valid Namespace', () => {
    const result = namespace({
      name: 'my-ns',
      labels: { 'team': 'backend' },
    });

    expect(result.apiVersion).toBe('v1');
    expect(result.kind).toBe('Namespace');
    expect(result.metadata.name).toBe('my-ns');
    expect(result.metadata.labels).toEqual({ team: 'backend' });
  });
});
