import { roundtrip } from '../test-utils';

describe('promql roundtrip (parse → deparse → parse)', () => {
  const cases = [
    'up',
    'http_requests_total{job="api", code!~"5.."}',
    'rate(x[5m])',
    'sum by (namespace) (rate(container_cpu_usage_seconds_total{container!=""}[5m]))',
    'sum(container_memory_working_set_bytes{namespace="tenant-a", container!="", image!=""})',
    'topk(3, avg_over_time(x[1h]))',
    'a + b * c',
    '(a + b) * c',
    'a ^ b ^ c',
    'a == bool on (x) group_left (y) b',
    'histogram_quantile(0.9, rate(http_request_duration_seconds_bucket[5m]))',
    'rate(x[5m])[1h:1m]',
    'x @ 100 offset -1m',
    'quantile(0.95, node_cpu) without (cpu)',
    '-foo + bar',
    'foo and bar unless baz',
    'foo or bar or baz',
    'job:http_requests:rate5m',
  ];

  for (const input of cases) {
    it(`roundtrips: ${input}`, () => {
      const { first, second } = roundtrip(input);
      expect(first).toEqual(second);
    });
  }
});
