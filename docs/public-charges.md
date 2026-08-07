# Public charges

`klap.publicCharges` — also available standalone as
`createPublicChargesClient`/`getPublicCharge` from
`@klappay/node/public-charges` (see [`tree-shaking.md`](./tree-shaking.md)).
Needs no credential at all — the one part of the SDK safe to call
directly from a browser or any client with no API key.

## `get(chargeId)`

```ts
const charge = await klap.publicCharges.get('ch_abc123')
console.log(charge.environment) // 'live' | 'test' — read it off the response, not asked for up front
```

Looks the charge up by `id` alone — it's already a globally unique
primary key, not scoped by organization or environment, so there's
nothing left to disambiguate with. `charge.environment` comes back as a
field on the response instead; if your integration needs to assert it
matches an expectation, do that yourself after the call.

Returns a `PublicCharge` — a redacted view of the full `Charge`:
`apiKeyId`, `externalRef`, and `source` are dropped entirely (not just
nulled), and `metadata` is filtered down to only the reserved `klappay`
key if present (`null` otherwise), even if the merchant's own metadata
is non-empty. Every other field (`status`, `amount`, `amountReceived`,
`paidWith`, `address`, timestamps, etc.) is identical to `Charge`.

## `getQrCode(chargeId, query?)`

```ts
const svg = await klap.publicCharges.getQrCode('ch_abc123')
// raw SVG string, no API key required
```

Same EIP-681 QR code as [`klap.charges.getQrCode()`](./charges.md#getqrcodeid-query), no
credential needed — the QR only ever encodes data already exposed by
`get()` above (address, accepted pair, amount), so there's nothing this
exposes that isn't already public. `query` (`{ token, network }`) is
only required when the charge accepts more than one pair:

```ts
const svg = await klap.publicCharges.getQrCode('ch_abc123', { token: 'USDC', network: 'base' })
```

The authenticated `klap.charges.getQrCode()` isn't going away — this is
an additional, unauthenticated option for a consumer with no API key at
all (e.g. embedding a QR code directly in a checkout page), not a
replacement.

## `streamEvents(chargeId, signal?)`

```ts
for await (const charge of klap.publicCharges.streamEvents('ch_abc123')) {
  console.log(charge.status)
}
```

Same no-credential, by-id-alone lookup as `get()`, live instead of a
one-shot fetch — yields the full `PublicCharge` every time it changes,
closes when the server does. Draws from its own small connection
budget, independent of every authenticated stream (`klap.charges.watch()`,
etc.) and of the general rate limiters — a public, unauthenticated
route needs its own reserved (and much smaller) share so it can never
starve real customer traffic.

## Standalone helper

```ts
import { getPublicCharge } from '@klappay/node/public-charges'

const charge = await getPublicCharge('ch_abc123', 'https://your-klap-api-host')
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
