# kubernetes-test

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
  <br />
    <strong>Kubernetes testing utilities</strong>
  <br />
  <br />
  Wait-for-pods and other helpers for integration tests
  <br />
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

Kubernetes testing utilities with wait-for-pods and other helpers for integration tests.

## Installation

```bash
npm install kubernetes-test
```

## Usage

### Wait for Pods

The `waitForPods` function allows you to wait for pods to become ready in a Kubernetes cluster.

```typescript
import { KubernetesClient } from 'kubernetesjs';
import { waitForPods, waitForPodByName, waitForPodsWithLabel } from 'kubernetes-test';

// Create a Kubernetes client
const client = new KubernetesClient({
  restEndpoint: 'http://localhost:8001', // kubectl proxy endpoint
});

// Wait for all pods with a specific label to be ready
const result = await waitForPods(client, {
  namespace: 'default',
  labelSelector: 'app=my-app',
  timeoutMs: 60000, // 1 minute timeout
  pollIntervalMs: 2000, // Check every 2 seconds
  onProgress: (progress) => {
    console.log(`Ready: ${progress.ready}/${progress.total}`);
  },
});

console.log(result.message); // "3/3 pods are ready"

// Wait for a specific pod by name
const podResult = await waitForPodByName(client, 'my-pod-name', {
  namespace: 'default',
  timeoutMs: 30000,
});

// Wait for pods with a specific label
const labelResult = await waitForPodsWithLabel(client, 'app', 'nginx', {
  namespace: 'production',
  minReady: 2, // Wait for at least 2 pods to be ready
});
```

### Options

#### `WaitForPodsOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `namespace` | `string` | `'default'` | Kubernetes namespace to query |
| `labelSelector` | `string` | - | Label selector to filter pods (e.g., `'app=nginx'`) |
| `fieldSelector` | `string` | - | Field selector to filter pods |
| `timeoutMs` | `number` | `300000` | Maximum time to wait (5 minutes) |
| `pollIntervalMs` | `number` | `2000` | Interval between status checks |
| `minReady` | `number` | - | Minimum number of ready pods required |
| `allReady` | `boolean` | `true` | Wait for all pods to be ready |
| `onProgress` | `function` | - | Callback for progress updates |

### Error Handling

The library provides specific error types for different failure scenarios:

```typescript
import { 
  waitForPods, 
  WaitForPodsTimeoutError, 
  WaitForPodsError 
} from 'kubernetes-test';

try {
  await waitForPods(client, { labelSelector: 'app=my-app' });
} catch (error) {
  if (error instanceof WaitForPodsTimeoutError) {
    console.log('Timeout! Progress:', error.progress);
  } else if (error instanceof WaitForPodsError) {
    console.log('Error:', error.message);
  }
}
```

## License

MIT
