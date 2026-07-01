import type {
  K8sManifest,
  DeploymentOpts,
  StatefulSetOpts,
  ServiceOpts,
  IngressOpts,
  CertificateOpts,
  ConfigMapOpts,
  SecretOpts,
  NamespaceOpts,
  JobOpts,
  PortSpec,
  HealthCheckSpec,
} from './types';

function buildContainerPorts(ports: PortSpec[]): Array<Record<string, unknown>> {
  return ports.map((p) => ({
    ...(p.name ? { name: p.name } : {}),
    containerPort: p.containerPort,
    ...(p.protocol ? { protocol: p.protocol } : {}),
  }));
}

function buildProbe(
  check: HealthCheckSpec | Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!check || Object.keys(check).length === 0) return undefined;
  return check as Record<string, unknown>;
}

function nonEmpty<T>(arr: T[] | undefined): T[] | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr;
}

function nonEmptyObj(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!obj || Object.keys(obj).length === 0) return undefined;
  return obj;
}

export function deployment(opts: DeploymentOpts): K8sManifest {
  const container: Record<string, unknown> = {
    name: opts.name,
    image: opts.image,
    ...(opts.imagePullPolicy ? { imagePullPolicy: opts.imagePullPolicy } : {}),
    ...(opts.ports && opts.ports.length > 0 ? { ports: buildContainerPorts(opts.ports) } : {}),
    ...(nonEmptyObj(opts.resources as Record<string, unknown>) ? { resources: opts.resources } : {}),
    ...(opts.envFrom ? { envFrom: opts.envFrom } : {}),
    ...(opts.env ? { env: opts.env } : {}),
    ...(nonEmpty(opts.command) ? { command: opts.command } : {}),
    ...(nonEmpty(opts.args) ? { args: opts.args } : {}),
    ...(buildProbe(opts.healthCheck) ? { livenessProbe: buildProbe(opts.healthCheck) } : {}),
    ...(buildProbe(opts.healthCheck) ? { readinessProbe: buildProbe(opts.healthCheck) } : {}),
    ...(opts.volumeMounts ? { volumeMounts: opts.volumeMounts } : {}),
  };

  const selectorLabels: Record<string, string> = {};
  if (opts.labels) {
    if (opts.labels['app.kubernetes.io/name']) {
      selectorLabels['app.kubernetes.io/name'] = opts.labels['app.kubernetes.io/name'];
    }
    if (opts.labels['app.kubernetes.io/instance']) {
      selectorLabels['app.kubernetes.io/instance'] = opts.labels['app.kubernetes.io/instance'];
    }
  }
  if (Object.keys(selectorLabels).length === 0 && opts.labels) {
    Object.assign(selectorLabels, opts.labels);
  }

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
      ...(opts.labels ? { labels: { ...opts.labels } } : {}),
      ...(opts.annotations ? { annotations: { ...opts.annotations } } : {}),
    },
    spec: {
      replicas: opts.replicas ?? 1,
      selector: {
        matchLabels: { ...selectorLabels },
      },
      template: {
        metadata: {
          labels: opts.labels ? { ...opts.labels } : {},
        },
        spec: {
          ...(opts.terminationGracePeriodSeconds !== undefined
            ? { terminationGracePeriodSeconds: opts.terminationGracePeriodSeconds }
            : {}),
          containers: [container],
          ...(opts.volumes ? { volumes: opts.volumes } : {}),
        },
      },
    },
  };
}

export function statefulSet(opts: StatefulSetOpts): K8sManifest {
  const mountPath = opts.volumeMountPath ?? '/data';

  const baseVolumeMounts = [{ name: 'data', mountPath }];
  const allVolumeMounts = opts.volumeMounts
    ? [...baseVolumeMounts, ...opts.volumeMounts]
    : baseVolumeMounts;

  const container: Record<string, unknown> = {
    name: opts.name,
    image: opts.image,
    ...(opts.imagePullPolicy ? { imagePullPolicy: opts.imagePullPolicy } : {}),
    ...(opts.ports && opts.ports.length > 0 ? { ports: buildContainerPorts(opts.ports) } : {}),
    ...(nonEmptyObj(opts.resources as Record<string, unknown>) ? { resources: opts.resources } : {}),
    ...(opts.envFrom ? { envFrom: opts.envFrom } : {}),
    ...(opts.env ? { env: opts.env } : {}),
    ...(nonEmpty(opts.command) ? { command: opts.command } : {}),
    ...(nonEmpty(opts.args) ? { args: opts.args } : {}),
    ...(buildProbe(opts.healthCheck) ? { livenessProbe: buildProbe(opts.healthCheck) } : {}),
    ...(buildProbe(opts.healthCheck) ? { readinessProbe: buildProbe(opts.healthCheck) } : {}),
    volumeMounts: allVolumeMounts,
  };

  const selectorLabels: Record<string, string> = {};
  if (opts.labels) {
    if (opts.labels['app.kubernetes.io/name']) {
      selectorLabels['app.kubernetes.io/name'] = opts.labels['app.kubernetes.io/name'];
    }
    if (opts.labels['app.kubernetes.io/instance']) {
      selectorLabels['app.kubernetes.io/instance'] = opts.labels['app.kubernetes.io/instance'];
    }
  }
  if (Object.keys(selectorLabels).length === 0 && opts.labels) {
    Object.assign(selectorLabels, opts.labels);
  }

  return {
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
      ...(opts.labels ? { labels: { ...opts.labels } } : {}),
      ...(opts.annotations ? { annotations: { ...opts.annotations } } : {}),
    },
    spec: {
      replicas: opts.replicas ?? 1,
      serviceName: opts.serviceName ?? opts.name,
      selector: {
        matchLabels: { ...selectorLabels },
      },
      template: {
        metadata: {
          labels: opts.labels ? { ...opts.labels } : {},
        },
        spec: {
          ...(opts.terminationGracePeriodSeconds !== undefined
            ? { terminationGracePeriodSeconds: opts.terminationGracePeriodSeconds }
            : {}),
          containers: [container],
          ...(opts.volumes ? { volumes: opts.volumes } : {}),
        },
      },
      volumeClaimTemplates: [
        {
          metadata: { name: 'data' },
          spec: {
            accessModes: ['ReadWriteOnce'],
            storageClassName: opts.storageClass,
            resources: {
              requests: { storage: opts.storageSize },
            },
          },
        },
      ],
    },
  };
}

