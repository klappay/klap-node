# Distributions

`klap.distributions` — also available standalone as
`createDistributionsClient` from `@klappay/node/distributions` (see
[`tree-shaking.md`](./tree-shaking.md)). Requires an `apiKey`.

This is for **keepers/bots**, not a typical merchant integration.
0xSplits' `distribute()` is permissionless — anyone can call it and
receive a small `distributorFeePercent` reward — and this resource
exists so a keeper can discover which splits are currently claimable
within their grace period, before Klap's own worker gets to them.
Ignore this entirely unless you're specifically building or running
such a keeper.

## `list()`

```ts
const distributions = await klap.distributions.list()

for (const d of distributions) {
  console.log(d.splitAddress, d.network, d.token, d.estimatedRewardAmount)
}
```

A snapshot of every split, in the calling key's own environment, with a
confirmed payout still inside its grace period. Each entry has the
`splitAddress`/`network`/`token` to identify it, the exact `recipients`
array and `distributorFeePercent` you'd need to call `distribute()`
correctly, an `estimatedRewardAmount` (an estimate only — read the
split's actual on-chain balance before submitting a transaction), and
`availableSince`/`graceEndsAt` timestamps. Capped at 200 rows — see the
API's own docs for why.

## `streamPending(signal?)`

```ts
for await (const event of klap.distributions.streamPending()) {
  if (event.type === 'distribution.available') {
    console.log('new:', event.distribution.splitAddress)
  } else {
    console.log('claimed:', event.splitAddress)
  }
}
```

Real-time deltas, scoped to the calling key's own environment — no
initial snapshot is sent over this stream. **Connect here first**, then
call `list()` to bootstrap your own state, applying every event you
receive (whether it arrives before or after `list()` resolves) as an
idempotent add/remove on top of that snapshot — connecting in the
opposite order leaves a small gap where a delta between the two calls
is never delivered. `event.type` discriminates the union:
`'distribution.available'` (a new distribution entered its grace
period, or re-entered it after a failed attempt) carries the full
`distribution`; `'distribution.claimed'` (settled by anyone, or picked
up by Klap's own worker) carries only the `splitAddress` that's no
longer claimable. The generator ends when the server closes the stream
or the given `signal` aborts.
