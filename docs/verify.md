# Verify

`klap.verify` — also available standalone as `createVerifyClient` (or
the even shorter `verifyCharge` helper) from `@klappay/node/verify` (see
[`tree-shaking.md`](./tree-shaking.md)). **Requires no credential at
all** — no `apiKey`, no `sessionToken` — this is the one resource
that's safe to call from a browser or any public context, since it only
ever exposes proof-of-payment for a charge id someone was already given.

## `get(chargeId)`

```ts
const proof = await klap.verify.get('ch_abc123')

console.log(proof.amountReceived, proof.splitAddress)
for (const payment of proof.payments) {
  console.log(payment.token, payment.network, payment.txHash, payment.explorerTxUrl)
}
```

Wraps the public `GET /v1/verify/{id}` endpoint. It only ever returns a
result for a `live` charge that's either fully `confirmed`
(`mode: 'standard'`) or has received at least one contribution
(`mode: 'continuous'`, which never reaches `confirmed` — see `mode` in
`@klappay/types`'s `charges.md`) — anything else (a `test`
charge, a `standard` charge still `pending`, or an id that doesn't
exist) comes back as an identical generic 404, so the endpoint can't be
used to probe whether an id is real, live, or paid.

The response (`VerifyCharge` from `@klappay/types`) has `id`, `amount`
(originally requested), `amountReceived` (cumulative, across every
contributing pair), `confirmedAt` (`null` for a `continuous` charge,
which never has a single confirmed moment — use each `payments` entry's
own `settledAt` instead), `splitAddress` (the on-chain address
funds were sent to), and `payments`: an array with one entry per
`(token, network)` pair that actually contributed — a charge accepting
several pairs can be confirmed by a combination of them, and each is
proven and settled independently. Each `payments` entry has its own
`token`, `network`, `amountReceived` (that pair's own contribution),
`txHash`/`explorerTxUrl` for its most recent on-chain transfer, and
`split`: an array with each recipient's `role` (`merchant` / `klap_fee` /
`distributor_incentive`), `address`, `percentAllocation`, and
`amountUSD` for that pair's own share. Each entry's `splitTxHash` and
`settledAt` are `null` until that specific pair's payout has settled —
different pairs on the same charge can settle at different times.

## `streamEvents(chargeId, signal?)`

```ts
for await (const event of klap.verify.streamEvents('ch_abc123')) {
  console.log(event.status, event.amountReceived)
}
```

Same no-credential model as `get()` above, but for watching a payment
progress *before* it's confirmed — `get()` only ever serves a
`confirmed`/contributed charge, this stream exists specifically to
observe `pending`/`partially_paid` along the way. Yields a minimal
`ChargeStatusEvent` (`id`, `status`, `settlementStatus`, `amount`,
`amountReceived`, `paidWith` — not the full fee-split detail `get()`
returns) every time it changes. Only ever serves a `live` charge — a
`test` or unknown id behaves the same as `get()`'s generic 404. The
generator ends when the server closes the stream (terminal state,
expiry) or the optional `signal` you pass aborts. This is the one other
resource (besides `get()`) safe to call from a public/browser context —
useful for a checkout page's own "waiting for payment..." UI.

## Standalone usage — no client needed

If all you need is this one call, skip `createClient` entirely:

```ts
import { verifyCharge } from '@klappay/node/verify'

const proof = await verifyCharge('ch_abc123', 'https://your-klap-api-host')
```

This is the same call `klap.verify.get()` makes under the hood — useful
for a lightweight public "payment receipt" page where pulling in the
full SDK client isn't worth it.
