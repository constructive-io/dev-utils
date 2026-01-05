import { deparse, Expr } from '../src/deparser';

describe('CEL Deparser', () => {
  describe('Constants', () => {
    it('deparses null', () => {
      const expr: Expr = { constExpr: { nullValue: null } };
      expect(deparse(expr)).toBe('null');
    });

    it('deparses boolean true', () => {
      const expr: Expr = { constExpr: { boolValue: true } };
      expect(deparse(expr)).toBe('true');
    });

    it('deparses boolean false', () => {
      const expr: Expr = { constExpr: { boolValue: false } };
      expect(deparse(expr)).toBe('false');
    });

    it('deparses int64', () => {
      const expr: Expr = { constExpr: { int64Value: 42 } };
      expect(deparse(expr)).toBe('42');
    });

    it('deparses uint64', () => {
      const expr: Expr = { constExpr: { uint64Value: 42 } };
      expect(deparse(expr)).toBe('42u');
    });

    it('deparses double', () => {
      const expr: Expr = { constExpr: { doubleValue: 3.14 } };
      expect(deparse(expr)).toBe('3.14');
    });

    it('deparses integer double as float', () => {
      const expr: Expr = { constExpr: { doubleValue: 5 } };
      expect(deparse(expr)).toBe('5.0');
    });

    it('deparses string', () => {
      const expr: Expr = { constExpr: { stringValue: 'hello' } };
      expect(deparse(expr)).toBe('"hello"');
    });

    it('escapes special characters in strings', () => {
      const expr: Expr = { constExpr: { stringValue: 'hello\nworld' } };
      expect(deparse(expr)).toBe('"hello\\nworld"');
    });

    it('deparses bytes', () => {
      const expr: Expr = { constExpr: { bytesValue: 'abc' } };
      expect(deparse(expr)).toBe('b"abc"');
    });
  });

  describe('Identifiers', () => {
    it('deparses simple identifier', () => {
      const expr: Expr = { identExpr: { name: 'request' } };
      expect(deparse(expr)).toBe('request');
    });
  });

  describe('Select expressions', () => {
    it('deparses field access', () => {
      const expr: Expr = {
        selectExpr: {
          operand: { identExpr: { name: 'request' } },
          field: 'auth'
        }
      };
      expect(deparse(expr)).toBe('request.auth');
    });

    it('deparses nested field access', () => {
      const expr: Expr = {
        selectExpr: {
          operand: {
            selectExpr: {
              operand: { identExpr: { name: 'request' } },
              field: 'auth'
            }
          },
          field: 'claims'
        }
      };
      expect(deparse(expr)).toBe('request.auth.claims');
    });

    it('deparses has() macro', () => {
      const expr: Expr = {
        selectExpr: {
          operand: { identExpr: { name: 'request' } },
          field: 'auth',
          testOnly: true
        }
      };
      expect(deparse(expr)).toBe('has(request.auth)');
    });
  });

  describe('Call expressions', () => {
    it('deparses function call', () => {
      const expr: Expr = {
        callExpr: {
          function: 'size',
          args: [{ identExpr: { name: 'list' } }]
        }
      };
      expect(deparse(expr)).toBe('size(list)');
    });

    it('deparses method call', () => {
      const expr: Expr = {
        callExpr: {
          target: { identExpr: { name: 'str' } },
          function: 'startsWith',
          args: [{ constExpr: { stringValue: 'prefix' } }]
        }
      };
      expect(deparse(expr)).toBe('str.startsWith("prefix")');
    });

    it('deparses binary operator', () => {
      const expr: Expr = {
        callExpr: {
          function: '_+_',
          args: [
            { constExpr: { int64Value: 1 } },
            { constExpr: { int64Value: 2 } }
          ]
        }
      };
      expect(deparse(expr)).toBe('1 + 2');
    });

    it('deparses comparison operator', () => {
      const expr: Expr = {
        callExpr: {
          function: '_==_',
          args: [
            { identExpr: { name: 'x' } },
            { constExpr: { int64Value: 5 } }
          ]
        }
      };
      expect(deparse(expr)).toBe('x == 5');
    });

    it('deparses logical AND', () => {
      const expr: Expr = {
        callExpr: {
          function: '_&&_',
          args: [
            { constExpr: { boolValue: true } },
            { constExpr: { boolValue: false } }
          ]
        }
      };
      expect(deparse(expr)).toBe('true && false');
    });

    it('deparses logical OR', () => {
      const expr: Expr = {
        callExpr: {
          function: '_||_',
          args: [
            { constExpr: { boolValue: true } },
            { constExpr: { boolValue: false } }
          ]
        }
      };
      expect(deparse(expr)).toBe('true || false');
    });

    it('deparses unary negation', () => {
      const expr: Expr = {
        callExpr: {
          function: '!_',
          args: [{ constExpr: { boolValue: true } }]
        }
      };
      expect(deparse(expr)).toBe('!true');
    });

    it('deparses unary minus', () => {
      const expr: Expr = {
        callExpr: {
          function: '-_',
          args: [{ constExpr: { int64Value: 5 } }]
        }
      };
      expect(deparse(expr)).toBe('-5');
    });

    it('deparses ternary conditional', () => {
      const expr: Expr = {
        callExpr: {
          function: '_?_:_',
          args: [
            { constExpr: { boolValue: true } },
            { constExpr: { int64Value: 1 } },
            { constExpr: { int64Value: 2 } }
          ]
        }
      };
      expect(deparse(expr)).toBe('true ? 1 : 2');
    });

    it('deparses index operator', () => {
      const expr: Expr = {
        callExpr: {
          function: '_[_]',
          args: [
            { identExpr: { name: 'list' } },
            { constExpr: { int64Value: 0 } }
          ]
        }
      };
      expect(deparse(expr)).toBe('list[0]');
    });

    it('deparses in operator', () => {
      const expr: Expr = {
        callExpr: {
          function: '@in',
          args: [
            { constExpr: { int64Value: 1 } },
            { identExpr: { name: 'list' } }
          ]
        }
      };
      expect(deparse(expr)).toBe('1 in list');
    });
  });

  describe('List expressions', () => {
    it('deparses empty list', () => {
      const expr: Expr = { listExpr: { elements: [] } };
      expect(deparse(expr)).toBe('[]');
    });

    it('deparses list with elements', () => {
      const expr: Expr = {
        listExpr: {
          elements: [
            { constExpr: { int64Value: 1 } },
            { constExpr: { int64Value: 2 } },
            { constExpr: { int64Value: 3 } }
          ]
        }
      };
      expect(deparse(expr)).toBe('[1, 2, 3]');
    });

    it('deparses list with optional elements', () => {
      const expr: Expr = {
        listExpr: {
          elements: [
            { constExpr: { int64Value: 1 } },
            { constExpr: { int64Value: 2 } }
          ],
          optionalIndices: [1]
        }
      };
      expect(deparse(expr)).toBe('[1, ?2]');
    });
  });

  describe('Struct expressions', () => {
    it('deparses empty map', () => {
      const expr: Expr = { structExpr: { entries: [] } };
      expect(deparse(expr)).toBe('{}');
    });

    it('deparses map with entries', () => {
      const expr: Expr = {
        structExpr: {
          entries: [
            {
              mapKey: { constExpr: { stringValue: 'key' } },
              value: { constExpr: { int64Value: 1 } }
            }
          ]
        }
      };
      expect(deparse(expr)).toBe('{"key": 1}');
    });

    it('deparses message construction', () => {
      const expr: Expr = {
        structExpr: {
          messageName: 'MyMessage',
          entries: [
            {
              fieldKey: 'field1',
              value: { constExpr: { int64Value: 42 } }
            }
          ]
        }
      };
      expect(deparse(expr)).toBe('MyMessage{field1: 42}');
    });
  });

  describe('Complex expressions', () => {
    it('deparses complex boolean expression', () => {
      // (x > 5) && (y < 10)
      const expr: Expr = {
        callExpr: {
          function: '_&&_',
          args: [
            {
              callExpr: {
                function: '_>_',
                args: [
                  { identExpr: { name: 'x' } },
                  { constExpr: { int64Value: 5 } }
                ]
              }
            },
            {
              callExpr: {
                function: '_<_',
                args: [
                  { identExpr: { name: 'y' } },
                  { constExpr: { int64Value: 10 } }
                ]
              }
            }
          ]
        }
      };
      expect(deparse(expr)).toBe('x > 5 && y < 10');
    });

    it('deparses method chain', () => {
      // str.trim().toLowerCase()
      const expr: Expr = {
        callExpr: {
          target: {
            callExpr: {
              target: { identExpr: { name: 'str' } },
              function: 'trim',
              args: []
            }
          },
          function: 'toLowerCase',
          args: []
        }
      };
      expect(deparse(expr)).toBe('str.trim().toLowerCase()');
    });
  });

  describe('Options', () => {
    it('removes spaces when spaces option is false', () => {
      const expr: Expr = {
        callExpr: {
          function: '_+_',
          args: [
            { constExpr: { int64Value: 1 } },
            { constExpr: { int64Value: 2 } }
          ]
        }
      };
      expect(deparse(expr, { spaces: false })).toBe('1+2');
    });
  });
});
