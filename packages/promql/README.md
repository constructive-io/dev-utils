# promql

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="150">
  <br />
  A TypeScript PromQL parser, AST builders, and deparser
</p>

A dependency-free toolkit for working with [PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/) as a typed AST — **parse** query strings into an AST, **build** queries programmatically with typed helpers, and **deparse** an AST back to a canonical PromQL string.

## Install

```sh
npm install promql
```

## Why

Composing PromQL with template strings is error-prone (label escaping, precedence, parentheses). This package lets you build queries as typed values and render them safely:

```ts
import { sum, rate, range, metric, neq, by, deparse } from 'promql';

const query = deparse(
  sum(
    rate(range(metric('container_cpu_usage_seconds_total', [neq('container', '')]), '5m')),
    by('namespace')
  )
);
// => 'sum by (namespace) (rate(container_cpu_usage_seconds_total{container!=""}[5m]))'
```

## Parse

```ts
import { parse } from 'promql';

const ast = parse('sum by (namespace) (rate(x[5m]))');
// { type: 'AggregateExpr', op: 'sum', grouping: { modifier: 'by', labels: ['namespace'] }, ... }
```

## Deparse

```ts
import { parse, deparse } from 'promql';

deparse(parse('a+b*c')); // 'a + b * c'
```

The deparser inserts parentheses based on operator precedence, so ASTs built by hand (without explicit `ParenExpr` nodes) always render to a string that reparses to the same tree.

## Builders

| Helper | PromQL |
|---|---|
| `metric('up', { job: 'api' })` | `up{job="api"}` |
| `selector({ __name__: 'up' })` | `{__name__="up"}` |
| `eq / neq / re / nre` | `=` `!=` `=~` `!~` matchers |
| `range(sel, '5m')` | `sel[5m]` |
| `subquery(expr, '1h', '1m')` | `expr[1h:1m]` |
| `rate / irate / increase / *_over_time` | function calls |
| `sum / min / max / avg / count / ...` | aggregations |
| `topk / bottomk / quantile / countValues` | aggregations with a parameter |
| `by(...) / without(...)` | grouping clauses |
| `add / sub / mul / div / pow / and / or / unless` | binary operators |
| `on(...) / ignoring(...)` | vector matching |
| `offset(expr, '5m') / at(expr, 100 \| 'start' \| 'end')` | modifiers |

## API

- `parse(input: string): Expr` / `class Parser`
- `deparse(node: Expr): string` / `class Deparser`
- `tokenize(input: string): Token[]` / `class Lexer`, `TokenType`
- `cleanTree`, `astEqual`, `printAst`
- All AST node types (`Expr`, `VectorSelector`, `MatrixSelector`, `AggregateExpr`, …)
- All builder helpers

## License

MIT
