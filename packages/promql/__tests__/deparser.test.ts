import * as b from '../src/builders';
import { deparse } from '../src/deparser';

describe('promql deparser', () => {
  it('deparses a selector with matchers', () => {
    expect(deparse(b.metric('http_requests_total', { job: 'api' }))).toBe(
      'http_requests_total{job="api"}'
    );
  });

  it('deparses a nameless selector', () => {
    expect(deparse(b.selector({ __name__: 'up' }))).toBe('{__name__="up"}');
  });

  it('deparses rate over a range', () => {
    expect(deparse(b.rate(b.range(b.metric('x'), '5m')))).toBe('rate(x[5m])');
  });

  it('deparses aggregation with by-grouping', () => {
    expect(deparse(b.sum(b.rate(b.range(b.metric('x'), '5m')), b.by('namespace')))).toBe(
      'sum by (namespace) (rate(x[5m]))'
    );
  });

  it('deparses topk with parameter', () => {
    expect(deparse(b.topk(3, b.metric('x')))).toBe('topk(3, x)');
  });

  it('adds parentheses to preserve precedence for built ASTs', () => {
    // (a + b) * c — built without explicit ParenExpr
    const expr = b.mul(b.add(b.metric('a'), b.metric('b')), b.metric('c'));
    expect(deparse(expr)).toBe('(a + b) * c');
  });

  it('does not add unnecessary parentheses', () => {
    const expr = b.add(b.metric('a'), b.mul(b.metric('b'), b.metric('c')));
    expect(deparse(expr)).toBe('a + b * c');
  });

  it('deparses offset and @ modifiers', () => {
    expect(deparse(b.offset(b.at(b.metric('x'), 100), '5m'))).toBe('x @ 100 offset 5m');
  });

  it('deparses bool + vector matching', () => {
    const expr = b.binary('==', b.metric('a'), b.metric('b'), {
      bool: true,
      matching: { on: ['x'], groupLeft: ['y'] },
    });
    expect(deparse(expr)).toBe('a == bool on (x) group_left (y) b');
  });

  it('deparses Inf/NaN', () => {
    expect(deparse(b.num(Infinity))).toBe('+Inf');
    expect(deparse(b.num(NaN))).toBe('NaN');
  });
});
