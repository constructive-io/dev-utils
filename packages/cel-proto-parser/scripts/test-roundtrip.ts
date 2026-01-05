#!/usr/bin/env npx ts-node --esm
/**
 * CEL Round-Trip Test Script
 *
 * This script tests the CEL -> AST -> CEL pipeline using @marcbachmann/cel-js
 * for parsing and our deparser for converting back to CEL strings.
 *
 * Run with: npx ts-node --esm scripts/test-roundtrip.ts
 * Or with a fixture file: npx ts-node --esm scripts/test-roundtrip.ts __fixtures__/expressions/basic.txt
 */

import { parse } from '@marcbachmann/cel-js';
import { deparse, Expr } from '../src/deparser';
import { convertToProtoExpr, MarcAstNode } from '../src/converter';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestResult {
  expression: string;
  success: boolean;
  deparsed?: string;
  error?: string;
}

function parseCel(expression: string): Expr {
  const result = parse(expression);
  return convertToProtoExpr(result.ast as MarcAstNode);
}

function testRoundTrip(expression: string): TestResult {
  try {
    const ast = parseCel(expression);
    const deparsed = deparse(ast, { spaces: true });

    // Try to reparse the deparsed string
    const reparsedAst = parseCel(deparsed);
    const redeparsed = deparse(reparsedAst, { spaces: true });

    // Check stability
    const isStable = deparsed.trim() === redeparsed.trim();

    return {
      expression,
      success: isStable,
      deparsed,
      error: isStable ? undefined : `Unstable: "${deparsed}" vs "${redeparsed}"`
    };
  } catch (error) {
    return {
      expression,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Load CEL expressions from a fixture file
 * Lines starting with # are comments, empty lines are ignored
 */
function loadFixtures(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

// Check if a fixture file was provided as argument
const fixtureArg = process.argv[2];
let testCases: string[];

if (fixtureArg) {
  // Load from fixture file
  const fixturePath = resolve(__dirname, '..', fixtureArg);
  console.log(`Loading fixtures from: ${fixturePath}\n`);
  testCases = loadFixtures(fixturePath);
} else {
  // Use default test cases
  testCases = [
    // Literals
    '1',
    '42',
    '3.14',
    'true',
    'false',
    'null',
    '"hello"',
    '"hello world"',

    // Unsigned integers
    '1u',
    '42u',

    // Identifiers
    'x',
    'foo',
    'request',

    // Field access
    'request.auth',
    'request.auth.claims',
    'request.auth.claims.email',

    // Arithmetic operators
    '1 + 2',
    'a + b',
    'x - y',
    'a * b',
    'x / y',
    '1 + 2 * 3',

    // Comparison operators
    'a == b',
    'x != y',
    'a < b',
    'a <= b',
    'a > b',
    'a >= b',

    // Logical operators
    'a && b',
    'x || y',
    '!a',
    'a && b && c',
    'a || b || c',

    // Ternary conditional
    'x ? 1 : 2',
    'a == b ? "yes" : "no"',

    // List literals
    '[]',
    '[1]',
    '[1, 2, 3]',

    // Map literals
    '{}',
    '{"a": 1}',
    '{"a": 1, "b": 2}',

    // Index access
    'list[0]',
    'map["key"]',

    // Function calls
    'size(list)',
    'int(x)',
    'string(42)',

    // Method calls
    'list.size()',
    'str.contains("test")',

    // In operator
    'x in list',
    '"admin" in roles',

    // Complex expressions
    'request.auth.claims.email == "admin@example.com"',
    'size(request.body) > 0 && request.method == "POST"',
    'user.age >= 18 && "admin" in user.roles'
  ];
}

console.log('CEL Round-Trip Tests');
console.log('====================\n');

let passed = 0;
let failed = 0;
const failures: TestResult[] = [];

for (const expression of testCases) {
  const result = testRoundTrip(expression);
  if (result.success) {
    passed++;
    console.log(`PASS: ${expression}`);
    if (result.deparsed !== expression) {
      console.log(`      -> ${result.deparsed}`);
    }
  } else {
    failed++;
    failures.push(result);
    console.log(`FAIL: ${expression}`);
    console.log(`      Error: ${result.error}`);
  }
}

console.log('\n====================');
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const failure of failures) {
    console.log(`  - ${failure.expression}: ${failure.error}`);
  }
  process.exit(1);
}

process.exit(0);
