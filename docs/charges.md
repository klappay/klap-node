# Charges

`klap.charges` — also available standalone as `createChargesClient` from
`@klappay/node/charges` (see [`tree-shaking.md`](./tree-shaking.md)).
Requires an `apiKey`.

```ts
import { createChargesClient } from '@klappay/node/charges'

const charges = createChargesClient({ baseUrl: '...', apiKey: '...' })
const charge = await charges.create({
  amount: 49.9,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  expiresIn: 3600,
})
```

## `create(input)`

```ts
const charge = await klap.charges.create({
  amount: 49.9,
  acceptedPayments: [
    { token: 'USDC', network: 'base' },
    { token: 'USDC', network: 'optimism' },
    { token: 'USDT', network: 'base' },
  ],
  expiresIn: 3600, // seconds, required — 60 to 3600 (1 hour max)
  externalRef: 'order_123', // your own correlation id, optional
  source: 'checkout', // free-form label, optional
  metadata: {
    plan: 'pro', // yours — any shape, never validated
    klappay: { products: [{ name: 'Pro plan', quantity: 1 }] }, // reserved, see below
  },
  redirectUrl: 'https://yourapp.com/thank-you', // optional, see below
  splitRecipients: [{ recipientId: 'rc_...', percent: 10, label: 'sales rep' }], // optional, see below
})
```

`metadata` is yours to fill with anything — never validated, returned
as-is on every read. **One key is reserved: `metadata.klappay`.** If
present, it must match `KlappayCheckoutMetadataSchema` (imported from
`@klappay/types`, same as every other type here) or the whole request
is rejected — today that's just `products` (up to 20 items, each a
`name` plus optional `quantity`/`imageUrl`), shown on Klappay's hosted
checkout page. Every other key in `metadata` is unaffected and stays
exactly as free-form as before.

`redirectUrl` only matters if you use Klappay's hosted checkout page
(`charge.checkoutUrl` on the returned charge) — it's where the payer
gets sent once that page's charge resolves; ignored otherwise. Must be
`http(s)`. `charge.checkoutUrl` itself is never something you set —
it's `null` unless hosted checkout is configured for your account, and
present on every read (`create()`, `get()`, `list()`) once it is.

### `splitRecipients`

Routes a slice of the charge to up to 5 extra recipients (e.g. a
supplier, or whoever closed the sale) — each identified by `recipientId`
(from [`klap.recipients.create()`](./recipients.md), **not** a raw
address) plus a `percent` and an optional `label` for your own
bookkeeping. **`percent` is of *your own* net share (`100 - feePercent`),
not the charge's gross `amount`** — Klappay's fee is computed on the
gross amount first and is never diluted by how you split what's left.
Frozen at creation like everything else that shapes the split address; a
request whose percents don't fit within your available share is
rejected. Requires the `charges:split_write` scope in addition to
`charges:write`.

The response shape is different from the request on purpose:
`charge.splitRecipients` echoes back the resolved `address` for each
entry (not the `recipientId` you submitted) — an empty array if none —
so reading a charge back tells you where the money actually went without
a second lookup. See [`recipients.md`](./recipients.md) for registering
recipients and the full request/response shape split.

`acceptedPayments` lets the payer choose which rail to actually use — at
least one `(token, network)` pair, up to 14. Every transfer on an
accepted pair is credited and sums toward the charge total —
`charge.paidWith` is an array of every distinct pair that has actually
contributed so far (empty until the first one arrives), so a charge
accepting both USDC and USDT can be confirmed by, say, $9 in USDC plus $1
in USDT. A transfer on a pair that isn't in `acceptedPayments` is still
recorded but never credited. Not sure which pairs are actually live for
your environment right now? See [`networks.md`](./networks.md) —
`klap.networks.get()` returns the current matrix; build a payment-method
picker from it instead of hardcoding the pairs client-side, since it
changes as new networks/tokens come online.

