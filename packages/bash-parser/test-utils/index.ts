import { readFileSync } from 'fs';
import * as path from 'path';

import { cleanTree } from '../src/clean';
import { deparse } from '../src/deparser';
import { parse } from '../src/parser';
import { Script } from '../src/types';

/**
 * Test utilities for bash-parser
 */
export class TestUtils {
  /**
   * Parse bash source
   */
  parse(source: string): Script {
    return parse(source);
  }

  /**
   * Deparse AST to source
   */
  deparse(ast: Script): string {
    return deparse(ast);
  }

  /**
   * Clean AST for comparison
   */
  clean(ast: Script): Script {
    return cleanTree(ast);
  }

  /**
   * Round-trip test: parse -> deparse -> parse -> compare cleaned ASTs
   */
  async expectAstMatch(testName: string, source: string): Promise<void> {
    // First parse
    const ast1 = this.parse(source);

    // Deparse
    const deparsed = this.deparse(ast1);

    // Second parse
    const ast2 = this.parse(deparsed);

    // Clean both ASTs
    const clean1 = this.clean(ast1);
    const clean2 = this.clean(ast2);

    // Compare
    const json1 = JSON.stringify(clean1, null, 2);
    const json2 = JSON.stringify(clean2, null, 2);

    if (json1 !== json2) {
      const diff = require('jest-diff').diff(json1, json2);
      throw new Error(
        `AST mismatch for ${testName}:\n` +
        `Original source:\n${source}\n\n` +
        `Deparsed:\n${deparsed}\n\n` +
        `AST diff:\n${diff}`
      );
    }
  }
}

/**
 * Fixture-based test utilities
 */
export class FixtureTestUtils extends TestUtils {
  private fixtures: Record<string, string>;

  constructor() {
    super();
    const GENERATED_JSON = path.join(__dirname, '../../__fixtures__/generated/generated.json');
    try {
      this.fixtures = JSON.parse(readFileSync(GENERATED_JSON, 'utf-8'));
    } catch {
      this.fixtures = {};
    }
  }

  /**
   * Get test entries, optionally filtered
   */
  getTestEntries(filters: string[]): [string, string][] {
    if (filters.length === 0) {
      return Object.entries(this.fixtures);
    }
    return Object.entries(this.fixtures).filter(([relPath]) =>
      filters.includes(relPath)
    );
  }

  /**
   * Run fixture tests
   */
  async runFixtureTests(filters: string[]): Promise<void> {
    if (filters.length === 0) {
      console.log('no filters provided, skipping tests.');
      return;
    }
    const entries = this.getTestEntries(filters);
    for (const [relativePath, source] of entries) {
      try {
        await this.expectAstMatch(relativePath, source);
      } catch (err) {
        throw err;
      }
    }
  }
}
