export interface K8sManifest {
  apiVersion: string;
  kind: string;
  metadata: K8sMetadata;
  spec?: Record<string, unknown>;
}

export interface K8sMetadata {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PortSpec {
  name?: string;
  containerPort: number;
  protocol?: string;
}

export interface ServicePortSpec {
  name?: string;
  port: number;
  targetPort: number;
  protocol?: string;
}

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: Record<string, unknown>;
}

export interface EnvFromSource {
  secretRef?: { name: string; optional?: boolean };
  configMapRef?: { name: string; optional?: boolean };
}

export interface ResourceRequirements {
  limits?: Record<string, string>;
  requests?: Record<string, string>;
}

export interface VolumeSpec {
  name: string;
  emptyDir?: Record<string, unknown>;
  configMap?: { name: string };
  secret?: { secretName: string };
  persistentVolumeClaim?: { claimName: string };
}

export interface VolumeMountSpec {
  name: string;
  mountPath: string;
  readOnly?: boolean;
  subPath?: string;
}

export interface HealthCheckSpec {
  httpGet?: { path: string; port: number | string; scheme?: string };
  tcpSocket?: { port: number | string };
  exec?: { command: string[] };
  initialDelaySeconds?: number;
  periodSeconds?: number;
  timeoutSeconds?: number;
  failureThreshold?: number;
  successThreshold?: number;
}

export interface DeploymentOpts {
  name: string;
  namespace: string;
  image: string;
  replicas?: number;
  ports?: PortSpec[];
  env?: EnvVar[];
  envFrom?: EnvFromSource[];
  resources?: ResourceRequirements | Record<string, unknown>;
  command?: string[];
  args?: string[];
  healthCheck?: HealthCheckSpec | Record<string, unknown>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  volumes?: VolumeSpec[];
  volumeMounts?: VolumeMountSpec[];
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
  terminationGracePeriodSeconds?: number;
}

export interface StatefulSetOpts extends DeploymentOpts {
  storageClass: string;
  storageSize: string;
  volumeMountPath?: string;
  serviceName?: string;
}

export interface ServiceOpts {
  name: string;
  namespace: string;
  selector: Record<string, string>;
  ports: ServicePortSpec[];
  type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface IngressOpts {
  name: string;
  namespace: string;
  host: string;
  path?: string;
  pathType?: 'Prefix' | 'Exact' | 'ImplementationSpecific';
  backend: { serviceName: string; servicePort: number };
  tls?: { secretName: string; hosts: string[] };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface CertificateOpts {
  name: string;
  namespace: string;
  dnsNames: string[];
  issuerRef: { name: string; kind: 'ClusterIssuer' | 'Issuer' };
  secretName: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface ConfigMapOpts {
  name: string;
  namespace: string;
  data?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface SecretOpts {
  name: string;
  namespace: string;
  type?: string;
  data?: Record<string, string>;
  stringData?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface NamespaceOpts {
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface JobOpts {
  name: string;
  namespace: string;
  image: string;
  command?: string[];
  args?: string[];
  env?: EnvVar[];
  envFrom?: EnvFromSource[];
  resources?: ResourceRequirements | Record<string, unknown>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  backoffLimit?: number;
  restartPolicy?: 'Never' | 'OnFailure';
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
