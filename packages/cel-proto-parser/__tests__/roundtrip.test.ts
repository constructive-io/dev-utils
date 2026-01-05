/**
 * CEL Round-Trip Tests
 *
 * Tests the CEL AST converter and deparser functionality.
 * 
 * Note: Full round-trip testing with @marcbachmann/cel-js requires ESM support.
 * Use the scripts/test-roundtrip.ts script for comprehensive round-trip testing.
 * 
 * These tests verify the converter and deparser work correctly with
 * manually constructed ASTs that match the @marcbachmann/cel-js format.
 */

import { deparse, Expr } from '../src/deparser';
import { convertToProtoExpr, MarcAstNode } from '../src/converter';

describe('CEL AST Converter', () => {
  describe('Value Conversion', () => {
    it('converts integer value', () => {
      const marcAst: MarcAstNode = {
        op: 'value',
        args: 42n
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.constExpr).toBeDefined();
      expect(expr.constExpr?.int64Value).toBe(42n);
    });

    it('converts string value', () => {
      const marcAst: MarcAstNode = {
        op: 'value',
        args: 'hello'
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.constExpr).toBeDefined();
      expect(expr.constExpr?.stringValue).toBe('hello');
    });

    it('converts boolean value', () => {
      const marcAst: MarcAstNode = {
        op: 'value',
        args: true
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.constExpr).toBeDefined();
      expect(expr.constExpr?.boolValue).toBe(true);
    });

    it('converts null value', () => {
      const marcAst: MarcAstNode = {
        op: 'value',
        args: null
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.constExpr).toBeDefined();
      expect(expr.constExpr?.nullValue).toBe(null);
    });

    it('converts double value', () => {
      const marcAst: MarcAstNode = {
        op: 'value',
        args: 3.14
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.constExpr).toBeDefined();
      expect(expr.constExpr?.doubleValue).toBe(3.14);
    });
  });

  describe('Identifier Conversion', () => {
    it('converts identifier', () => {
      const marcAst: MarcAstNode = {
        op: 'id',
        args: 'request'
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.identExpr).toBeDefined();
      expect(expr.identExpr?.name).toBe('request');
    });
  });

  describe('Field Access Conversion', () => {
    it('converts field access', () => {
      const marcAst: MarcAstNode = {
        op: '.',
        args: [
          { op: 'id', args: 'request' },
          'auth'
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.selectExpr).toBeDefined();
      expect(expr.selectExpr?.field).toBe('auth');
      expect(expr.selectExpr?.operand?.identExpr?.name).toBe('request');
    });

    it('converts nested field access', () => {
      const marcAst: MarcAstNode = {
        op: '.',
        args: [
          {
            op: '.',
            args: [
              { op: 'id', args: 'request' },
              'auth'
            ]
          },
          'claims'
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.selectExpr).toBeDefined();
      expect(expr.selectExpr?.field).toBe('claims');
    });
  });

  describe('Binary Operator Conversion', () => {
    it('converts addition', () => {
      const marcAst: MarcAstNode = {
        op: '+',
        args: [
          { op: 'value', args: 1n },
          { op: 'value', args: 2n }
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.callExpr).toBeDefined();
      expect(expr.callExpr?.function).toBe('_+_');
      expect(expr.callExpr?.args).toHaveLength(2);
    });

    it('converts comparison', () => {
      const marcAst: MarcAstNode = {
        op: '==',
        args: [
          { op: 'id', args: 'a' },
          { op: 'id', args: 'b' }
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.callExpr).toBeDefined();
      expect(expr.callExpr?.function).toBe('_==_');
    });

    it('converts logical and', () => {
      const marcAst: MarcAstNode = {
        op: '&&',
        args: [
          { op: 'id', args: 'a' },
          { op: 'id', args: 'b' }
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.callExpr).toBeDefined();
      expect(expr.callExpr?.function).toBe('_&&_');
    });

    it('converts logical or', () => {
      const marcAst: MarcAstNode = {
        op: '||',
        args: [
          { op: 'id', args: 'a' },
          { op: 'id', args: 'b' }
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.callExpr).toBeDefined();
      expect(expr.callExpr?.function).toBe('_||_');
    });

    it('converts in operator', () => {
      const marcAst: MarcAstNode = {
        op: 'in',
        args: [
          { op: 'id', args: 'x' },
          { op: 'id', args: 'list' }
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.callExpr).toBeDefined();
      expect(expr.callExpr?.function).toBe('_in_');
    });
  });

  describe('Unary Operator Conversion', () => {
    it('converts negation', () => {
      const marcAst: MarcAstNode = {
        op: '!',
        args: [{ op: 'id', args: 'a' }]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.callExpr).toBeDefined();
      expect(expr.callExpr?.function).toBe('!_');
    });
  });

  describe('Ternary Conversion', () => {
    it('converts ternary conditional', () => {
      const marcAst: MarcAstNode = {
        op: '?:',
        args: [
          { op: 'id', args: 'x' },
          { op: 'value', args: 1n },
          { op: 'value', args: 2n }
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.callExpr).toBeDefined();
      expect(expr.callExpr?.function).toBe('_?_:_');
      expect(expr.callExpr?.args).toHaveLength(3);
    });
  });

  describe('Function Call Conversion', () => {
    it('converts function call', () => {
      const marcAst: MarcAstNode = {
        op: 'call',
        args: [
          'size',
          [{ op: 'id', args: 'list' }]
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.callExpr).toBeDefined();
      expect(expr.callExpr?.function).toBe('size');
      expect(expr.callExpr?.args).toHaveLength(1);
    });

    it('converts has() macro', () => {
      const marcAst: MarcAstNode = {
        op: 'call',
        args: [
          'has',
          [{
            op: '.',
            args: [
              { op: 'id', args: 'request' },
              'auth'
            ]
          }]
        ],
        macro: {}
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.selectExpr).toBeDefined();
      expect(expr.selectExpr?.testOnly).toBe(true);
      expect(expr.selectExpr?.field).toBe('auth');
    });
  });

  describe('Method Call Conversion', () => {
    it('converts method call', () => {
      const marcAst: MarcAstNode = {
        op: 'rcall',
        args: [
          'size',
          { op: 'id', args: 'list' },
          []
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.callExpr).toBeDefined();
      expect(expr.callExpr?.function).toBe('size');
      expect(expr.callExpr?.target).toBeDefined();
    });
  });

  describe('List Conversion', () => {
    it('converts empty list', () => {
      const marcAst: MarcAstNode = {
        op: 'list',
        args: []
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.listExpr).toBeDefined();
      expect(expr.listExpr?.elements).toHaveLength(0);
    });

    it('converts list with elements', () => {
      const marcAst: MarcAstNode = {
        op: 'list',
        args: [
          { op: 'value', args: 1n },
          { op: 'value', args: 2n },
          { op: 'value', args: 3n }
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.listExpr).toBeDefined();
      expect(expr.listExpr?.elements).toHaveLength(3);
    });
  });

  describe('Map Conversion', () => {
    it('converts empty map', () => {
      const marcAst: MarcAstNode = {
        op: 'map',
        args: []
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.structExpr).toBeDefined();
      expect(expr.structExpr?.entries).toHaveLength(0);
    });

    it('converts map with entries', () => {
      const marcAst: MarcAstNode = {
        op: 'map',
        args: [
          [{ op: 'value', args: 'a' }, { op: 'value', args: 1n }],
          [{ op: 'value', args: 'b' }, { op: 'value', args: 2n }]
        ]
      };
      const expr = convertToProtoExpr(marcAst);
      expect(expr.structExpr).toBeDefined();
      expect(expr.structExpr?.entries).toHaveLength(2);
    });
  });
});

describe('Converter + Deparser Integration', () => {
  it('converts and deparses simple addition', () => {
    const marcAst: MarcAstNode = {
      op: '+',
      args: [
        { op: 'value', args: 1n },
        { op: 'value', args: 2n }
      ]
    };
    const expr = convertToProtoExpr(marcAst);
    const result = deparse(expr);
    expect(result).toBe('1 + 2');
  });

  it('converts and deparses field access', () => {
    const marcAst: MarcAstNode = {
      op: '.',
      args: [
        { op: 'id', args: 'request' },
        'auth'
      ]
    };
    const expr = convertToProtoExpr(marcAst);
    const result = deparse(expr);
    expect(result).toBe('request.auth');
  });

  it('converts and deparses function call', () => {
    const marcAst: MarcAstNode = {
      op: 'call',
      args: [
        'size',
        [{ op: 'id', args: 'list' }]
      ]
    };
    const expr = convertToProtoExpr(marcAst);
    const result = deparse(expr);
    expect(result).toBe('size(list)');
  });

  it('converts and deparses comparison', () => {
    const marcAst: MarcAstNode = {
      op: '>',
      args: [
        {
          op: 'call',
          args: [
            'size',
            [{ op: 'id', args: 'list' }]
          ]
        },
        { op: 'value', args: 0n }
      ]
    };
    const expr = convertToProtoExpr(marcAst);
    const result = deparse(expr);
    expect(result).toBe('size(list) > 0');
  });

  it('converts and deparses logical expression', () => {
    const marcAst: MarcAstNode = {
      op: '&&',
      args: [
        { op: 'id', args: 'a' },
        { op: 'id', args: 'b' }
      ]
    };
    const expr = convertToProtoExpr(marcAst);
    const result = deparse(expr);
    expect(result).toBe('a && b');
  });

  it('converts and deparses ternary', () => {
    const marcAst: MarcAstNode = {
      op: '?:',
      args: [
        { op: 'id', args: 'x' },
        { op: 'value', args: 1n },
        { op: 'value', args: 2n }
      ]
    };
    const expr = convertToProtoExpr(marcAst);
    const result = deparse(expr);
    expect(result).toBe('x ? 1 : 2');
  });

  it('converts and deparses list', () => {
    const marcAst: MarcAstNode = {
      op: 'list',
      args: [
        { op: 'value', args: 1n },
        { op: 'value', args: 2n },
        { op: 'value', args: 3n }
      ]
    };
    const expr = convertToProtoExpr(marcAst);
    const result = deparse(expr);
    expect(result).toBe('[1, 2, 3]');
  });

  it('converts and deparses map', () => {
    const marcAst: MarcAstNode = {
      op: 'map',
      args: [
        [{ op: 'value', args: 'a' }, { op: 'value', args: 1n }]
      ]
    };
    const expr = convertToProtoExpr(marcAst);
    const result = deparse(expr);
    expect(result).toBe('{"a": 1}');
  });

  it('converts and deparses complex expression', () => {
    const marcAst: MarcAstNode = {
      op: '&&',
      args: [
        {
          op: '>',
          args: [
            {
              op: '.',
              args: [
                { op: 'id', args: 'user' },
                'age'
              ]
            },
            { op: 'value', args: 18n }
          ]
        },
        {
          op: 'in',
          args: [
            { op: 'value', args: 'admin' },
            {
              op: '.',
              args: [
                { op: 'id', args: 'user' },
                'roles'
              ]
            }
          ]
        }
      ]
    };
    const expr = convertToProtoExpr(marcAst);
    const result = deparse(expr);
    expect(result).toBe('user.age > 18 && "admin" in user.roles');
  });
});
