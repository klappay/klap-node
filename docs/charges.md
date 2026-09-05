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

`baseUrl`/`apiKey` are optional — they fall back to `KLAP_BASE_URL`/
`KLAP_CHARGES_API_KEY` (see [`getting-started.md`](./getting-started.md#environment-variables))
if omitted.

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

### `feePayer`

By default (`feePayer: 'merchant'`, the default) Klappay's fee is
deducted from `amount` before it reaches your payout. Set
`feePayer: 'payer'` instead to gross up `amount` so the payer covers the
fee — you receive the full `amount` you asked for:

```ts
const charge = await klap.charges.create({
  amount: 49.9,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  expiresIn: 3600,
  feePayer: 'payer',
})
```

Either way, the returned charge carries `feePercent`, `feeAmount`, and
`merchantAmount` so you can render a price breakdown without
reimplementing the fee math yourself — `merchantAmount` is always what
actually lands in your payout, regardless of who covered the fee.

### `escrow`

`CreateChargeSchema`/`ChargeSchema` carry an `escrow` field —
configuring a charge as an escrow instead of a normal payment, moved out
only by a signature from `escrow.releaserAddress`, either to the split
address ([`release(id, input)`](#release-id-input)) or back to the payer
([`refund(id, input)`](#refund-id-input)) — mutually exclusive, an
escrow charge only ever goes one way.

```ts
const charge = await klap.charges.create({
  amount: 49.9,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  expiresIn: 3600,
  escrow: { releaserAddress: '0xabc1234567890123456789012345678901234567' },
})
```

Everything else about `create()` — `acceptedPayments`, `expiresIn`,
`metadata`, `splitRecipients` — works exactly the same on an escrow
charge; `escrow` only changes how the funds are released once paid.

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

`charge.swapAlternatives` is a separate list — cryptocurrencies the
payer can pay with *instead*, swapped into an accepted pair under the
hood via [`getQuote()`](#getquote-id-input) below, not something you
configure on `create()`.

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
yourself (e.g. deriving it from your own order id). Reusing a key with a
*different* request body, instead of a true retry, gets rejected with
`409 idempotency_key_reused`.

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

`onConfirmationProgress` reports how close an already-detected transfer
is to its network's required confirmation depth, for rendering a
"confirming payment" progress bar instead of a blank wait — only fires
on the live SSE path (there's no polling equivalent; it's not part of
`GET /v1/charges/{id}`'s response):

```ts
await charge.waitForConfirmation({
  onConfirmationProgress: (p) => console.log(`${p.network}: ${p.percent}%`),
})
```

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
the time you have an id to trigger against) and the two escrow-terminal
events, `charge.escrow_released`/`charge.escrow_refunded` (reached by
calling [`release()`](#release-id-input)/[`refund()`](#refund-id-input)
directly, whose response already reflects the terminal state — no need
to wait for it separately). Same underlying engine as
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
transfer detected at all?) without separate audit tooling. Includes
`transfer.reclaimed` — an on-chain transfer that was detected but never
reached its network's required confirmation depth before vanishing
(reverted, or dropped from the canonical chain).

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

## `getQuote(id, input)`

Quotes a swap-to-pay: the payer settles the charge with a different
cryptocurrency than any of its `acceptedPayments`, swapped (via 0x)
into one of them under the hood. `charge.swapAlternatives` lists which
`(token, network)` pairs are trusted as swap input for a given charge —
pass one straight through as `inputToken`/`inputNetwork`, alongside the
payer's own wallet address:

```ts
const quote = await klap.charges.getQuote('ch_abc123', {
  inputToken: 'ETH',
  inputNetwork: 'base',
  takerAddress: '0x1111111111111111111111111111111111111111',
})
```

The swap's output is delivered straight to the charge's own `address`,
so once the payer signs and submits `quote.transaction`, the resulting
USDC/USDT is detected and credited exactly like any other transfer —
Klap never sees or custodies the input cryptocurrency, and the merchant
always receives the charge's full remaining amount (`quote.outputAmount`)
regardless of what the payer sent. Klap charges the payer a separate fee
on top (`quote.fees.klappayFee`, plus 0x's own `quote.fees.zeroExFee`
when it applies) — neither ever reduces `outputAmount`.

**Two client-side flows depending on `inputToken`**: a network's own
native currency (`ETH`/`BNB`/`MATIC`/`AVAX`) needs no extra step — sign
and send `quote.transaction` directly. An ERC-20 input (today, only
`BTC`) additionally returns `quote.permit2` — sign that EIP-712 message
first and append the signature to `quote.transaction.data` before
sending.

`quote.expiresAt` is a rough guide for a UI countdown only — the actual
price is enforced on-chain by the swap transaction itself, not by this
timestamp. Requires the `charges:write` scope (not just `charges:read`),
since each call is a real, billable request against Klap's own 0x
account — rate-limited per charge on top of the general per-key rate
limit (`429 rate_limited`).

Not available for `test`-environment charges — 0x has no testnet
support, so this always rejects with `422
swap_test_environment_unsupported` (`charge.swapAlternatives` is
correspondingly always empty on a test charge). See `@klappay/types`'
`CreateSwapQuoteSchema`/`SwapQuoteSchema` for every field's full
documentation.

## `check(id, input?)`

Triggers an immediate on-chain re-check of a charge instead of waiting
for the background reconciliation pass, which otherwise catches a
missed webhook within roughly a minute as a backstop:

```ts
const charge = await klap.charges.check('ch_abc123')
```

Never trusts the caller — it re-runs the same independent on-chain
lookup the reconciliation job and webhook ingestion already use, and
only changes the charge's state if a real matching transfer is found.
If you already have a transaction hash (e.g. right after a swap-to-pay
or wallet-connect transaction is sent), pass it with `network` to
verify that specific transaction directly — one RPC call instead of a
block-range scan, so it resolves faster and cheaper:

```ts
const charge = await klap.charges.check('ch_abc123', {
  txHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
  network: 'base',
})
```

`txHash` and `network` must be provided together, or both omitted.
Rate-limited to once every 10 seconds per charge, shared across every
caller — prefer [`watch()`](#watch-id-signal) to observe the result
instead of polling this repeatedly. See `@klappay/types`'
`CheckChargeRequestSchema` for the full field documentation.

The result also carries `transactionSender` — the checked
transaction's own signer, which stays the payer's real wallet even
when the payment routed through a swap/aggregator on the way in,
unlike the credited transfer's own sender (which can be a router/pool
contract). Only populated when `txHash`/`network` was passed and a
matching receipt was found; `null` otherwise.

It also carries `confirmationProgress` — non-null while a detected
transfer hasn't yet reached its network's required confirmation depth,
same shape `waitForConfirmation()`'s `onConfirmationProgress` reports
live over SSE (see [above](#observing-a-charge-until-it-resolves));
`null` otherwise.

## `release(id, input)`

Releases an escrow-configured charge's entire live token balance from
its dedicated Safe to the charge's split address, where the normal
distribution mechanism then pays out the merchant/platform shares
exactly as it would for a non-escrow charge:

```ts
const charge = await klap.charges.release('ch_abc123', {
  signature: '0x2d0fbf1dba287883a4b6c5aeef9da7653dc68b3e20417d42e87db700ad9e878...',
})
```

`signature` must be a valid Safe transaction signature from this
charge's `escrowReleaserAddress` (see [`escrow`](#escrow) above),
authorizing a transfer of the escrow's full live balance — the amount
actually received, not whatever was fixed at creation, since it can
vary with under/overpayment. Verified on-chain by the Safe contract
itself before anything moves, never taken on faith by Klappay. Can only
be called once per charge — a second call rejects with `409
escrow_already_released` (or `409 escrow_already_refunded` if
[`refund()`](#refund-id-input) got there first — the two are mutually
exclusive). Requires `charges:write`. Fires `charge.escrow_released`
once the release completes on-chain — see [`webhooks.md`](./webhooks.md).

## `refund(id, input)`

Refunds an escrow-configured charge's entire live token balance from
its dedicated Safe back to the address that funded it, instead of the
split address — no distribution follows, the full balance goes
straight to the payer:

```ts
const charge = await klap.charges.refund('ch_abc123', {
  signature: '0x2d0fbf1dba287883a4b6c5aeef9da7653dc68b3e20417d42e87db700ad9e878...',
})
```

`signature` works exactly like [`release()`](#release-id-input)'s —
a valid Safe transaction signature from this charge's
`escrowReleaserAddress`, verified on-chain by the Safe contract itself,
authorizing a transfer of the escrow's full live balance. Mutually
exclusive with `release()` — an escrow can only ever be released or
refunded once, never both; whichever happens first rejects the other
with `409 escrow_already_released`/`409 escrow_already_refunded`.
Requires `charges:write`. Fires `charge.escrow_refunded` once the
refund completes on-chain — see [`webhooks.md`](./webhooks.md).

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
