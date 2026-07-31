/**
 * CEL Deparser - Converts CEL AST back to CEL expression strings
 *
 * This module provides functionality to convert a CEL Abstract Syntax Tree (AST)
 * back into a valid CEL expression string. It handles all CEL constructs including:
 * - Literals (int, uint, double, string, bytes, bool, null)
 * - Identifiers and field selection
 * - Function calls and operators
 * - Lists and maps
 * - Comprehensions (macros like all, exists, filter, map)
 * - Ternary conditionals
 */

// CEL operator precedence (higher number = higher precedence)
export const PRECEDENCE = {
  CONDITIONAL: 1, // ?:
  OR: 2, // ||
  AND: 3, // &&
  RELATION: 4, // == != < <= > >= in
  ADDITION: 5, // + -
  MULTIPLICATION: 6, // * / %
  UNARY: 7, // ! -
  MEMBER: 8, // . [] ()
  PRIMARY: 9 // literals, identifiers, parentheses
} as const;

// Binary operators and their precedence
const BINARY_OPERATORS: Record<string, { symbol: string; precedence: number }> = {
  '_||_': { symbol: '||', precedence: PRECEDENCE.OR },
  '_&&_': { symbol: '&&', precedence: PRECEDENCE.AND },
  '_==_': { symbol: '==', precedence: PRECEDENCE.RELATION },
  '_!=_': { symbol: '!=', precedence: PRECEDENCE.RELATION },
  '_<_': { symbol: '<', precedence: PRECEDENCE.RELATION },
  '_<=_': { symbol: '<=', precedence: PRECEDENCE.RELATION },
  '_>_': { symbol: '>', precedence: PRECEDENCE.RELATION },
  '_>=_': { symbol: '>=', precedence: PRECEDENCE.RELATION },
  '@in': { symbol: 'in', precedence: PRECEDENCE.RELATION },
  _in_: { symbol: 'in', precedence: PRECEDENCE.RELATION },
  '_+_': { symbol: '+', precedence: PRECEDENCE.ADDITION },
  '_-_': { symbol: '-', precedence: PRECEDENCE.ADDITION },
  '_*_': { symbol: '*', precedence: PRECEDENCE.MULTIPLICATION },
  '_/_': { symbol: '/', precedence: PRECEDENCE.MULTIPLICATION },
  '_%%_': { symbol: '%', precedence: PRECEDENCE.MULTIPLICATION }
};

// Unary operators
const UNARY_OPERATORS: Record<string, string> = {
  '!_': '!',
  '-_': '-'
};

/**
 * CEL AST Types (simplified for deparser use)
 */
export interface Expr {
  id?: bigint | number;
  constExpr?: Constant;
  identExpr?: Ident;
  selectExpr?: Select;
  callExpr?: Call;
  listExpr?: CreateList;
  structExpr?: CreateStruct;
  comprehensionExpr?: Comprehension;
}

export interface Constant {
  nullValue?: unknown;
  boolValue?: boolean;
  int64Value?: bigint | number;
  uint64Value?: bigint | number;
  doubleValue?: number;
  stringValue?: string;
  bytesValue?: Uint8Array | string;
}

export interface Ident {
  name?: string;
}

export interface Select {
  operand?: Expr;
  field?: string;
  testOnly?: boolean;
}

export interface Call {
  target?: Expr;
  function?: string;
  args?: Expr[];
}

export interface CreateList {
  elements?: Expr[];
  optionalIndices?: number[];
}

export interface CreateStruct {
  messageName?: string;
  entries?: Entry[];
}

export interface Entry {
  id?: bigint | number;
  fieldKey?: string;
  mapKey?: Expr;
  value?: Expr;
  optionalEntry?: boolean;
}

export interface Comprehension {
  iterVar?: string;
  iterVar2?: string;
  iterRange?: Expr;
  accuVar?: string;
  accuInit?: Expr;
  loopCondition?: Expr;
  loopStep?: Expr;
  result?: Expr;
}

export interface DeparserOptions {
  /** Whether to add spaces around operators */
  spaces?: boolean;
}

/**
 * Escape a string for CEL string literal
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Escape bytes for CEL bytes literal
 */
function escapeBytes(bytes: Uint8Array | string): string {
  if (typeof bytes === 'string') {
    // Assume it's already a hex string or similar
    return bytes;
  }
  return Array.from(bytes)
    .map((b) => {
      if (b >= 32 && b < 127 && b !== 34 && b !== 92) {
        return String.fromCharCode(b);
      }
      return '\\x' + b.toString(16).padStart(2, '0');
    })
    .join('');
}

