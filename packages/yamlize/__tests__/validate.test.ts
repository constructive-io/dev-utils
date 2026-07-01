import { validate, deployment } from '../src';
import type { K8sManifest } from '../src';

describe('validate', () => {
  it('returns valid for a correct Deployment', () => {
    const manifest = deployment({
      name: 'app',
      namespace: 'default',
      image: 'nginx',
    });

    const result = validate(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing apiVersion', () => {
    const manifest = { kind: 'Deployment', metadata: { name: 'x' } } as K8sManifest;
    const result = validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('apiVersion is required');
  });

  it('rejects missing kind', () => {
    const manifest = { apiVersion: 'v1', metadata: { name: 'x' } } as K8sManifest;
    const result = validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('kind is required');
  });

  it('rejects missing metadata.name', () => {
    const manifest = { apiVersion: 'v1', kind: 'Service', metadata: {} } as K8sManifest;
    const result = validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('metadata.name is required');
  });

  it('rejects invalid kind for apiVersion', () => {
    const manifest: K8sManifest = {
      apiVersion: 'v1',
      kind: 'Deployment',
      metadata: { name: 'bad' },
    };
    const result = validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not valid for apiVersion');
  });

  it('rejects names with uppercase', () => {
    const manifest: K8sManifest = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: 'MyService' },
    };
    const result = validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'metadata.name must be a valid DNS subdomain (lowercase alphanumeric, "-", ".")'
    );
  });

  it('allows cert-manager CRDs', () => {
    const manifest: K8sManifest = {
      apiVersion: 'cert-manager.io/v1',
      kind: 'Certificate',
      metadata: { name: 'my-cert' },
    };
    const result = validate(manifest);
    expect(result.valid).toBe(true);
  });
});
