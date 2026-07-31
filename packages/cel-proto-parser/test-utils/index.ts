/**
 * CEL Test Utilities
 *
 * Provides utilities for round-trip testing of CEL expressions:
 * CEL string -> parse -> AST -> deparse -> CEL string
 *
 * Similar to pgsql-parser's FixtureTestUtils and constructive-db's PrettyTest.
 */

import { parse } from '@marcbachmann/cel-js';
import { readFileSync } from 'fs';

import { convertToProtoExpr, MarcAstNode } from '../src/converter';
import { deparse, Expr } from '../src/deparser';

export interface RoundTripResult {
  original: string;
  ast: Expr;
  deparsed: string;
  reparsedAst: Expr | null;
  redeparsed: string | null;
  success: boolean;
  error?: string;
}

export interface TestUtilOptions {
  spaces?: boolean;
  normalizeWhitespace?: boolean;
}

/**
 * Normalize a CEL expression for comparison
 * - Trims whitespace
 * - Normalizes multiple spaces to single space
 * - Removes trailing/leading whitespace from each line
 */
export function normalizeCel(cel: string): string {
  return cel
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\s+/g, ' ');
}

/**
 * Parse a CEL expression using @marcbachmann/cel-js and convert to proto format
 */
export function parseCel(expression: string): Expr {
  const result = parse(expression);
  return convertToProtoExpr(result.ast as MarcAstNode);
}

/**
 * Perform a round-trip test on a CEL expression
 *
 * Pipeline: CEL string -> parse -> AST -> deparse -> CEL string
 *
 * Optionally performs a second round-trip to verify stability:
 * CEL string -> parse -> AST -> deparse -> parse -> AST -> deparse
 */
export function roundTrip(
  expression: string,
  options: TestUtilOptions = {}
): RoundTripResult {
  const { spaces = true, normalizeWhitespace = true } = options;

  try {
    // Step 1: Parse original CEL to AST
    const ast = parseCel(expression);

    // Step 2: Deparse AST back to CEL string
    const deparsed = deparse(ast, { spaces });

    // Step 3: Try to reparse the deparsed string
    let reparsedAst: Expr | null = null;
    let redeparsed: string | null = null;

    try {
      reparsedAst = parseCel(deparsed);
      redeparsed = deparse(reparsedAst, { spaces });
    } catch (reparseError) {
      return {
        original: expression,
        ast,
        deparsed,
        reparsedAst: null,
        redeparsed: null,
        success: false,
        error: `Reparse failed: ${reparseError instanceof Error ? reparseError.message : String(reparseError)}`
      };
    }

    // Step 4: Compare results
    const normalizedOriginal = normalizeWhitespace
      ? normalizeCel(expression)
      : expression;
    const normalizedDeparsed = normalizeWhitespace
      ? normalizeCel(deparsed)
      : deparsed;
    const normalizedRedeparsed = normalizeWhitespace
      ? normalizeCel(redeparsed)
      : redeparsed;

    // Check if deparsed matches redeparsed (stability check)
    const isStable = normalizedDeparsed === normalizedRedeparsed;

    return {
      original: expression,
      ast,
      deparsed,
      reparsedAst,
      redeparsed,
      success: isStable,
      error: isStable
        ? undefined
        : `Unstable round-trip: "${normalizedDeparsed}" !== "${normalizedRedeparsed}"`
    };
  } catch (error) {
    return {
      original: expression,
      ast: {} as Expr,
      deparsed: '',
      reparsedAst: null,
      redeparsed: null,
      success: false,
      error: `Parse failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Validate that a CEL expression can be round-tripped successfully
 *
 * Throws an error with detailed information if the round-trip fails.
 */
export function expectRoundTrip(
  expression: string,
  options: TestUtilOptions = {}
): void {
  const result = roundTrip(expression, options);

  if (!result.success) {
    const errorMessage = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'CEL Round-Trip Test Failed',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      'Original CEL:',
      '──────────────────────────────────────────────────────────────────────────────',
      expression,
      '',
      'Deparsed CEL:',
      '──────────────────────────────────────────────────────────────────────────────',
      result.deparsed,
      '',
      result.redeparsed !== null
        ? [
          'Re-deparsed CEL:',
          '──────────────────────────────────────────────────────────────────────────────',
          result.redeparsed,
          ''
        ].join('\n')
        : '',
      'Error:',
      '──────────────────────────────────────────────────────────────────────────────',
      result.error || 'Unknown error',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    ].join('\n');

    throw new Error(errorMessage);
  }
}

/**
 * Load CEL expression fixtures from a file
 *
 * File format:
 * - Each line is a CEL expression
 * - Lines starting with # are comments
 * - Empty lines are ignored
 */
export function loadFixtures(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/**
 * CEL Test Utility class for fixture-based testing
 *
 * Similar to constructive-db's PrettyTest class.
 *
 * Usage:
 * ```typescript
 * const celTest = new CelTest([
 *   '1 + 2',
 *   'request.auth.claims.email',
 *   'size(list) > 0'
 * ]);
 *
 * celTest.generateTests();
 * ```
 */
export class CelTest {
  private expressions: string[];
  private options: TestUtilOptions;

  constructor(expressions: string[], options: TestUtilOptions = {}) {
    this.expressions = expressions;
    this.options = options;
  }

  /**
   * Create a CelTest instance from a fixtures file
   */
  static fromFile(filePath: string, options: TestUtilOptions = {}): CelTest {
    const expressions = loadFixtures(filePath);
    return new CelTest(expressions, options);
  }

  /**
   * Generate Jest tests for each expression
   */
  generateTests(): void {
    this.expressions.forEach((expression) => {
      it(`round-trip: ${expression}`, () => {
        expectRoundTrip(expression, this.options);
      });
    });
  }

  /**
   * Generate Jest tests with snapshots
   */
  generateSnapshotTests(): void {
    this.expressions.forEach((expression) => {
      it(`snapshot: ${expression}`, () => {
        const result = roundTrip(expression, this.options);
        expect(result.deparsed).toMatchSnapshot();
        expect(result.success).toBe(true);
      });
    });
  }

  /**
   * Run all tests and return results
   */
  runAll(): RoundTripResult[] {
    return this.expressions.map((expr) => roundTrip(expr, this.options));
  }

  /**
   * Get summary of test results
   */
  getSummary(): { total: number; passed: number; failed: number; failures: RoundTripResult[] } {
    const results = this.runAll();
    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const failures = results.filter((r) => !r.success);

    return {
      total: results.length,
      passed,
      failed,
      failures
    };
  }
}

export { deparse, Expr, parseCel as parse };
