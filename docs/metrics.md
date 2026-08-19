# Metrics

`klap.metrics` — also available standalone as `createMetricsClient`
from `@klappay/node/metrics` (see [`tree-shaking.md`](./tree-shaking.md)).
Requires an `apiKey` — every key only ever sees its own tenant's data,
so there's no organization id to pass anywhere.

```ts
import { createMetricsClient } from '@klappay/node/metrics'

const metrics = createMetricsClient({ baseUrl: '...', apiKey: '...' })
const result = await metrics.query({
  resource: 'charges',
  environment: 'live',
  dateRange: { field: 'createdAt', from: '2026-07-01T00:00:00.000Z', to: '2026-08-01T00:00:00.000Z' },
  metrics: [{ aggregation: 'count', alias: 'total' }],
})
```

## `query(input)`

Ad-hoc analytics over your `charges`/`transactions`/`distributions`
data, in the same spirit as a log/observability platform's query API:
pick a resource, an aggregation, optional `groupBy` (including a single
time-bucketed entry), and filters — the response rows are shaped by
that query, not a fixed report. Not raw SQL: every filterable/groupable/
aggregatable field is an explicit, typed enum, checked both by
TypeScript and by the server.

```ts
const result = await klap.metrics.query({
  resource: 'charges',
  environment: 'live',
  dateRange: {
    field: 'createdAt',
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-08-01T00:00:00.000Z',
  },
  groupBy: [{ type: 'date_bucket', field: 'createdAt', granularity: 'day' }],
  metrics: [
    { aggregation: 'sum', field: 'amount', alias: 'volume' },
    { aggregation: 'count' },
  ],
  filters: [{ field: 'status', operator: 'eq', value: 'confirmed' }],
})

// result.data: [{ createdAt: '2026-07-01', volume: 4820.5, count: 12 }, ...]
// result.meta: { resource: 'charges', environment: 'live', rowCount: ..., truncated: false }
```

`result.meta.truncated` is `true` when more rows matched the query than
`limit` allowed, meaning `result.data` holds only the first `limit` of
them — `rowCount` still reflects what's in `data`, not the true total.
Treat it as a signal to narrow the query (a tighter `dateRange`, an
added `filters` entry, a `groupBy` with more buckets) rather than just
raising `limit` — it caps out at `METRICS_QUERY_MAX_ROW_LIMIT` (1000)
regardless.

The input type is `MetricsQueryRequest` (from `@klappay/types`) — a
discriminated union on `resource`, so TypeScript narrows which fields
are valid the moment you set `resource: 'charges' | 'transactions' |
'distributions'`. `groupBy`, `filters`, and `limit` are all optional
there (the schema defaults them to `[]`/`[]`/`100`). `date_bucket`
supports a `'year'` granularity alongside the usual `hour`/`day`/`week`/
`month`. Every queryable field per resource — which dimensions you can
filter/group by, which numeric fields you can aggregate, which date
fields you can range/bucket on (e.g. `charges` now includes `expiresAt`,
`distributions` now includes `distributorAddress`/
`processingStartedAt`) — is documented in `@klappay/types`'
`metrics-query.md` (`ChargesQueryField`, `TransactionsMetricField`,
etc.), not duplicated here.

A few more realistic queries, past the single day-bucketed example
above:

Average transaction size per network, grouped by a plain field instead
of a time bucket:

```ts
const byNetwork = await klap.metrics.query({
  resource: 'transactions',
  environment: 'live',
  dateRange: {
    field: 'detectedAt',
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-08-01T00:00:00.000Z',
  },
  groupBy: [{ type: 'field', field: 'network' }],
  metrics: [
    { aggregation: 'avg', field: 'amount', alias: 'avgAmount' },
    { aggregation: 'count' },
  ],
  filters: [{ field: 'token', operator: 'eq', value: 'USDC' }],
})
// result.data: [{ network: 'base', avgAmount: 128.4, count: 302 }, ...]
```

The 5 highest-volume days in range, using `orderBy` against a metric's
own `alias` and `limit` to cap the row count:

```ts
const topDays = await klap.metrics.query({
  resource: 'charges',
  environment: 'live',
  dateRange: {
    field: 'createdAt',
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-08-01T00:00:00.000Z',
  },
  groupBy: [{ type: 'date_bucket', field: 'createdAt', granularity: 'day' }],
  metrics: [{ aggregation: 'sum', field: 'amount', alias: 'volume' }],
  orderBy: { key: 'volume', direction: 'desc' },
  limit: 5,
})
```

Distributions that are still stuck outside `completed`, combining an
`in` filter with a `neq` filter:

```ts
const stuck = await klap.metrics.query({
  resource: 'distributions',
  environment: 'live',
  dateRange: {
    field: 'createdAt',
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-08-01T00:00:00.000Z',
  },
  groupBy: [{ type: 'field', field: 'status' }],
  metrics: [{ aggregation: 'avg', field: 'attempts', alias: 'avgAttempts' }],
  filters: [
    { field: 'network', operator: 'in', value: ['base', 'optimism'] },
    { field: 'status', operator: 'neq', value: 'completed' },
  ],
})
```

A few constraints worth knowing up front:

- `dateRange` is always required and capped at 366 days — this isn't
  optional-defaulting-to-unbounded on purpose, it's what keeps a query
  from scanning your entire history.
- At most one `date_bucket` entry is allowed in `groupBy`.
- `field` on a `metrics[]` entry is required unless `aggregation` is
  `'count'`.
- Every `metrics[].alias` must be unique, must not collide with a
  `groupBy` field name (or the reserved word `"bucket"`), and must
  match `^[a-zA-Z_][a-zA-Z0-9_]*$` — it becomes a SQL column alias
  server-side for a date-bucketed query.
- `orderBy.key` must match that same `^[a-zA-Z_][a-zA-Z0-9_]*$` pattern
  — it should already be a `groupBy` field name or a metric's alias/
  default name, all of which are always shaped like this, so in
  practice this only ever rejects a value that could never have been a
  real output column to begin with.

A query that satisfies all four at once:

```ts
await klap.metrics.query({
  resource: 'charges',
  environment: 'live',
  dateRange: {
    field: 'createdAt',
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-08-01T00:00:00.000Z',
  },
  groupBy: [{ type: 'date_bucket', field: 'createdAt', granularity: 'week' }], // just one date_bucket
  metrics: [
    { aggregation: 'sum', field: 'amount', alias: 'weekly_volume' }, // unique, matches the alias pattern
    { aggregation: 'count', alias: 'charge_count' },
  ],
  orderBy: { key: 'weekly_volume', direction: 'desc' }, // an existing alias
})
```

All of the above is enforced server-side regardless of what the SDK
does client-side — `klap.metrics.query()` doesn't pre-validate before
sending, it's a thin wrapper; a malformed query comes back as a `400`
`KlapApiError`:

```ts
import { KlapApiError } from '@klappay/node'

try {
  await klap.metrics.query({
    resource: 'charges',
    environment: 'live',
    dateRange: {
      field: 'createdAt',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-07-01T00:00:00.000Z', // to before from
    },
    metrics: [{ aggregation: 'count' }],
  })
} catch (error) {
  if (error instanceof KlapApiError && error.status === 400) {
    console.error(`Malformed metrics query (${error.code}): ${error.message}`, error.param)
  } else {
    throw error
  }
}
```
