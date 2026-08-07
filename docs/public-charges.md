# Public charges

`klap.publicCharges` — also available standalone as
`createPublicChargesClient`/`getPublicCharge` from
`@klappay/node/public-charges` (see [`tree-shaking.md`](./tree-shaking.md)).
Needs no credential at all — the one part of the SDK safe to call
directly from a browser or any client with no API key.

## `get(chargeId, environment)`

```ts
const charge = await klap.publicCharges.get('ch_abc123', 'live')
```

Returns a `PublicCharge` — a redacted view of the full `Charge`:
`apiKeyId`, `externalRef`, and `source` are dropped entirely (not just
nulled), and `metadata` is filtered down to only the reserved `klappay`
key if present (`null` otherwise), even if the merchant's own metadata
is non-empty. Every other field (`status`, `amount`, `amountReceived`,
`paidWith`, `address`, timestamps, etc.) is identical to `Charge`.

`environment` is **required** — there's no key to infer it from, and
omitting it isn't an option the way it sometimes is elsewhere. A
mismatch between the `environment` you pass and the charge's real one
is indistinguishable from the charge not existing (`404`) — deliberate,
so this endpoint can't be used to probe which environment an id belongs
to.

## `streamEvents(chargeId, environment, signal?)`

```ts
for await (const charge of klap.publicCharges.streamEvents('ch_abc123', 'live')) {
  console.log(charge.status)
}
```

Same no-credential, `environment`-required shape as `get()`, live
instead of a one-shot fetch — yields the full `PublicCharge` every time
it changes, closes when the server does. Draws from its own small
connection budget, independent of every authenticated stream
(`klap.charges.watch()`, etc.) and of the general rate limiters — a
public, unauthenticated route needs its own reserved (and much smaller)
share so it can never starve real customer traffic.

## Standalone helper

```ts
import { getPublicCharge } from '@klappay/node/public-charges'

const charge = await getPublicCharge('ch_abc123', 'live', 'https://your-klap-api-host')
```

A one-off convenience for a single lookup without constructing a full
client — equivalent to `createPublicChargesClient({ baseUrl }).get(...)`.

## What this replaces

This is the direct (differently-shaped) successor to the old, now-removed
`/v1/verify` public lookup — the same "credential-less, safe to call from
anywhere" positioning, but redaction-based rather than confirmed-only:
available through a charge's whole lifecycle (`pending` → terminal), not
just once it's paid, and covering more fields (`status`, `paidWith`,
timestamps) than the old minimal proof-of-payment shape did.
