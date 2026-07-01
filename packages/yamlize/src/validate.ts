import type { K8sManifest, ValidationResult } from './types';

const KNOWN_KINDS: Record<string, string[]> = {
  'apps/v1': ['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet'],
  'v1': ['Service', 'ConfigMap', 'Secret', 'Namespace', 'Pod'],
  'networking.k8s.io/v1': ['Ingress', 'NetworkPolicy'],
  'cert-manager.io/v1': ['Certificate', 'Issuer', 'ClusterIssuer'],
  'batch/v1': ['Job', 'CronJob'],
  'serving.knative.dev/v1': ['Service'],
};

export function validate(manifest: K8sManifest): ValidationResult {
  const errors: string[] = [];

  if (!manifest.apiVersion) {
    errors.push('apiVersion is required');
  }

  if (!manifest.kind) {
    errors.push('kind is required');
  }

  if (!manifest.metadata) {
    errors.push('metadata is required');
  } else if (!manifest.metadata.name) {
    errors.push('metadata.name is required');
  }

  if (manifest.apiVersion && manifest.kind) {
    const allowedKinds = KNOWN_KINDS[manifest.apiVersion];
    if (allowedKinds && !allowedKinds.includes(manifest.kind)) {
      errors.push(
        `kind "${manifest.kind}" is not valid for apiVersion "${manifest.apiVersion}" (expected: ${allowedKinds.join(', ')})`
      );
    }
  }

  if (manifest.metadata?.name) {
    const name = manifest.metadata.name;
    if (name.length > 253) {
      errors.push('metadata.name must not exceed 253 characters');
    }
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(name)) {
      errors.push('metadata.name must be a valid DNS subdomain (lowercase alphanumeric, "-", ".")');
    }
  }

  return { valid: errors.length === 0, errors };
}
