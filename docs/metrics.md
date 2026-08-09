# Metrics

`klap.metrics` — also available standalone as `createMetricsClient`
from `@klappay/node/metrics` (see [`tree-shaking.md`](./tree-shaking.md)).
Requires an `apiKey` — every key only ever sees its own tenant's data,
so there's no organization id to pass anywhere.

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

All of the above is enforced server-side regardless of what the SDK
does client-side — `klap.metrics.query()` doesn't pre-validate before
sending, it's a thin wrapper; a malformed query comes back as a `400`
`KlapApiError`.