`amount` and `expiresIn` are both required — every charge has a target
amount and a fixed deadline; there's no default to fall back on. `expiresIn`
is capped at 3600 seconds (60 minutes), sized off the slowest chain Klap
supports (a safely-confirmed Ethereum mainnet transfer can take up to
~15 minutes), leaving real margin for payer-side delay on top of that.

Every field is documented in `@klappay/types`' `CreateChargeSchema` — the
SDK doesn't duplicate that documentation, it re-exports the same types.
The parameter type is `CreateChargeRequest` (not `CreateChargeInput` —
that's the post-parse shape, where defaulted fields like `currency` are
always present; `CreateChargeRequest` is what you actually build, where
they're optional).

**Idempotency**: if you don't pass `idempotencyKey`, the SDK generates
one for you automatically. That makes every `create()` call safe to retry
after a network failure or timeout — a retried request with the same key
returns the original charge unchanged instead of creating a duplicate.
Pass your own `idempotencyKey` explicitly if you want to control it
yourself (e.g. deriving it from your own order id).

## `get(id)`

```ts
const charge = await klap.charges.get('ch_abc123')
```

## Observing a charge until it resolves

This is the SDK's main reason to exist over calling the REST API
directly — payments aren't request/response, they have state
(`pending → partially_paid → confirmed`, or `expired`/`underpaid`),
and watching that state used to mean hand-rolling a polling loop
yourself. Every status is reached automatically, on its own timeline —
there is no merchant-initiated cancellation.

```ts
try {
  const confirmed = await charge.waitForConfirmation({ timeoutMs: 60 * 60_000 })
  console.log('Paid!', confirmed.amountReceived)
} catch (err) {
  // ChargeExpiredError | ChargeUnderpaidError | WaitTimeoutError
  // see errors.md
}
```

`waitForConfirmation()` resolves **only** when `status` reaches
`'confirmed'`. Every other terminal outcome — `expired`, `underpaid`, or
the timeout elapsing first — **rejects** with a specific typed error
instead of resolving with a charge you'd have to inspect yourself. This
matches normal Promise semantics: `await` succeeding means the happy path
happened; anything else you have to explicitly `catch`.

```ts
await charge.waitForConfirmation({
  timeoutMs: 3600_000, // default: 1 hour
  pollIntervalMs: 2000, // default: starts at 2s
  onStatusChange: (c) => console.log('now:', c.status), // fires on partially_paid too
})
```

**How it works**: opens a live event stream first (`GET
/v1/charges/{id}/events`, Server-Sent Events) and resolves as soon as the
matching status change is pushed — no fixed polling interval to wait out.
If the stream can't be opened or drops (proxy strips SSE, network blip,
older server), the SDK transparently falls back to polling `GET
/v1/charges/{id}` for the rest of the timeout budget, with backoff (starts
at the `pollIntervalMs` you set or 2s by default, grows ×1.5 per attempt,
caps at 15s) so a long wait doesn't hammer the API. This is why the public
option names (`timeoutMs`, `pollIntervalMs`, `onStatusChange`) are
transport-agnostic — `pollIntervalMs` only matters if the fallback path
ends up being used; your code never has to know which transport actually
resolved the wait.

### Cancelling a wait

Same pattern as `fetch` — pass an `AbortSignal`, cancel with the matching
`AbortController`:

```ts
const controller = new AbortController()

cancelButton.onclick = () => controller.abort()

try {
  const confirmed = await charge.waitForConfirmation({ signal: controller.signal })
} catch (err) {
  if (err.name === 'AbortError') {
    // the merchant's own customer clicked "cancel" — not a payment failure
  }
}
```

