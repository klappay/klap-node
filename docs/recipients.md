# Recipients

`klap.recipients` — also available standalone as `createRecipientsClient`
from `@klappay/node/recipients`. Requires an `apiKey`.

A recipient is a trusted EVM address you register once, so a charge's
[`splitRecipients`](./charges.md) can reference it by `id` instead of a
raw address. This exists to close a redirect risk: with `charges:write`
alone, a key can never route a slice of a payment to an address you
haven't already trusted — registering (or approving) a new payout
destination needs the separate `recipients:write` scope, and using an
already-registered one in a split needs `charges:split_write`. A single
key is never issued both.

## Registering a recipient

```ts
const recipient = await klap.recipients.create({
  address: '0x000000000000000000000000000000000000ab',
  label: 'sales rep', // optional, your own bookkeeping — never interpreted
})

console.log(recipient.id) // rc_... — this is what a charge split references
```

`create()` is an **idempotent upsert** keyed on `address`: registering an
address that's already known just updates its `label` and (if it was
revoked) un-revokes it — safe to call again without checking whether the
recipient already exists first. Registering resets `payout` to `false`
regardless of what it was before (see below).

## Using a recipient in a charge split

```ts
const charge = await klap.charges.create({
  amount: 49.9,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  expiresIn: 3600,
  splitRecipients: [{ recipientId: recipient.id, percent: 10, label: 'sales rep' }],
})

console.log(charge.splitRecipients) // [{ address: '0x...ab', percent: 10, label: 'sales rep' }]
```

The request and response use different shapes on purpose: you submit a
`recipientId` (something you can only reference, never invent), and read
back the resolved `address` (so you can see where the money actually
went without a second lookup). See [`charges.md`](./charges.md#splitrecipients)
for the full split semantics (percent is of your own net share, max 5
entries, frozen at creation).

Creating a charge with `splitRecipients` requires `charges:split_write`
in addition to `charges:write`.

## Listing and revoking

```ts
const recipients = await klap.recipients.list()
// every non-revoked recipient for this environment, newest first — not paginated

await klap.recipients.revoke(recipient.id)
```

Revoking a recipient that's currently referenced by `payout: true` (see
below) needs `recipients:manage_payout` instead of `recipients:write` —
plain `recipients:write` can only revoke recipients that aren't also an
API key's payout destination.

## `payout` — the link to an API key's own payout address

`recipient.payout` is unrelated to using a recipient in a split (every
non-revoked recipient is already usable there). It controls something
narrower: whether this address is *eligible to become an API key's own
`payoutAddress`* — the destination the merchant's own charges settle to.

```ts
await klap.recipients.setPayout(recipient.id, true)
```

This requires `recipients:manage_payout`, deliberately a stricter scope
than `recipients:write` — it's meant to be held only by a key that's
already gone through its own out-of-band approval (e.g. your dashboard's
internal key), never a third-party integration key. Revoking a
`payout: true` recipient takes effect immediately: any API key whose
`payoutAddress` matches it stops authenticating on its very next request.