/**
 * Get the precedence of an expression
 */
function getExprPrecedence(expr: Expr): number {
  if (expr.constExpr) return PRECEDENCE.PRIMARY;
  if (expr.identExpr) return PRECEDENCE.PRIMARY;
  if (expr.listExpr) return PRECEDENCE.PRIMARY;
  if (expr.structExpr) return PRECEDENCE.PRIMARY;
  if (expr.selectExpr) return PRECEDENCE.MEMBER;
  if (expr.callExpr) {
    const fn = expr.callExpr.function || '';
    if (UNARY_OPERATORS[fn]) return PRECEDENCE.UNARY;
    if (BINARY_OPERATORS[fn]) return BINARY_OPERATORS[fn].precedence;
    if (fn === '_?_:_') return PRECEDENCE.CONDITIONAL;
    if (fn === '_[_]') return PRECEDENCE.MEMBER;
    return PRECEDENCE.MEMBER; // function call
  }
  if (expr.comprehensionExpr) return PRECEDENCE.PRIMARY;
  return PRECEDENCE.PRIMARY;
}

/**
 * Deparse a CEL expression AST to a string
 */
export function deparse(expr: Expr, options: DeparserOptions = {}): string {
  const spaces = options.spaces ?? true;
  const sp = spaces ? ' ' : '';

  function deparseExpr(e: Expr, parentPrecedence: number = 0): string {
    // Constant expression
    if (e.constExpr) {
      return deparseConstant(e.constExpr);
    }

    // Identifier expression
    if (e.identExpr) {
      return e.identExpr.name || '';
    }

    // Select expression (field access)
    if (e.selectExpr) {
      const operand = e.selectExpr.operand
        ? deparseExpr(e.selectExpr.operand, PRECEDENCE.MEMBER)
        : '';
      const field = e.selectExpr.field || '';

      if (e.selectExpr.testOnly) {
        // This is the result of has() macro
        return `has(${operand}.${field})`;
      }

      return `${operand}.${field}`;
    }

    // Call expression (function calls and operators)
    if (e.callExpr) {
      return deparseCall(e.callExpr, parentPrecedence);
    }

    // List expression
    if (e.listExpr) {
      const elements = e.listExpr.elements || [];
      const optionalIndices = new Set(e.listExpr.optionalIndices || []);

      const items = elements.map((el, i) => {
        const prefix = optionalIndices.has(i) ? '?' : '';
        return prefix + deparseExpr(el);
      });

      return `[${items.join(', ')}]`;
    }

    // Struct expression (map or message)
    if (e.structExpr) {
      return deparseStruct(e.structExpr);
    }

    // Comprehension expression (macros)
    if (e.comprehensionExpr) {
      return deparseComprehension(e.comprehensionExpr);
    }

    return '';
  }

  function deparseConstant(c: Constant): string {
    if (c.nullValue !== undefined) {
      return 'null';
    }
    if (c.boolValue !== undefined) {
      return c.boolValue ? 'true' : 'false';
    }
    if (c.int64Value !== undefined) {
      return String(c.int64Value);
    }
    if (c.uint64Value !== undefined) {
      return String(c.uint64Value) + 'u';
    }
    if (c.doubleValue !== undefined) {
      const d = c.doubleValue;
      // Ensure it looks like a float
      if (Number.isInteger(d)) {
        return d.toFixed(1);
      }
      return String(d);
    }
    if (c.stringValue !== undefined) {
      return `"${escapeString(c.stringValue)}"`;
    }
    if (c.bytesValue !== undefined) {
      return `b"${escapeBytes(c.bytesValue)}"`;
    }
    return '';
  }

  function deparseCall(call: Call, parentPrecedence: number): string {
    const fn = call.function || '';
    const args = call.args || [];
    const target = call.target;

    // Ternary conditional
    if (fn === '_?_:_' && args.length === 3) {
      const condition = deparseExpr(args[0], PRECEDENCE.CONDITIONAL);
      const trueExpr = deparseExpr(args[1], PRECEDENCE.CONDITIONAL);
      const falseExpr = deparseExpr(args[2], PRECEDENCE.CONDITIONAL);
      const result = `${condition}${sp}?${sp}${trueExpr}${sp}:${sp}${falseExpr}`;
      return parentPrecedence > PRECEDENCE.CONDITIONAL
        ? `(${result})`
        : result;
    }

    // Index operator
    if (fn === '_[_]' && args.length === 2) {
      const obj = deparseExpr(args[0], PRECEDENCE.MEMBER);
      const index = deparseExpr(args[1]);
      return `${obj}[${index}]`;
    }

    // Unary operators
    if (UNARY_OPERATORS[fn] && args.length === 1) {
      const op = UNARY_OPERATORS[fn];
      const operand = deparseExpr(args[0], PRECEDENCE.UNARY);
      return `${op}${operand}`;
    }

    // Binary operators
    if (BINARY_OPERATORS[fn] && args.length === 2) {
      const { symbol, precedence } = BINARY_OPERATORS[fn];
      const left = deparseExpr(args[0], precedence);
      const right = deparseExpr(args[1], precedence + 1); // Right associative needs higher precedence
      const result = `${left}${sp}${symbol}${sp}${right}`;
      return parentPrecedence > precedence ? `(${result})` : result;
    }

    // Method call (target.function(args))
    if (target) {
      const targetStr = deparseExpr(target, PRECEDENCE.MEMBER);
      const argsStr = args.map((a) => deparseExpr(a)).join(', ');
      return `${targetStr}.${fn}(${argsStr})`;
    }

    // Regular function call
    const argsStr = args.map((a) => deparseExpr(a)).join(', ');
    return `${fn}(${argsStr})`;
  }

  function deparseStruct(struct: CreateStruct): string {
    const messageName = struct.messageName || '';
    const entries = struct.entries || [];

    const items = entries.map((entry) => {
      const prefix = entry.optionalEntry ? '?' : '';

      if (entry.fieldKey) {
        // Message field
        const value = entry.value ? deparseExpr(entry.value) : '';
        return `${prefix}${entry.fieldKey}: ${value}`;
      } else if (entry.mapKey) {
        // Map entry
        const key = deparseExpr(entry.mapKey);
        const value = entry.value ? deparseExpr(entry.value) : '';
        return `${prefix}${key}: ${value}`;
      }
      return '';
    });

    if (messageName) {
      // Message construction
      return `${messageName}{${items.join(', ')}}`;
    } else {
      // Map literal
      return `{${items.join(', ')}}`;
    }
  }

  function deparseComprehension(comp: Comprehension): string {
    // Comprehensions are typically the result of macro expansion
    // We try to reconstruct the original macro call

    const iterVar = comp.iterVar || '';
    const iterRange = comp.iterRange ? deparseExpr(comp.iterRange) : '';
    const loopCondition = comp.loopCondition
      ? deparseExpr(comp.loopCondition)
      : '';
    const loopStep = comp.loopStep ? deparseExpr(comp.loopStep) : '';
    const result = comp.result ? deparseExpr(comp.result) : '';
    const accuVar = comp.accuVar || '';
    const accuInit = comp.accuInit ? deparseExpr(comp.accuInit) : '';

    // Try to detect common macros based on structure

    // exists: __result__ == true, accu starts false, step is || condition
    if (accuVar === '__result__' && accuInit === 'false') {
      // This looks like exists()
      return `${iterRange}.exists(${iterVar}, ${loopStep.replace(
        '__result__ || ',
        ''
      )})`;
    }

    // all: __result__ == true, accu starts true, step is && condition
    if (accuVar === '__result__' && accuInit === 'true') {
      // This looks like all()
      return `${iterRange}.all(${iterVar}, ${loopStep.replace(
        '__result__ && ',
        ''
      )})`;
    }

    // For other comprehensions, output a comment indicating it's a comprehension
    // This is a fallback - ideally we'd reconstruct the original macro
    return `/* comprehension: ${iterVar} in ${iterRange} */`;
  }

  return deparseExpr(expr);
}

