import type { Pod, PodCondition,PodList } from 'kubernetesjs';

export type { Pod, PodCondition,PodList };

export interface WaitForPodsOptions {
  namespace?: string;
  labelSelector?: string;
  fieldSelector?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  minReady?: number;
  allReady?: boolean;
  onProgress?: (status: WaitForPodsProgress) => void;
}

export interface WaitForPodsProgress {
  total: number;
  ready: number;
  pending: number;
  failed: number;
  pods: PodStatusInfo[];
  elapsedMs: number;
}

export interface PodStatusInfo {
  name: string;
  namespace: string;
  phase: string;
  ready: boolean;
  conditions: PodConditionInfo[];
  containerStatuses: ContainerStatusInfo[];
}

export interface PodConditionInfo {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

export interface ContainerStatusInfo {
  name: string;
  ready: boolean;
  restartCount: number;
  state: 'running' | 'waiting' | 'terminated' | 'unknown';
  stateReason?: string;
}

export interface WaitForPodsResult {
  success: boolean;
  pods: PodStatusInfo[];
  message: string;
  elapsedMs: number;
}

export interface KubernetesTestClientOptions {
  restEndpoint?: string;
  namespace?: string;
}

export class WaitForPodsTimeoutError extends Error {
  constructor(
    message: string,
    public readonly progress: WaitForPodsProgress
  ) {
    super(message);
    this.name = 'WaitForPodsTimeoutError';
  }
}

export class WaitForPodsError extends Error {
  constructor(
    message: string,
    public readonly progress?: WaitForPodsProgress
  ) {
    super(message);
    this.name = 'WaitForPodsError';
  }
}
