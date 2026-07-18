import { cleanTree } from '../src/clean';
import { deparse } from '../src/deparser';
import { parse } from '../src/parser';

/**
 * Assert that parse → deparse → parse produces a structurally identical AST.
 */
export function roundtrip(input: string): { first: unknown; second: unknown; output: string } {
  const ast1 = parse(input);
  const output = deparse(ast1);
  const ast2 = parse(output);
  return { first: cleanTree(ast1), second: cleanTree(ast2), output };
}
