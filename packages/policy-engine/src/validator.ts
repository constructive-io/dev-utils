import type {
  EnvironmentContext,
  PolicyContext,
  PolicyData,
  PolicyModule,
  RequestContext,
  ValidationError,
  ValidationResult,
} from './types';

/**
 * Get a field value from an object by key
 */
function getField(obj: RequestContext | EnvironmentContext, field: string): unknown {
  return (obj as unknown as Record<string, unknown>)[field];
}

/**
 * Validate that a policy module has the required structure
 */
export function validateModule(mod: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!mod || typeof mod !== 'object') {
    errors.push({
      code: 'invalid_module',
      message: 'Policy module must be an object',
    });
    return { valid: false, errors, warnings };
  }

  const module = mod as Record<string, unknown>;

  // Check required fields
  if (typeof module.id !== 'string' || module.id.length === 0) {
    errors.push({
      code: 'missing_id',
      message: 'Policy module must have a non-empty id string',
      path: 'id',
    });
  }

  if (typeof module.version !== 'string' || module.version.length === 0) {
    errors.push({
      code: 'missing_version',
      message: 'Policy module must have a non-empty version string',
      path: 'version',
    });
  }

  if (typeof module.evaluate !== 'function') {
    errors.push({
      code: 'missing_evaluate',
      message: 'Policy module must have an evaluate function',
      path: 'evaluate',
    });
  }

  // Check optional fields
  if (module.description !== undefined && typeof module.description !== 'string') {
    warnings.push({
      code: 'invalid_description',
      message: 'Policy module description should be a string',
      path: 'description',
    });
  }

  if (module.expects !== undefined) {
    if (typeof module.expects !== 'object') {
      warnings.push({
        code: 'invalid_expects',
        message: 'Policy module expects should be an object',
        path: 'expects',
      });
    } else {
      const expects = module.expects as Record<string, unknown>;
      
      if (expects.data !== undefined && !Array.isArray(expects.data)) {
        warnings.push({
          code: 'invalid_expects_data',
          message: 'Policy module expects.data should be an array',
          path: 'expects.data',
        });
      }

      if (expects.claims !== undefined && !Array.isArray(expects.claims)) {
        warnings.push({
          code: 'invalid_expects_claims',
          message: 'Policy module expects.claims should be an array',
          path: 'expects.claims',
        });
      }

      if (expects.request !== undefined && !Array.isArray(expects.request)) {
        warnings.push({
          code: 'invalid_expects_request',
          message: 'Policy module expects.request should be an array',
          path: 'expects.request',
        });
      }

      if (expects.env !== undefined && !Array.isArray(expects.env)) {
        warnings.push({
          code: 'invalid_expects_env',
          message: 'Policy module expects.env should be an array',
          path: 'expects.env',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate that context satisfies a policy module's expectations
 */
export function validateContext(
  mod: PolicyModule,
  ctx: PolicyContext
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!mod.expects) {
    return { valid: true, errors, warnings };
  }

  // Check required request fields
  if (mod.expects.request) {
    for (const field of mod.expects.request) {
      const value = getField(ctx.request, field);
      if (value === undefined || value === null) {
        errors.push({
          code: 'missing_request_field',
          message: `Required request field '${field}' is missing`,
          path: `request.${field}`,
        });
      }
    }
  }

  // Check required claims
  if (mod.expects.claims) {
    for (const claim of mod.expects.claims) {
      const value = ctx.identity.claims?.[claim];
      if (value === undefined || value === null) {
        errors.push({
          code: 'missing_claim',
          message: `Required claim '${claim}' is missing`,
          path: `identity.claims.${claim}`,
        });
      }
    }
  }

  // Check required env fields
  if (mod.expects.env) {
    for (const field of mod.expects.env) {
      const value = getField(ctx.env, field);
      if (value === undefined || value === null) {
        errors.push({
          code: 'missing_env_field',
          message: `Required environment field '${field}' is missing`,
          path: `env.${field}`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate that data satisfies a policy module's expectations
 */
export function validateData(
  mod: PolicyModule,
  data: PolicyData
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!mod.expects?.data) {
    return { valid: true, errors, warnings };
  }

  for (const field of mod.expects.data) {
    const value = data[field];
    if (value === undefined) {
      errors.push({
        code: 'missing_data_field',
        message: `Required data field '${field}' is missing`,
        path: `data.${field}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a policy module and its inputs
 */
export function validate(
  mod: unknown,
  ctx?: PolicyContext,
  data?: PolicyData
): ValidationResult {
  const moduleResult = validateModule(mod);
  
  if (!moduleResult.valid) {
    return moduleResult;
  }

  const validMod = mod as PolicyModule;
  const errors: ValidationError[] = [...moduleResult.errors];
  const warnings: ValidationError[] = [...moduleResult.warnings];

  if (ctx) {
    const ctxResult = validateContext(validMod, ctx);
    errors.push(...ctxResult.errors);
    warnings.push(...ctxResult.warnings);
  }

  if (data) {
    const dataResult = validateData(validMod, data);
    errors.push(...dataResult.errors);
    warnings.push(...dataResult.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