Works the same way on `waitForSettlement()`/`waitFor()`. Rejects with the
signal's own `reason` (an `AbortError` `DOMException` by default, or
whatever you passed to `controller.abort(reason)`) — an already-aborted
signal rejects immediately, before any request is made. One thing this
does **not** do: cancel a status check already in flight — abort takes
effect on the next check, or during the wait between checks, not
mid-request. There's no reason to abort `klap.charges.create()` itself
(the charge already exists on the backend the moment that call resolves;
aborting the SDK call doesn't undo it) or a webhook delivery (the abort
is entirely local to your process, not something Klap's server would ever
see). One asymmetry worth knowing: if the wait is currently on the live
SSE-streaming path when you abort, the abort propagates immediately and
rejects the wait — it does **not** fall back to polling first the way a
dropped/failed stream otherwise would.

### `waitForSettlement(options?)`

A **separate** wait, for a **separate** question. `status: 'confirmed'`
means Klap detected the on-chain transfer — it does not mean the money
has reached the merchant's wallet yet, which is a distinct, later step
(`settlementStatus`). Use this when you specifically need to know "has
the payout actually happened," not just "did the payer pay."

```ts
const confirmed = await charge.waitForConfirmation()
const settled = await confirmed.waitForSettlement({ timeoutMs: 10 * 60_000 })
```

Resolves when `settlementStatus === 'completed'`, rejects with
`SettlementFailedError` if it reaches `'failed'`, or `WaitTimeoutError`
if the timeout elapses first.

### `waitFor(event, options?)`

`waitForConfirmation`/`waitForSettlement` cover the two most common
questions — did the payer pay, did the merchant get paid. `waitFor()` is
the general form, for the other five events:

```ts
const partiallyPaid = await charge.waitFor('charge.partially_paid')
const expired = await charge.waitFor('charge.expired')
const underpaid = await charge.waitFor('charge.underpaid')
const failed = await charge.waitFor('charge.settlement_failed')
const overpaid = await charge.waitFor('charge.overpaid')
```

Since `waitFor()` never rejects with a state-specific typed error, timing
out and reaching a different terminal state both surface the same way —
catch `WaitTimeoutError` (from `@klappay/node`) if you want to tell "gave
up waiting" apart from other failures in your own error handling:

```ts
import { WaitTimeoutError } from '@klappay/node'

try {
  const partiallyPaid = await charge.waitFor('charge.partially_paid', { timeoutMs: 30_000 })
} catch (err) {
  if (err instanceof WaitTimeoutError) {
    console.log(`gave up after ${err.timeoutMs}ms waiting on ${err.chargeId}`)
  } else {
    throw err
  }
}
```

`event` is any `TriggerableChargeEvent` (`@klappay/types`) — every charge
`WebhookEventType` except `charge.created` (a charge already exists by
the time you have an id to trigger against). Same underlying engine as
`waitForConfirmation`/`waitForSettlement` (SSE-first, polling fallback,
same `WaitOptions`), but simpler on purpose: it only resolves on the
specific event you asked for, and never rejects with a typed error for a
*different* terminal state the way `waitForConfirmation` does — if the
charge reaches some other terminal state instead, or the timeout elapses
first, you get `WaitTimeoutError` either way. Reach for
`waitForConfirmation()`/`waitForSettlement()` when you want that
richer, typed-rejection behavior for the common case; reach for
`waitFor()` when you're testing a specific event directly (pairs
naturally with `klap.sandbox.trigger()` — see
[`sandbox-testing.md`](./sandbox-testing.md)) or want uniform handling
across events.

### `refresh()`

Returns a fresh copy of the charge (a new API call), still wrapped with
the same `waitForConfirmation`/`waitForSettlement`/`refresh` methods —
useful if you're holding onto a charge object for a while and want the
current state without waiting for anything.

```ts
const latest = await charge.refresh()
```

## `list(input?)` and `listAll(filter?)`

```ts
const page = await klap.charges.list({ status: 'confirmed', limit: 20 })
// page.data, page.nextCursor, page.hasMore
```

`list()` is one page (cursor-based, same as the REST API) — walk pages
yourself by feeding `nextCursor` back in as `cursor` until `hasMore` is
`false`:

