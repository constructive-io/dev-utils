import { cleanTree } from '../src/clean';
import { parse } from '../src/parser';

describe('promql parser', () => {
  it('parses a bare metric name', () => {
    expect(cleanTree(parse('up'))).toEqual({
      type: 'VectorSelector',
      name: 'up',
      matchers: [],
    });
  });

  it('parses a selector with label matchers', () => {
    expect(cleanTree(parse('http_requests_total{job="api", code!~"5.."}'))).toEqual({
      type: 'VectorSelector',
      name: 'http_requests_total',
      matchers: [
        { name: 'job', op: '=', value: 'api' },
        { name: 'code', op: '!~', value: '5..' },
      ],
    });
  });

  it('parses a matrix selector with offset and @', () => {
    expect(cleanTree(parse('x[5m] @ 100 offset -1m'))).toEqual({
      type: 'MatrixSelector',
      vectorSelector: { type: 'VectorSelector', name: 'x', matchers: [] },
      range: '5m',
      at: { kind: 'timestamp', value: 100 },
      offset: '-1m',
    });
  });

  it('parses rate(range) function calls', () => {
    expect(cleanTree(parse('rate(x[5m])'))).toEqual({
      type: 'Call',
      func: 'rate',
      args: [
        {
          type: 'MatrixSelector',
          vectorSelector: { type: 'VectorSelector', name: 'x', matchers: [] },
          range: '5m',
        },
      ],
    });
  });

  it('parses aggregation with by-clause before args', () => {
    const ast = cleanTree(parse('sum by (namespace) (rate(x[5m]))')) as {
      type: string;
      op: string;
      grouping: unknown;
    };
    expect(ast.type).toBe('AggregateExpr');
    expect(ast.op).toBe('sum');
    expect(ast.grouping).toEqual({ modifier: 'by', labels: ['namespace'] });
  });

  it('parses aggregation with by-clause after args', () => {
    const ast = cleanTree(parse('sum(rate(x[5m])) by (namespace)')) as { grouping: unknown };
    expect(ast.grouping).toEqual({ modifier: 'by', labels: ['namespace'] });
  });

  it('parses topk with a parameter', () => {
    const ast = cleanTree(parse('topk(3, x)')) as { op: string; param: unknown };
    expect(ast.op).toBe('topk');
    expect(ast.param).toEqual({ type: 'NumberLiteral', value: 3 });
  });

  it('respects operator precedence', () => {
    const ast = cleanTree(parse('a + b * c')) as { op: string; rhs: { op: string } };
    expect(ast.op).toBe('+');
    expect(ast.rhs.op).toBe('*');
  });

  it('parses ^ as right-associative', () => {
    const ast = cleanTree(parse('a ^ b ^ c')) as { op: string; rhs: { op: string } };
    expect(ast.op).toBe('^');
    expect(ast.rhs.op).toBe('^');
  });

  it('parses binary comparison with bool and on() matching', () => {
    const ast = cleanTree(parse('a == bool on (x) b')) as {
      op: string;
      bool: boolean;
      matching: unknown;
    };
    expect(ast.op).toBe('==');
    expect(ast.bool).toBe(true);
    expect(ast.matching).toEqual({ on: ['x'] });
  });

  it('parses group_left matching', () => {
    const ast = cleanTree(parse('a / on (x) group_left (y) b')) as { matching: unknown };
    expect(ast.matching).toEqual({ on: ['x'], groupLeft: ['y'] });
  });

  it('parses subquery with step', () => {
    expect(cleanTree(parse('rate(x[5m])[1h:1m]'))).toMatchObject({
      type: 'SubqueryExpr',
      range: '1h',
      step: '1m',
    });
  });

  it('parses Inf and NaN literals', () => {
    expect(cleanTree(parse('Inf'))).toEqual({ type: 'NumberLiteral', value: Infinity });
    expect((cleanTree(parse('NaN')) as { value: number }).value).toBeNaN();
  });

  it('parses recording-rule metric names with colons', () => {
    expect(cleanTree(parse('job:http_requests:rate5m'))).toEqual({
      type: 'VectorSelector',
      name: 'job:http_requests:rate5m',
      matchers: [],
    });
  });

  it('throws on malformed input', () => {
    expect(() => parse('sum(')).toThrow();
    expect(() => parse('{')).toThrow();
  });
});
