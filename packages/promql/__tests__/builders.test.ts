import * as b from '../src/builders';
import { deparse } from '../src/deparser';
import { parse } from '../src/parser';
import { cleanTree } from '../src/clean';

describe('promql builders', () => {
  it('builds the namespace CPU query used by the collector', () => {
    const expr = b.sum(
      b.rate(b.range(b.metric('container_cpu_usage_seconds_total', [b.neq('container', '')]), '5m')),
      b.by('namespace')
    );
    expect(deparse(expr)).toBe(
      'sum by (namespace) (rate(container_cpu_usage_seconds_total{container!=""}[5m]))'
    );
  });

  it('builds the namespace memory query used by the collector', () => {
    const expr = b.sum(
      b.metric('container_memory_working_set_bytes', [
        b.eq('namespace', 'tenant-a'),
        b.neq('container', ''),
        b.neq('image', ''),
      ])
    );
    expect(deparse(expr)).toBe(
      'sum(container_memory_working_set_bytes{namespace="tenant-a", container!="", image!=""})'
    );
  });

  it('builder output reparses to an equal AST', () => {
    const expr = b.topk(5, b.rate(b.range(b.metric('x', { job: 'api' }), '1m')), b.by('pod'));
    const reparsed = parse(deparse(expr));
    expect(cleanTree(reparsed)).toEqual(cleanTree(expr));
  });

  it('escapes label values via JSON quoting', () => {
    const expr = b.metric('m', [b.eq('path', 'a"b\\c')]);
    expect(deparse(expr)).toBe('m{path="a\\"b\\\\c"}');
    // and it reparses back to the original value
    const reparsed = parse(deparse(expr)) as { matchers: { value: string }[] };
    expect(reparsed.matchers[0].value).toBe('a"b\\c');
  });

  it('at() accepts start/end/number', () => {
    expect(deparse(b.at(b.metric('x'), 'start'))).toBe('x @ start()');
    expect(deparse(b.at(b.metric('x'), 'end'))).toBe('x @ end()');
    expect(deparse(b.at(b.metric('x'), 1609746000))).toBe('x @ 1609746000');
  });
});
