import {
  WaitForPodsTimeoutError,
  WaitForPodsError,
  WaitForPodsOptions,
  WaitForPodsProgress,
  PodStatusInfo,
} from '../src/types';

describe('kubernetes-test types', () => {
  describe('WaitForPodsTimeoutError', () => {
    it('should create a timeout error with progress', () => {
      const progress: WaitForPodsProgress = {
        total: 3,
        ready: 1,
        pending: 2,
        failed: 0,
        pods: [],
        elapsedMs: 5000,
      };

      const error = new WaitForPodsTimeoutError('Timeout waiting for pods', progress);

      expect(error.name).toBe('WaitForPodsTimeoutError');
      expect(error.message).toBe('Timeout waiting for pods');
      expect(error.progress).toBe(progress);
      expect(error.progress.ready).toBe(1);
      expect(error.progress.total).toBe(3);
    });
  });

  describe('WaitForPodsError', () => {
    it('should create an error without progress', () => {
      const error = new WaitForPodsError('Failed to list pods');

      expect(error.name).toBe('WaitForPodsError');
      expect(error.message).toBe('Failed to list pods');
      expect(error.progress).toBeUndefined();
    });

    it('should create an error with progress', () => {
      const progress: WaitForPodsProgress = {
        total: 2,
        ready: 0,
        pending: 1,
        failed: 1,
        pods: [],
        elapsedMs: 3000,
      };

      const error = new WaitForPodsError('Pods failed', progress);

      expect(error.name).toBe('WaitForPodsError');
      expect(error.message).toBe('Pods failed');
      expect(error.progress).toBe(progress);
    });
  });

  describe('Type definitions', () => {
    it('should allow creating WaitForPodsOptions', () => {
      const options: WaitForPodsOptions = {
        namespace: 'test-namespace',
        labelSelector: 'app=test',
        timeoutMs: 60000,
        pollIntervalMs: 1000,
        minReady: 2,
        allReady: false,
        onProgress: (progress) => {
          expect(progress.total).toBeGreaterThanOrEqual(0);
        },
      };

      expect(options.namespace).toBe('test-namespace');
      expect(options.labelSelector).toBe('app=test');
      expect(options.timeoutMs).toBe(60000);
    });

    it('should allow creating PodStatusInfo', () => {
      const podStatus: PodStatusInfo = {
        name: 'test-pod',
        namespace: 'default',
        phase: 'Running',
        ready: true,
        conditions: [
          {
            type: 'Ready',
            status: 'True',
            reason: 'PodReady',
            message: 'Pod is ready',
          },
        ],
        containerStatuses: [
          {
            name: 'main',
            ready: true,
            restartCount: 0,
            state: 'running',
          },
        ],
      };

      expect(podStatus.name).toBe('test-pod');
      expect(podStatus.ready).toBe(true);
      expect(podStatus.conditions).toHaveLength(1);
      expect(podStatus.containerStatuses).toHaveLength(1);
    });
  });
});