```ts
let cursor: string | undefined
do {
  const page = await klap.charges.list({ status: 'confirmed', cursor })
  for (const charge of page.data) console.log(charge.id)
  cursor = page.nextCursor ?? undefined
} while (cursor)
```

`listAll()` is an async generator that pages through everything
automatically instead:

```ts
for await (const charge of klap.charges.listAll({ status: 'confirmed' })) {
  console.log(charge.id)
}
```

Each `charge` yielded by `listAll()` is the same live-wrapped object as
`create()`/`get()` return — `waitForConfirmation()` etc. all work on it
too.

`listAll()`'s parameter is typed `ListChargesFilter`
(`Partial<Omit<ListChargesInput, 'cursor'>>`) rather than
`ListChargesInput` itself — `cursor` is deliberately excluded since
`listAll()` manages pagination internally and always drives it itself.
Combine as many filter fields as you need; they're passed through
unchanged on every page it fetches:

```ts
for await (const charge of klap.charges.listAll({ status: 'confirmed', network: 'base' })) {
  console.log(charge.id, charge.amount)
}
```

## `getTimeline(id)`

```ts
const events = await klap.charges.getTimeline('ch_abc123')
// [{ type: 'charge.created', at: '...' }, { type: 'transaction.detected', ... }, ...]
```

Every event recorded against a charge, in chronological order — useful
for debugging a specific payment (why didn't a webhook fire? was a
transfer detected at all?) without separate audit tooling.

## `getQrCode(id, query?)`

```ts
const svg = await klap.charges.getQrCode('ch_abc123')
// raw SVG string — write it to a file, inline it in HTML, whatever you need
```

A scannable EIP-681 payment QR code, returned as a raw SVG string (not
JSON — this is the one SDK method that isn't). Encodes the charge's
address and amount for one accepted `(token, network)` pair. `query`
(`{ token, network }`) is only required when the charge accepts more
than one pair — with exactly one, it's resolved automatically:

```ts
const svg = await klap.charges.getQrCode('ch_abc123', { token: 'USDC', network: 'base' })
```

## `watch(id, signal?)`

```ts
for await (const charge of klap.charges.watch('ch_abc123')) {
  console.log(charge.status, charge.settlementStatus)
}
```

Raw access to the same live event stream `waitForConfirmation()`/
`waitForSettlement()`/`waitFor()` already use internally — reach for
this only if you need custom logic beyond those three built-in outcomes
(e.g. reacting to every intermediate status change, not just one
terminal one). Yields the full `Charge` every time `status`/
`settlementStatus` changes; the generator ends when the server closes
the stream (terminal state, expiry) or the given `signal` aborts. Most
integrations want `waitForConfirmation()`/`waitForSettlement()`/
`waitFor()` instead — they wrap this exact stream with a typed,
Promise-based API and a polling fallback.

## Raw SSE access

`watch()` itself is built on `streamSSEEvents`, the SDK's lowest-level
SSE primitive — exported directly if you want raw stream access instead
of any of the higher-level polling/waiting helpers above (e.g. talking
to an endpoint this SDK doesn't wrap yet, or handling event types
`watch()` doesn't surface).

```ts
import { streamSSEEvents, type SSEEvent } from '@klappay/node'
import type { Charge } from '@klappay/types'

const controller = new AbortController()
for await (const { event, data } of streamSSEEvents<Charge>(
  { baseUrl: 'https://your-klap-api-host', apiKey: 'sk_...' },
  '/v1/charges/ch_abc123/events',
  controller.signal,
)) {
  console.log(event, data)
}
```

`SSEEvent<T>` is just `{ event: string; data: T }` — the parsed
`event: <name>` / `data: <json>` pair for one message on the stream,
generic over whatever shape `data` decodes to. A comment-only heartbeat
line (`: ping`, sent to keep the connection alive) has neither an
`event:` nor a `data:` line, so it's silently skipped rather than
yielded as an empty event.
