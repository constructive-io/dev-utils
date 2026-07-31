/**
 * CEL AST Converter
 *
 * Converts AST from @marcbachmann/cel-js format to CEL proto format
 * used by our deparser.
 */

import type { Constant,Expr } from '../deparser';

/**
 * AST node from @marcbachmann/cel-js
 */
interface MarcAstNode {
  op: string;
  args: unknown;
  macro?: Record<string, unknown>;
}

/**
 * Convert @marcbachmann/cel-js AST to CEL proto Expr format
 */
export function convertToProtoExpr(node: MarcAstNode, idCounter = { value: 1 }): Expr {
  const id = BigInt(idCounter.value++);

  switch (node.op) {
  case 'value':
    return {
      id,
      constExpr: convertValue(node.args)
    };

  case 'id':
    return {
      id,
      identExpr: { name: node.args as string }
    };

  case '.': {
    const args = node.args as [MarcAstNode, string];
    return {
      id,
      selectExpr: {
        operand: convertToProtoExpr(args[0], idCounter),
        field: args[1]
      }
    };
  }

  case 'call': {
    const args = node.args as [string, MarcAstNode[]];
    const funcName = args[0];
    const funcArgs = args[1];

    // Special handling for has() macro
    if (funcName === 'has' && funcArgs.length === 1) {
      const selectNode = funcArgs[0];
      if (selectNode.op === '.') {
        const selectArgs = selectNode.args as [MarcAstNode, string];
        return {
          id,
          selectExpr: {
            operand: convertToProtoExpr(selectArgs[0], idCounter),
            field: selectArgs[1],
            testOnly: true
          }
        };
      }
    }

    return {
      id,
      callExpr: {
        function: funcName,
        args: funcArgs.map((a) => convertToProtoExpr(a, idCounter))
      }
    };
  }

  case 'rcall': {
    // Receiver call: target.method(args)
    const args = node.args as [string, MarcAstNode, MarcAstNode[]];
    const funcName = args[0];
    const target = args[1];
    const funcArgs = args[2];

    return {
      id,
      callExpr: {
        target: convertToProtoExpr(target, idCounter),
        function: funcName,
        args: funcArgs.map((a) => convertToProtoExpr(a, idCounter))
      }
    };
  }

  case 'list': {
    const elements = node.args as MarcAstNode[];
    return {
      id,
      listExpr: {
        elements: elements.map((e) => convertToProtoExpr(e, idCounter))
      }
    };
  }

  case 'map': {
    const entries = node.args as [MarcAstNode, MarcAstNode][];
    return {
      id,
      structExpr: {
        entries: entries.map(([key, value]) => ({
          id: BigInt(idCounter.value++),
          mapKey: convertToProtoExpr(key, idCounter),
          value: convertToProtoExpr(value, idCounter)
        }))
      }
    };
  }

  case 'struct': {
    const args = node.args as [string, [string, MarcAstNode][]];
    const messageName = args[0];
    const fields = args[1];

    return {
      id,
      structExpr: {
        messageName,
        entries: fields.map(([fieldKey, value]) => ({
          id: BigInt(idCounter.value++),
          fieldKey,
          value: convertToProtoExpr(value, idCounter)
        }))
      }
    };
  }

  case '?:': {
    // Ternary conditional
    const args = node.args as [MarcAstNode, MarcAstNode, MarcAstNode];
    return {
      id,
      callExpr: {
        function: '_?_:_',
        args: args.map((a) => convertToProtoExpr(a, idCounter))
      }
    };
  }

  case 'index':
  case '[]': {
    // Index access: obj[key]
    const args = node.args as [MarcAstNode, MarcAstNode];
    return {
      id,
      callExpr: {
        function: '_[_]',
        args: args.map((a) => convertToProtoExpr(a, idCounter))
      }
    };
  }

  // Binary operators
  case '+':
  case '-':
  case '*':
  case '/':
  case '%':
  case '==':
  case '!=':
  case '<':
  case '<=':
  case '>':
  case '>=':
  case '&&':
  case '||':
  case 'in': {
    const args = node.args as [MarcAstNode, MarcAstNode];
    const funcName = getBinaryOperatorName(node.op);
    return {
      id,
      callExpr: {
        function: funcName,
        args: args.map((a) => convertToProtoExpr(a, idCounter))
      }
    };
  }

  // Unary operators
  case '!':
  case '!_':
  case 'neg':
  case '-_': {
    // Args can be either a single node or an array with one element
    const argNode = Array.isArray(node.args)
      ? (node.args as MarcAstNode[])[0]
      : (node.args as MarcAstNode);
    const funcName = node.op === '!' || node.op === '!_' ? '!_' : '-_';
    return {
      id,
      callExpr: {
        function: funcName,
        args: [convertToProtoExpr(argNode, idCounter)]
      }
    };
  }

  default:
    console.warn(`Unknown operator: ${node.op}`);
    return { id };
  }
}

/**
 * Convert a value from @marcbachmann/cel-js to CEL proto Constant
 */
function convertValue(value: unknown): Constant {
  if (value === null) {
    return { nullValue: null };
  }

  if (typeof value === 'boolean') {
    return { boolValue: value };
  }

  if (typeof value === 'bigint') {
    return { int64Value: value };
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { int64Value: BigInt(value) };
    }
    return { doubleValue: value };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (value instanceof Uint8Array) {
    return { bytesValue: value };
  }

  // Handle unsigned integers (represented as objects in some cases)
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('uint' in obj) {
      return { uint64Value: obj.uint as bigint };
    }
  }

  return { stringValue: String(value) };
}

/**
 * Get the CEL proto function name for a binary operator
 */
function getBinaryOperatorName(op: string): string {
  const mapping: Record<string, string> = {
    '+': '_+_',
    '-': '_-_',
    '*': '_*_',
    '/': '_/_',
    '%': '_%%_',
    '==': '_==_',
    '!=': '_!=_',
    '<': '_<_',
    '<=': '_<=_',
    '>': '_>_',
    '>=': '_>=_',
    '&&': '_&&_',
    '||': '_||_',
    in: '_in_'
  };
  return mapping[op] || op;
}

export { MarcAstNode };