/**
 * Generate TypeScript code for the deparser module
 */
export function generateDeparserCode(): string {
  // Return the deparser code as a string that can be written to a file
  return `/**
 * CEL Deparser - Converts CEL AST back to CEL expression strings
 * 
 * This file was automatically generated by cel-proto-parser.
 * DO NOT MODIFY IT BY HAND.
 */

import type { Expr, Constant, Call, CreateStruct, Comprehension } from './types';

// CEL operator precedence (higher number = higher precedence)
export const PRECEDENCE = {
  CONDITIONAL: 1, // ?:
  OR: 2,          // ||
  AND: 3,         // &&
  RELATION: 4,    // == != < <= > >= in
  ADDITION: 5,    // + -
  MULTIPLICATION: 6, // * / %
  UNARY: 7,       // ! -
  MEMBER: 8,      // . [] ()
  PRIMARY: 9      // literals, identifiers, parentheses
} as const;

// Binary operators and their precedence
const BINARY_OPERATORS: Record<string, { symbol: string; precedence: number }> = {
  '_||_': { symbol: '||', precedence: PRECEDENCE.OR },
  '_&&_': { symbol: '&&', precedence: PRECEDENCE.AND },
  '_==_': { symbol: '==', precedence: PRECEDENCE.RELATION },
  '_!=_': { symbol: '!=', precedence: PRECEDENCE.RELATION },
  '_<_': { symbol: '<', precedence: PRECEDENCE.RELATION },
  '_<=_': { symbol: '<=', precedence: PRECEDENCE.RELATION },
  '_>_': { symbol: '>', precedence: PRECEDENCE.RELATION },
  '_>=_': { symbol: '>=', precedence: PRECEDENCE.RELATION },
  '@in': { symbol: 'in', precedence: PRECEDENCE.RELATION },
  '_in_': { symbol: 'in', precedence: PRECEDENCE.RELATION },
  '_+_': { symbol: '+', precedence: PRECEDENCE.ADDITION },
  '_-_': { symbol: '-', precedence: PRECEDENCE.ADDITION },
  '_*_': { symbol: '*', precedence: PRECEDENCE.MULTIPLICATION },
  '_/_': { symbol: '/', precedence: PRECEDENCE.MULTIPLICATION },
  '_%%_': { symbol: '%', precedence: PRECEDENCE.MULTIPLICATION }
};

// Unary operators
const UNARY_OPERATORS: Record<string, string> = {
  '!_': '!',
  '-_': '-'
};

export interface DeparserOptions {
  /** Whether to add spaces around operators */
  spaces?: boolean;
}

/**
 * Escape a string for CEL string literal
 */
function escapeString(str: string): string {
  return str
    .replace(/\\\\/g, '\\\\\\\\')
    .replace(/"/g, '\\\\"')
    .replace(/\\n/g, '\\\\n')
    .replace(/\\r/g, '\\\\r')
    .replace(/\\t/g, '\\\\t');
}

/**
 * Escape bytes for CEL bytes literal
 */
function escapeBytes(bytes: Uint8Array | string): string {
  if (typeof bytes === 'string') {
    return bytes;
  }
  return Array.from(bytes)
    .map((b) => {
      if (b >= 32 && b < 127 && b !== 34 && b !== 92) {
        return String.fromCharCode(b);
      }
      return '\\\\x' + b.toString(16).padStart(2, '0');
    })
    .join('');
}

/**
 * Deparse a CEL expression AST to a string
 */
export function deparse(expr: Expr, options: DeparserOptions = {}): string {
  const spaces = options.spaces ?? true;
  const sp = spaces ? ' ' : '';

  function deparseExpr(e: Expr, parentPrecedence: number = 0): string {
    if (e.constExpr) return deparseConstant(e.constExpr);
    if (e.identExpr) return e.identExpr.name || '';
    if (e.selectExpr) {
      const operand = e.selectExpr.operand ? deparseExpr(e.selectExpr.operand, PRECEDENCE.MEMBER) : '';
      const field = e.selectExpr.field || '';
      if (e.selectExpr.testOnly) return \`has(\${operand}.\${field})\`;
      return \`\${operand}.\${field}\`;
    }
    if (e.callExpr) return deparseCall(e.callExpr, parentPrecedence);
    if (e.listExpr) {
      const elements = e.listExpr.elements || [];
      const optionalIndices = new Set(e.listExpr.optionalIndices || []);
      const items = elements.map((el, i) => {
        const prefix = optionalIndices.has(i) ? '?' : '';
        return prefix + deparseExpr(el);
      });
      return \`[\${items.join(', ')}]\`;
    }
    if (e.structExpr) return deparseStruct(e.structExpr);
    if (e.comprehensionExpr) return deparseComprehension(e.comprehensionExpr);
    return '';
  }

  function deparseConstant(c: Constant): string {
    if (c.nullValue !== undefined) return 'null';
    if (c.boolValue !== undefined) return c.boolValue ? 'true' : 'false';
    if (c.int64Value !== undefined) return String(c.int64Value);
    if (c.uint64Value !== undefined) return String(c.uint64Value) + 'u';
    if (c.doubleValue !== undefined) {
      const d = c.doubleValue;
      if (Number.isInteger(d)) return d.toFixed(1);
      return String(d);
    }
    if (c.stringValue !== undefined) return \`"\${escapeString(c.stringValue)}"\`;
    if (c.bytesValue !== undefined) return \`b"\${escapeBytes(c.bytesValue)}"\`;
    return '';
  }

  function deparseCall(call: Call, parentPrecedence: number): string {
    const fn = call.function || '';
    const args = call.args || [];
    const target = call.target;

    if (fn === '_?_:_' && args.length === 3) {
      const condition = deparseExpr(args[0], PRECEDENCE.CONDITIONAL);
      const trueExpr = deparseExpr(args[1], PRECEDENCE.CONDITIONAL);
      const falseExpr = deparseExpr(args[2], PRECEDENCE.CONDITIONAL);
      const result = \`\${condition}\${sp}?\${sp}\${trueExpr}\${sp}:\${sp}\${falseExpr}\`;
      return parentPrecedence > PRECEDENCE.CONDITIONAL ? \`(\${result})\` : result;
    }

    if (fn === '_[_]' && args.length === 2) {
      const obj = deparseExpr(args[0], PRECEDENCE.MEMBER);
      const index = deparseExpr(args[1]);
      return \`\${obj}[\${index}]\`;
    }

    if (UNARY_OPERATORS[fn] && args.length === 1) {
      const op = UNARY_OPERATORS[fn];
      const operand = deparseExpr(args[0], PRECEDENCE.UNARY);
      return \`\${op}\${operand}\`;
    }

    if (BINARY_OPERATORS[fn] && args.length === 2) {
      const { symbol, precedence } = BINARY_OPERATORS[fn];
      const left = deparseExpr(args[0], precedence);
      const right = deparseExpr(args[1], precedence + 1);
      const result = \`\${left}\${sp}\${symbol}\${sp}\${right}\`;
      return parentPrecedence > precedence ? \`(\${result})\` : result;
    }

    if (target) {
      const targetStr = deparseExpr(target, PRECEDENCE.MEMBER);
      const argsStr = args.map((a) => deparseExpr(a)).join(', ');
      return \`\${targetStr}.\${fn}(\${argsStr})\`;
    }

    const argsStr = args.map((a) => deparseExpr(a)).join(', ');
    return \`\${fn}(\${argsStr})\`;
  }

  function deparseStruct(struct: CreateStruct): string {
    const messageName = struct.messageName || '';
    const entries = struct.entries || [];
    const items = entries.map((entry) => {
      const prefix = entry.optionalEntry ? '?' : '';
      if (entry.fieldKey) {
        const value = entry.value ? deparseExpr(entry.value) : '';
        return \`\${prefix}\${entry.fieldKey}: \${value}\`;
      } else if (entry.mapKey) {
        const key = deparseExpr(entry.mapKey);
        const value = entry.value ? deparseExpr(entry.value) : '';
        return \`\${prefix}\${key}: \${value}\`;
      }
      return '';
    });
    if (messageName) return \`\${messageName}{\${items.join(', ')}}\`;
    return \`{\${items.join(', ')}}\`;
  }

  function deparseComprehension(comp: Comprehension): string {
    const iterVar = comp.iterVar || '';
    const iterRange = comp.iterRange ? deparseExpr(comp.iterRange) : '';
    const accuVar = comp.accuVar || '';
    const accuInit = comp.accuInit ? deparseExpr(comp.accuInit) : '';
    const loopStep = comp.loopStep ? deparseExpr(comp.loopStep) : '';

    if (accuVar === '__result__' && accuInit === 'false') {
      return \`\${iterRange}.exists(\${iterVar}, \${loopStep.replace('__result__ || ', '')})\`;
    }
    if (accuVar === '__result__' && accuInit === 'true') {
      return \`\${iterRange}.all(\${iterVar}, \${loopStep.replace('__result__ && ', '')})\`;
    }
    return \`/* comprehension: \${iterVar} in \${iterRange} */\`;
  }

  return deparseExpr(expr);
}
`;
}
