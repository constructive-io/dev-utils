import {
  deparse,
  deparseModule,
  deparsePackage,
  deparseImport,
  deparseRule,
  deparseExpr,
  deparseTerm,
  Module,
  Package,
  Import,
  Rule,
  Expr,
  Term,
  TermType
} from '../src';

describe('Rego Deparser', () => {
  describe('Terms', () => {
    it('deparses null', () => {
      const term: Term = { type: TermType.NULL, value: null };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('null');
    });

    it('deparses boolean true', () => {
      const term: Term = { type: TermType.BOOLEAN, value: true };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('true');
    });

    it('deparses boolean false', () => {
      const term: Term = { type: TermType.BOOLEAN, value: false };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('false');
    });

    it('deparses number', () => {
      const term: Term = { type: TermType.NUMBER, value: 42 };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('42');
    });

    it('deparses float', () => {
      const term: Term = { type: TermType.NUMBER, value: 3.14 };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('3.14');
    });

    it('deparses string', () => {
      const term: Term = { type: TermType.STRING, value: 'hello' };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('"hello"');
    });

    it('escapes special characters in strings', () => {
      const term: Term = { type: TermType.STRING, value: 'hello\nworld' };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('"hello\\nworld"');
    });

    it('escapes quotes in strings', () => {
      const term: Term = { type: TermType.STRING, value: 'say "hello"' };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('"say \\"hello\\""');
    });

    it('deparses variable', () => {
      const term: Term = { type: TermType.VAR, value: 'x' };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('x');
    });
  });

  describe('References', () => {
    it('deparses simple ref', () => {
      const term: Term = {
        type: TermType.REF,
        value: [
          { type: TermType.VAR, value: 'data' },
          { type: TermType.STRING, value: 'users' }
        ]
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('data.users');
    });

    it('deparses nested ref', () => {
      const term: Term = {
        type: TermType.REF,
        value: [
          { type: TermType.VAR, value: 'input' },
          { type: TermType.STRING, value: 'request' },
          { type: TermType.STRING, value: 'user' }
        ]
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('input.request.user');
    });

    it('deparses ref with variable index', () => {
      const term: Term = {
        type: TermType.REF,
        value: [
          { type: TermType.VAR, value: 'arr' },
          { type: TermType.VAR, value: 'i' }
        ]
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('arr[i]');
    });

    it('deparses ref with string key containing special chars', () => {
      const term: Term = {
        type: TermType.REF,
        value: [
          { type: TermType.VAR, value: 'obj' },
          { type: TermType.STRING, value: 'key-with-dash' }
        ]
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('obj["key-with-dash"]');
    });
  });

  describe('Arrays', () => {
    it('deparses empty array', () => {
      const term: Term = { type: TermType.ARRAY, value: [] };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('[]');
    });

    it('deparses array with elements', () => {
      const term: Term = {
        type: TermType.ARRAY,
        value: [
          { type: TermType.NUMBER, value: 1 },
          { type: TermType.NUMBER, value: 2 },
          { type: TermType.NUMBER, value: 3 }
        ]
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('[1, 2, 3]');
    });

    it('deparses nested array', () => {
      const term: Term = {
        type: TermType.ARRAY,
        value: [
          {
            type: TermType.ARRAY,
            value: [
              { type: TermType.NUMBER, value: 1 },
              { type: TermType.NUMBER, value: 2 }
            ]
          },
          {
            type: TermType.ARRAY,
            value: [
              { type: TermType.NUMBER, value: 3 },
              { type: TermType.NUMBER, value: 4 }
            ]
          }
        ]
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('[[1, 2], [3, 4]]');
    });
  });

  describe('Sets', () => {
    it('deparses empty set', () => {
      const term: Term = { type: TermType.SET, value: [] };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('set()');
    });

    it('deparses set with elements', () => {
      const term: Term = {
        type: TermType.SET,
        value: [
          { type: TermType.STRING, value: 'a' },
          { type: TermType.STRING, value: 'b' },
          { type: TermType.STRING, value: 'c' }
        ]
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('{"a", "b", "c"}');
    });
  });

  describe('Objects', () => {
    it('deparses empty object', () => {
      const term: Term = { type: TermType.OBJECT, value: [] };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('{}');
    });

    it('deparses object with entries', () => {
      const term: Term = {
        type: TermType.OBJECT,
        value: [
          {
            key: { type: TermType.STRING, value: 'name' },
            value: { type: TermType.STRING, value: 'Alice' }
          },
          {
            key: { type: TermType.STRING, value: 'age' },
            value: { type: TermType.NUMBER, value: 30 }
          }
        ]
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('{"name": "Alice", "age": 30}');
    });
  });

  describe('Calls', () => {
    it('deparses function call', () => {
      const term: Term = {
        type: TermType.CALL,
        value: [
          { type: TermType.VAR, value: 'count' },
          {
            type: TermType.REF,
            value: [
              { type: TermType.VAR, value: 'data' },
              { type: TermType.STRING, value: 'users' }
            ]
          }
        ]
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('count(data.users)');
    });

    it('deparses function call with multiple args', () => {
      const term: Term = {
        type: TermType.CALL,
        value: [
          { type: TermType.VAR, value: 'substring' },
          { type: TermType.STRING, value: 'hello' },
          { type: TermType.NUMBER, value: 0 },
          { type: TermType.NUMBER, value: 3 }
        ]
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('substring("hello", 0, 3)');
    });
  });

  describe('Comprehensions', () => {
    it('deparses array comprehension', () => {
      const term: Term = {
        type: TermType.ARRAY_COMPREHENSION,
        value: {
          term: { type: TermType.VAR, value: 'x' },
          body: [
            {
              terms: [
                { type: TermType.VAR, value: 'assign' },
                { type: TermType.VAR, value: 'x' },
                {
                  type: TermType.REF,
                  value: [
                    { type: TermType.VAR, value: 'arr' },
                    { type: TermType.VAR, value: '_' }
                  ]
                }
              ]
            }
          ]
        }
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('[x | x := arr[_]]');
    });

    it('deparses set comprehension', () => {
      const term: Term = {
        type: TermType.SET_COMPREHENSION,
        value: {
          term: { type: TermType.VAR, value: 'x' },
          body: [
            {
              terms: [
                { type: TermType.VAR, value: 'assign' },
                { type: TermType.VAR, value: 'x' },
                {
                  type: TermType.REF,
                  value: [
                    { type: TermType.VAR, value: 'arr' },
                    { type: TermType.VAR, value: '_' }
                  ]
                }
              ]
            }
          ]
        }
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('{x | x := arr[_]}');
    });

    it('deparses object comprehension', () => {
      const term: Term = {
        type: TermType.OBJECT_COMPREHENSION,
        value: {
          key: { type: TermType.VAR, value: 'k' },
          value: { type: TermType.VAR, value: 'v' },
          body: [
            {
              terms: [
                { type: TermType.VAR, value: 'eq' },
                { type: TermType.VAR, value: 'v' },
                {
                  type: TermType.REF,
                  value: [
                    { type: TermType.VAR, value: 'obj' },
                    { type: TermType.VAR, value: 'k' }
                  ]
                }
              ]
            }
          ]
        }
      };
      expect(deparseTerm(term, { indent: '\t', newline: '\n', spaces: true })).toBe('{k: v | v = obj[k]}');
    });
  });

  describe('Expressions', () => {
    it('deparses simple expression', () => {
      const expr: Expr = {
        terms: { type: TermType.VAR, value: 'allow' }
      };
      expect(deparseExpr(expr, { indent: '\t', newline: '\n', spaces: true })).toBe('allow');
    });

    it('deparses negated expression', () => {
      const expr: Expr = {
        negated: true,
        terms: { type: TermType.VAR, value: 'deny' }
      };
      expect(deparseExpr(expr, { indent: '\t', newline: '\n', spaces: true })).toBe('not deny');
    });

    it('deparses expression with infix operator', () => {
      const expr: Expr = {
        terms: [
          { type: TermType.VAR, value: 'equal' },
          {
            type: TermType.REF,
            value: [
              { type: TermType.VAR, value: 'input' },
              { type: TermType.STRING, value: 'user' }
            ]
          },
          { type: TermType.STRING, value: 'admin' }
        ]
      };
      expect(deparseExpr(expr, { indent: '\t', newline: '\n', spaces: true })).toBe('input.user == "admin"');
    });

    it('deparses expression with with modifier', () => {
      const expr: Expr = {
        terms: { type: TermType.VAR, value: 'allow' },
        with: [
          {
            target: {
              type: TermType.REF,
              value: [
                { type: TermType.VAR, value: 'input' },
                { type: TermType.STRING, value: 'user' }
              ]
            },
            value: { type: TermType.STRING, value: 'test' }
          }
        ]
      };
      expect(deparseExpr(expr, { indent: '\t', newline: '\n', spaces: true })).toBe('allow with input.user as "test"');
    });
  });

  describe('Package', () => {
    it('deparses package declaration', () => {
      const pkg: Package = {
        path: [
          { type: TermType.VAR, value: 'example' },
          { type: TermType.VAR, value: 'authz' }
        ]
      };
      expect(deparsePackage(pkg, { indent: '\t', newline: '\n', spaces: true })).toBe('package example.authz');
    });

    it('deparses empty package as main', () => {
      const pkg: Package = { path: [] };
      expect(deparsePackage(pkg, { indent: '\t', newline: '\n', spaces: true })).toBe('package main');
    });
  });

  describe('Import', () => {
    it('deparses simple import', () => {
      const imp: Import = {
        path: {
          type: TermType.REF,
          value: [
            { type: TermType.VAR, value: 'data' },
            { type: TermType.STRING, value: 'users' }
          ]
        }
      };
      expect(deparseImport(imp, { indent: '\t', newline: '\n', spaces: true })).toBe('import data.users');
    });

    it('deparses import with alias', () => {
      const imp: Import = {
        path: {
          type: TermType.REF,
          value: [
            { type: TermType.VAR, value: 'data' },
            { type: TermType.STRING, value: 'permissions' }
          ]
        },
        alias: 'perms'
      };
      expect(deparseImport(imp, { indent: '\t', newline: '\n', spaces: true })).toBe('import data.permissions as perms');
    });
  });

  describe('Rules', () => {
    it('deparses simple rule', () => {
      const rule: Rule = {
        head: {
          name: 'allow',
          value: { type: TermType.BOOLEAN, value: true }
        },
        body: []
      };
      expect(deparseRule(rule, { indent: '\t', newline: '\n', spaces: true })).toBe('allow = true');
    });

    it('deparses rule with body', () => {
      const rule: Rule = {
        head: {
          name: 'allow',
          value: { type: TermType.BOOLEAN, value: true }
        },
        body: [
          {
            terms: [
              { type: TermType.VAR, value: 'equal' },
              {
                type: TermType.REF,
                value: [
                  { type: TermType.VAR, value: 'input' },
                  { type: TermType.STRING, value: 'user' }
                ]
              },
              { type: TermType.STRING, value: 'admin' }
            ]
          }
        ]
      };
      expect(deparseRule(rule, { indent: '\t', newline: '\n', spaces: true })).toBe(
        'allow = true if {\n\tinput.user == "admin"\n}'
      );
    });

    it('deparses default rule', () => {
      const rule: Rule = {
        default: true,
        head: {
          name: 'allow',
          value: { type: TermType.BOOLEAN, value: false }
        }
      };
      expect(deparseRule(rule, { indent: '\t', newline: '\n', spaces: true })).toBe('default allow = false');
    });

    it('deparses rule with else', () => {
      const rule: Rule = {
        head: {
          name: 'result',
          value: { type: TermType.STRING, value: 'allowed' }
        },
        body: [
          {
            terms: { type: TermType.VAR, value: 'is_admin' }
          }
        ],
        else: {
          value: { type: TermType.STRING, value: 'denied' },
          body: []
        }
      };
      expect(deparseRule(rule, { indent: '\t', newline: '\n', spaces: true })).toBe(
        'result = "allowed" if {\n\tis_admin\n} else = "denied"'
      );
    });

    it('deparses partial rule with key', () => {
      const rule: Rule = {
        head: {
          name: 'users',
          key: { type: TermType.VAR, value: 'name' }
        },
        body: [
          {
            terms: [
              { type: TermType.VAR, value: 'assign' },
              { type: TermType.VAR, value: 'name' },
              {
                type: TermType.REF,
                value: [
                  { type: TermType.VAR, value: 'data' },
                  { type: TermType.STRING, value: 'users' },
                  { type: TermType.VAR, value: '_' },
                  { type: TermType.STRING, value: 'name' }
                ]
              }
            ]
          }
        ]
      };
      expect(deparseRule(rule, { indent: '\t', newline: '\n', spaces: true })).toBe(
        'users[name] if {\n\tname := data.users[_].name\n}'
      );
    });
  });

  describe('Module', () => {
    it('deparses complete module', () => {
      const module: Module = {
        package: {
          path: [{ type: TermType.VAR, value: 'example' }]
        },
        imports: [
          {
            path: {
              type: TermType.REF,
              value: [
                { type: TermType.VAR, value: 'data' },
                { type: TermType.STRING, value: 'users' }
              ]
            }
          }
        ],
        rules: [
          {
            default: true,
            head: {
              name: 'allow',
              value: { type: TermType.BOOLEAN, value: false }
            }
          },
          {
            head: {
              name: 'allow',
              value: { type: TermType.BOOLEAN, value: true }
            },
            body: [
              {
                terms: [
                  { type: TermType.VAR, value: 'equal' },
                  {
                    type: TermType.REF,
                    value: [
                      { type: TermType.VAR, value: 'input' },
                      { type: TermType.STRING, value: 'user' }
                    ]
                  },
                  { type: TermType.STRING, value: 'admin' }
                ]
              }
            ]
          }
        ]
      };

      const expected = `package example

import data.users

default allow = false
allow = true if {
\tinput.user == "admin"
}`;

      expect(deparse(module)).toBe(expected);
    });

    it('deparses module with custom options', () => {
      const module: Module = {
        package: {
          path: [{ type: TermType.VAR, value: 'test' }]
        },
        rules: [
          {
            head: {
              name: 'x',
              value: { type: TermType.NUMBER, value: 1 }
            },
            body: []
          }
        ]
      };

      expect(deparse(module, { indent: '  ', newline: '\n' })).toBe('package test\n\nx = 1');
    });
  });

  describe('Infix Operators', () => {
    it('deparses equality', () => {
      const expr: Expr = {
        terms: [
          { type: TermType.VAR, value: 'equal' },
          { type: TermType.VAR, value: 'x' },
          { type: TermType.NUMBER, value: 1 }
        ]
      };
      expect(deparseExpr(expr, { indent: '\t', newline: '\n', spaces: true })).toBe('x == 1');
    });

    it('deparses inequality', () => {
      const expr: Expr = {
        terms: [
          { type: TermType.VAR, value: 'neq' },
          { type: TermType.VAR, value: 'x' },
          { type: TermType.NUMBER, value: 0 }
        ]
      };
      expect(deparseExpr(expr, { indent: '\t', newline: '\n', spaces: true })).toBe('x != 0');
    });

    it('deparses less than', () => {
      const expr: Expr = {
        terms: [
          { type: TermType.VAR, value: 'lt' },
          { type: TermType.VAR, value: 'x' },
          { type: TermType.NUMBER, value: 10 }
        ]
      };
      expect(deparseExpr(expr, { indent: '\t', newline: '\n', spaces: true })).toBe('x < 10');
    });

    it('deparses assignment', () => {
      const expr: Expr = {
        terms: [
          { type: TermType.VAR, value: 'assign' },
          { type: TermType.VAR, value: 'x' },
          { type: TermType.NUMBER, value: 5 }
        ]
      };
      expect(deparseExpr(expr, { indent: '\t', newline: '\n', spaces: true })).toBe('x := 5');
    });

    it('deparses unification', () => {
      const expr: Expr = {
        terms: [
          { type: TermType.VAR, value: 'eq' },
          { type: TermType.VAR, value: 'x' },
          { type: TermType.VAR, value: 'y' }
        ]
      };
      expect(deparseExpr(expr, { indent: '\t', newline: '\n', spaces: true })).toBe('x = y');
    });

    it('deparses arithmetic plus', () => {
      const expr: Expr = {
        terms: [
          { type: TermType.VAR, value: 'plus' },
          { type: TermType.VAR, value: 'a' },
          { type: TermType.VAR, value: 'b' }
        ]
      };
      expect(deparseExpr(expr, { indent: '\t', newline: '\n', spaces: true })).toBe('a + b');
    });

    it('deparses arithmetic multiply', () => {
      const expr: Expr = {
        terms: [
          { type: TermType.VAR, value: 'mul' },
          { type: TermType.VAR, value: 'x' },
          { type: TermType.NUMBER, value: 2 }
        ]
      };
      expect(deparseExpr(expr, { indent: '\t', newline: '\n', spaces: true })).toBe('x * 2');
    });
  });
});
