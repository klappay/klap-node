# Distributions

`klap.distributions` — also available standalone as
`createDistributionsClient` from `@klappay/node/distributions` (see
[`tree-shaking.md`](./tree-shaking.md)). Requires an `apiKey`.

```ts
import { createDistributionsClient } from '@klappay/node/distributions'

const distributions = createDistributionsClient({ baseUrl: '...', apiKey: '...' })
const page = await distributions.list()
```

`baseUrl`/`apiKey` are optional — they fall back to `KLAP_BASE_URL`/
`KLAP_DISTRIBUTIONS_API_KEY` (see [`getting-started.md`](./getting-started.md#environment-variables))
if omitted.

This is for **keepers/bots**, not a typical merchant integration.
0xSplits' `distribute()` is permissionless — anyone can call it and
receive a small `distributorFeePercent` reward — and this resource
exists so a keeper can discover which splits are currently claimable
within their grace period, before Klap's own worker gets to them.
Ignore this entirely unless you're specifically building or running
such a keeper.

## Putting it together: a minimal keeper

Connect the stream before bootstrapping the backlog, so no delta is
missed between the two calls; apply every event as an idempotent
add/remove on top of the snapshot `listAll()` gives you:

```ts
import type { PendingDistribution } from '@klappay/types'

const seen = new Map<string, PendingDistribution>()
const events = klap.distributions.streamPending() // connect first

for await (const distribution of klap.distributions.listAll()) {
  seen.set(distribution.splitAddress, distribution)
}
for (const distribution of seen.values()) {
  await distributeSplit(distribution)
}

for await (const event of events) {
  if (event.type === 'distribution.available') {
    seen.set(event.distribution.splitAddress, event.distribution)
    await distributeSplit(event.distribution)
  } else {
    seen.delete(event.splitAddress)
  }
}

async function distributeSplit(distribution: PendingDistribution) {
  // 0xSplits' own on-chain `distribute()` — a contract call your keeper
  // submits directly, not a klap-node method:
  // await splitsClient.distribute({
  //   splitAddress: distribution.splitAddress,
  //   token: distribution.token,
  //   network: distribution.network,
  //   distributorAddress: YOUR_ADDRESS,
  // })
}
```

## `list(input?)` and `listAll()`

```ts
const page = await klap.distributions.list({ limit: 20 })
// page.data, page.nextCursor, page.hasMore
```

Cursor-paginated, same shape and semantics as every other list endpoint
(`klap.charges.list()`, etc.) — pass `limit`/`cursor` to page through it
manually, or use `listAll()` to page through everything automatically:

```ts
for await (const d of klap.distributions.listAll()) {
  console.log(d.splitAddress, d.network, d.token, d.estimatedRewardAmount)
}
```

A snapshot of every split, in the calling key's own environment, with a
confirmed payout still inside its grace period. Each entry has the
`splitAddress`/`network`/`token` to identify it, the exact `recipients`
array and `distributorFeePercent` you'd need to call `distribute()`
correctly, an `estimatedRewardAmount` (an estimate only — read the
split's actual on-chain balance before submitting a transaction), and
`availableSince`/`graceEndsAt` timestamps.

If a page reports `hasMore: true` but its `nextCursor` is `null`,
`listAll()` treats that as nothing left to follow and stops instead of
looping forever — this is a defensive stop against a malformed page,
not an expected steady-state response.

Nothing claimable right now is a normal, common result, not an error —
`list()` resolves to `{ data: [], nextCursor: null, hasMore: false }`
and `listAll()` simply yields nothing, so a keeper's bootstrap loop
naturally does nothing until a split enters its grace period:

```ts
for await (const distribution of klap.distributions.listAll()) {
  // never runs when there's nothing currently claimable
}
```

## `streamPending(signal?, limit?)`

```ts
for await (const event of klap.distributions.streamPending()) {
  if (event.type === 'distribution.available') {
    console.log('new:', event.distribution.splitAddress)
  } else {
    console.log('claimed:', event.splitAddress)
  }
}
```

Real-time deltas, scoped to the calling key's own environment. With no
`limit`, no initial snapshot is sent over this stream — **connect here
first**, then call `list()`/`listAll()` to bootstrap your own state,
applying every event you receive (whether it arrives before or after
that resolves) as an idempotent add/remove on top of that snapshot —
connecting in the opposite order leaves a small gap where a delta
between the two calls is never delivered. `event.type` discriminates the
union: `'distribution.available'` (a new distribution entered its grace
period, or re-entered it after a failed attempt) carries the full
`distribution`; `'distribution.claimed'` (settled by anyone, or picked
up by Klap's own worker) carries only the `splitAddress` that's no
longer claimable. The generator ends when the server closes the stream
or the given `signal` aborts.

```ts
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 5 * 60_000)

try {
  for await (const event of klap.distributions.streamPending(controller.signal)) {
    // ...
  }
} finally {
  clearTimeout(timeout)
}
```

Pass `limit` (1-100) for a self-contained connection instead of the
connect-then-list dance above:

```ts
for await (const event of klap.distributions.streamPending(undefined, 50)) {
  // ...
}
```

The server sends up to `limit` currently-claimable distributions as
synthetic `'distribution.available'` events right after connecting, then
continues with live deltas — one connection, no separate `list()` call
needed. This snapshot isn't a full page (no cursor) — if more than
`limit` are claimable, use `list()`/`listAll()` directly instead for a
complete listing during a backlog.
