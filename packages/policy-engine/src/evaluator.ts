import { createHelpers } from './helpers';
import type {
  Decision,
  EvaluateOptions,
  EvaluationResult,
  PolicyContext,
  PolicyData,
  PolicyModule,
} from './types';

/**
 * Default evaluation options
 */
const DEFAULT_OPTIONS: Required<EvaluateOptions> = {
  explain: false,
  maxTimeMs: 10,
  moduleId: '',
  freeze: true,
};

/**
 * Deep freeze an object to prevent mutations
 */
function deepFreeze<T extends object>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  Object.freeze(obj);

  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  }

  return obj;
}

/**
 * Create a default deny decision for errors
 */
function createErrorDecision(code: string, message: string): Decision {
  return {
    effect: 'deny',
    reasons: [{ code, message }],
  };
}

/**
 * Evaluate a policy module with the given context and data
 */
export function evaluatePolicy(
  mod: PolicyModule,
  ctx: PolicyContext,
  data: PolicyData,
  opts?: EvaluateOptions
): EvaluationResult {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const startTime = Date.now();
  const helpers = createHelpers();

  // Freeze context and data if requested
  const frozenCtx = options.freeze ? deepFreeze({ ...ctx }) : ctx;
  const frozenData = options.freeze ? deepFreeze({ ...data }) : data;

  let decision: Decision;

  try {
    // Execute the policy evaluation
    decision = mod.evaluate(frozenCtx, frozenData, helpers);

    // Validate the decision structure
    if (!decision || typeof decision !== 'object') {
      decision = createErrorDecision(
        'invalid_decision',
        'Policy returned invalid decision'
      );
    }

    if (!decision.effect || !['allow', 'deny'].includes(decision.effect)) {
      decision = createErrorDecision(
        'invalid_effect',
        'Policy returned invalid effect'
      );
    }

    if (!Array.isArray(decision.reasons)) {
      decision.reasons = [];
    }
  } catch (error) {
    // Policy threw an exception - return deny
    const message = error instanceof Error ? error.message : 'Unknown error';
    decision = createErrorDecision('evaluation_error', `Policy evaluation failed: ${message}`);
  }

  const endTime = Date.now();
  const durationMs = endTime - startTime;

  return {
    decision,
    moduleId: options.moduleId || mod.id,
    moduleVersion: mod.version,
    evaluatedAt: new Date(startTime).toISOString(),
    durationMs,
  };
}

/**
 * Evaluate multiple policies and combine results
 * Uses "deny overrides" - any deny results in overall deny
 */
export function evaluatePolicies(
  modules: PolicyModule[],
  ctx: PolicyContext,
  data: PolicyData,
  opts?: EvaluateOptions
): EvaluationResult {
  const startTime = Date.now();
  const results: EvaluationResult[] = [];

  for (const mod of modules) {
    const result = evaluatePolicy(mod, ctx, data, opts);
    results.push(result);

    // Short-circuit on deny (deny overrides)
    if (result.decision.effect === 'deny') {
      return {
        decision: {
          effect: 'deny',
          reasons: result.decision.reasons,
          obligations: result.decision.obligations,
          trace: opts?.explain
            ? results.map((r) => ({
              step: `${r.moduleId}@${r.moduleVersion}`,
              ok: r.decision.effect === 'allow',
              meta: { reasons: r.decision.reasons },
            }))
            : undefined,
        },
        moduleId: 'combined',
        moduleVersion: '0.0.0',
        evaluatedAt: new Date(startTime).toISOString(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  // All policies allowed - combine obligations
  const allObligations = results.flatMap((r) => r.decision.obligations ?? []);
  const allReasons = results.flatMap((r) => r.decision.reasons);

  return {
    decision: {
      effect: 'allow',
      reasons: allReasons,
      obligations: allObligations.length > 0 ? allObligations : undefined,
      trace: opts?.explain
        ? results.map((r) => ({
          step: `${r.moduleId}@${r.moduleVersion}`,
          ok: r.decision.effect === 'allow',
          meta: { reasons: r.decision.reasons },
        }))
        : undefined,
    },
    moduleId: 'combined',
    moduleVersion: '0.0.0',
    evaluatedAt: new Date(startTime).toISOString(),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Create a simple allow decision
 */
export function allow(code: string, message: string): Decision {
  return {
    effect: 'allow',
    reasons: [{ code, message }],
  };
}

/**
 * Create a simple deny decision
 */
export function deny(code: string, message: string): Decision {
  return {
    effect: 'deny',
    reasons: [{ code, message }],
  };
}

/**
 * Create an allow decision with obligations
 */
export function allowWith(
  code: string,
  message: string,
  obligations: Decision['obligations']
): Decision {
  return {
    effect: 'allow',
    reasons: [{ code, message }],
    obligations,
  };
}
