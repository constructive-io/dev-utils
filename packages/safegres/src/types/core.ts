/**
 * Effect represents the outcome of a policy decision
 */
export type Effect = 'allow' | 'deny';

/**
 * Reason explains why a decision was made
 */
export interface Reason {
  /** Stable identifier for analytics and programmatic handling */
  code: string;
  /** Human-readable explanation */
  message: string;
  /** Optional path to the relevant context field (e.g., "request.path") */
  path?: string;
  /** Optional metadata for debugging */
  meta?: Record<string, unknown>;
}

/**
 * TraceStep records a step in policy evaluation for debugging
 */
export interface TraceStep {
  step: string;
  ok: boolean;
  meta?: unknown;
}

/**
 * Decision is the result of policy evaluation
 */
export interface Decision {
  effect: Effect;
  reasons: Reason[];
  obligations?: import('./obligations').SafegresObligation[];
  /** Optional trace for debugging (can be disabled in production) */
  trace?: TraceStep[];
}