export function service(opts: ServiceOpts): K8sManifest {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
      ...(opts.labels ? { labels: { ...opts.labels } } : {}),
      ...(opts.annotations ? { annotations: { ...opts.annotations } } : {}),
    },
    spec: {
      selector: { ...opts.selector },
      ports: opts.ports.map((p) => ({
        ...(p.name ? { name: p.name } : {}),
        port: p.port,
        targetPort: p.targetPort,
        protocol: p.protocol || 'TCP',
      })),
      type: opts.type ?? 'ClusterIP',
    },
  };
}

export function ingress(opts: IngressOpts): K8sManifest {
  const spec: Record<string, unknown> = {
    rules: [
      {
        host: opts.host,
        http: {
          paths: [
            {
              path: opts.path ?? '/',
              pathType: opts.pathType ?? 'Prefix',
              backend: {
                service: {
                  name: opts.backend.serviceName,
                  port: { number: opts.backend.servicePort },
                },
              },
            },
          ],
        },
      },
    ],
  };

  if (opts.tls) {
    spec.tls = [
      {
        secretName: opts.tls.secretName,
        hosts: opts.tls.hosts,
      },
    ];
  }

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
      ...(opts.labels ? { labels: { ...opts.labels } } : {}),
      ...(opts.annotations ? { annotations: { ...opts.annotations } } : {}),
    },
    spec,
  };
}

export function certificate(opts: CertificateOpts): K8sManifest {
  return {
    apiVersion: 'cert-manager.io/v1',
    kind: 'Certificate',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
      ...(opts.labels ? { labels: { ...opts.labels } } : {}),
      ...(opts.annotations ? { annotations: { ...opts.annotations } } : {}),
    },
    spec: {
      secretName: opts.secretName,
      issuerRef: {
        name: opts.issuerRef.name,
        kind: opts.issuerRef.kind,
      },
      dnsNames: [...opts.dnsNames],
    },
  };
}

export function configMap(opts: ConfigMapOpts): K8sManifest {
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
      ...(opts.labels ? { labels: { ...opts.labels } } : {}),
      ...(opts.annotations ? { annotations: { ...opts.annotations } } : {}),
    },
    ...(opts.data ? { spec: { data: { ...opts.data } } } : {}),
  };
}

export function secret(opts: SecretOpts): K8sManifest {
  const result: K8sManifest = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
      ...(opts.labels ? { labels: { ...opts.labels } } : {}),
      ...(opts.annotations ? { annotations: { ...opts.annotations } } : {}),
    },
  };
  const spec: Record<string, unknown> = {};
  if (opts.type) spec.type = opts.type;
  if (opts.data) spec.data = { ...opts.data };
  if (opts.stringData) spec.stringData = { ...opts.stringData };
  if (Object.keys(spec).length > 0) result.spec = spec;
  return result;
}

export function namespace(opts: NamespaceOpts): K8sManifest {
  return {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: opts.name,
      ...(opts.labels ? { labels: { ...opts.labels } } : {}),
      ...(opts.annotations ? { annotations: { ...opts.annotations } } : {}),
    },
  };
}

export function job(opts: JobOpts): K8sManifest {
  const container: Record<string, unknown> = {
    name: opts.name,
    image: opts.image,
    ...(opts.imagePullPolicy ? { imagePullPolicy: opts.imagePullPolicy } : {}),
    ...(nonEmpty(opts.command) ? { command: opts.command } : {}),
    ...(nonEmpty(opts.args) ? { args: opts.args } : {}),
    ...(opts.envFrom ? { envFrom: opts.envFrom } : {}),
    ...(opts.env ? { env: opts.env } : {}),
    ...(nonEmptyObj(opts.resources as Record<string, unknown>) ? { resources: opts.resources } : {}),
  };

  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
      ...(opts.labels ? { labels: { ...opts.labels } } : {}),
      ...(opts.annotations ? { annotations: { ...opts.annotations } } : {}),
    },
    spec: {
      template: {
        spec: {
          containers: [container],
          restartPolicy: opts.restartPolicy ?? 'Never',
        },
      },
      backoffLimit: opts.backoffLimit ?? 0,
    },
  };
}
