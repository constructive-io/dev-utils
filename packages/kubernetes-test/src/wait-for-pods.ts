import { ContainerStatus,KubernetesClient, Pod, PodList } from 'kubernetesjs';

import {
  ContainerStatusInfo,
  PodConditionInfo,
  PodStatusInfo,
  WaitForPodsError,
  WaitForPodsOptions,
  WaitForPodsProgress,
  WaitForPodsResult,
  WaitForPodsTimeoutError,
} from './types';

const DEFAULT_TIMEOUT_MS = 300000; // 5 minutes
const DEFAULT_POLL_INTERVAL_MS = 2000; // 2 seconds

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getContainerState(
  status: ContainerStatus
): { state: ContainerStatusInfo['state']; reason?: string } {
  if (status.state?.running) {
    return { state: 'running' };
  }
  if (status.state?.waiting) {
    return { state: 'waiting', reason: status.state.waiting.reason };
  }
  if (status.state?.terminated) {
    return { state: 'terminated', reason: status.state.terminated.reason };
  }
  return { state: 'unknown' };
}

function extractPodStatusInfo(pod: Pod): PodStatusInfo {
  const containerStatuses: ContainerStatusInfo[] = (
    pod.status?.containerStatuses || []
  ).map((cs) => {
    const { state, reason } = getContainerState(cs);
    return {
      name: cs.name,
      ready: cs.ready,
      restartCount: cs.restartCount,
      state,
      stateReason: reason,
    };
  });

  const conditions: PodConditionInfo[] = (pod.status?.conditions || []).map(
    (c) => ({
      type: c.type,
      status: c.status,
      reason: c.reason,
      message: c.message,
    })
  );

  const readyCondition = pod.status?.conditions?.find((c) => c.type === 'Ready');
  const isReady =
    readyCondition?.status === 'True' && pod.status?.phase === 'Running';

  return {
    name: pod.metadata?.name || 'unknown',
    namespace: pod.metadata?.namespace || 'default',
    phase: pod.status?.phase || 'Unknown',
    ready: isReady,
    conditions,
    containerStatuses,
  };
}

function buildProgress(
  pods: PodStatusInfo[],
  startTime: number
): WaitForPodsProgress {
  const ready = pods.filter((p) => p.ready).length;
  const failed = pods.filter((p) => p.phase === 'Failed').length;
  const pending = pods.filter(
    (p) => !p.ready && p.phase !== 'Failed'
  ).length;

  return {
    total: pods.length,
    ready,
    pending,
    failed,
    pods,
    elapsedMs: Date.now() - startTime,
  };
}

export async function waitForPods(
  client: KubernetesClient,
  options: WaitForPodsOptions = {}
): Promise<WaitForPodsResult> {
  const {
    namespace = 'default',
    labelSelector,
    fieldSelector,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    minReady,
    allReady = true,
    onProgress,
  } = options;

  const startTime = Date.now();

  while (true) {
    const elapsed = Date.now() - startTime;

    if (elapsed >= timeoutMs) {
      const podList = await client.listCoreV1NamespacedPod({
        path: { namespace },
        query: {
          labelSelector,
          fieldSelector,
        },
      });
      const podStatuses = podList.items.map(extractPodStatusInfo);
      const progress = buildProgress(podStatuses, startTime);

      throw new WaitForPodsTimeoutError(
        `Timeout waiting for pods after ${timeoutMs}ms. ` +
          `Ready: ${progress.ready}/${progress.total}`,
        progress
      );
    }

    let podList: PodList;
    try {
      podList = await client.listCoreV1NamespacedPod({
        path: { namespace },
        query: {
          labelSelector,
          fieldSelector,
        },
      });
    } catch (error) {
      throw new WaitForPodsError(
        `Failed to list pods: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const podStatuses = podList.items.map(extractPodStatusInfo);
    const progress = buildProgress(podStatuses, startTime);

    if (onProgress) {
      onProgress(progress);
    }

    if (progress.failed > 0) {
      const failedPods = podStatuses
        .filter((p) => p.phase === 'Failed')
        .map((p) => p.name)
        .join(', ');
      throw new WaitForPodsError(
        `Pods failed: ${failedPods}`,
        progress
      );
    }

    if (progress.total === 0) {
      await sleep(pollIntervalMs);
      continue;
    }

    const targetReady = minReady ?? (allReady ? progress.total : 1);

    if (progress.ready >= targetReady) {
      return {
        success: true,
        pods: podStatuses,
        message: `${progress.ready}/${progress.total} pods are ready`,
        elapsedMs: progress.elapsedMs,
      };
    }

    await sleep(pollIntervalMs);
  }
}

export async function waitForPodByName(
  client: KubernetesClient,
  name: string,
  options: Omit<WaitForPodsOptions, 'labelSelector' | 'minReady' | 'allReady'> = {}
): Promise<WaitForPodsResult> {
  return waitForPods(client, {
    ...options,
    fieldSelector: `metadata.name=${name}`,
    minReady: 1,
    allReady: true,
  });
}

export async function waitForPodsWithLabel(
  client: KubernetesClient,
  label: string,
  value: string,
  options: Omit<WaitForPodsOptions, 'labelSelector'> = {}
): Promise<WaitForPodsResult> {
  return waitForPods(client, {
    ...options,
    labelSelector: `${label}=${value}`,
  });
}
