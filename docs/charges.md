# Charges

`klap.charges` — also available standalone as `createChargesClient` from
`@klappay/node/charges` (see [`tree-shaking.md`](./tree-shaking.md)).
Requires an `apiKey`.

## `create(input)`

```ts
const charge = await klap.charges.create({
  amount: 49.9,
  acceptedPayments: [
    { token: 'USDC', network: 'base' },
    { token: 'USDC', network: 'optimism' },
    { token: 'USDT', network: 'base' },
  ],
  expiresIn: 3600, // seconds, optional — account default otherwise
  externalRef: 'order_123', // your own correlation id, optional
  source: 'checkout', // free-form label, optional
  metadata: { plan: 'pro' }, // optional
})
```

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

`mode` defaults to `'standard'` — the usual lifecycle: accumulates
transfers toward one resolution (`confirmed`/`expired`/`underpaid`),
settles once. Pass `mode: 'continuous'` for a charge that never
resolves — `status` stays `pending` for its entire life, and every
credited transfer settles independently instead of accumulating toward
one confirmation (a link in a creator's bio, a permanent donation/
collection address). `continuous` requires both `amount` and
`expiresIn` to be omitted — there's no goal to accumulate toward and no
deadline. See [`webhooks.md`](./webhooks.md) for the
`charge.contribution_received`/`charge.contribution_settled` events
`continuous` charges emit per contribution instead of the usual
`charge.confirmed`/`charge.settled`, and [`verify.md`](./verify.md) for
how public proof-of-payment lookup differs for a `continuous` charge
(no single `confirmedAt`).

Every field is documented in `@klappay/types`' `CreateChargeSchema` — the
SDK doesn't duplicate that documentation, it re-exports the same types.
The parameter type is `CreateChargeRequest` (not `CreateChargeInput` —
that's the post-parse shape, where defaulted fields like `mode`/
`currency` are always present; `CreateChargeRequest` is what you
actually build, where they're optional).

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
(`pending → partially_paid → confirmed`, or `expired`/`underpaid`), and
watching that state used to mean hand-rolling a polling loop yourself.

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
see).

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
the general form, for the other four events:

```ts
const partiallyPaid = await charge.waitFor('charge.partially_paid')
const expired = await charge.waitFor('charge.expired')
const underpaid = await charge.waitFor('charge.underpaid')
const failed = await charge.waitFor('charge.settlement_failed')
```

`event` is any `TriggerableChargeEvent` (`@klappay/types`) — every
charge `WebhookEventType` except `charge.created`,
`charge.paused`/`charge.reactivated` (background-worker-driven, not a
payment state), and `charge.contribution_received`/
`charge.contribution_settled` (exclusive to `mode: 'continuous'`
charges, not simulable via this trigger). Same underlying engine as
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

`list()` is one page (cursor-based, same as the REST API). `listAll()` is
an async generator that pages through everything automatically:

```ts
for await (const charge of klap.charges.listAll({ status: 'confirmed' })) {
  console.log(charge.id)
}
```

Each `charge` yielded by `listAll()` is the same live-wrapped object as
`create()`/`get()` return — `waitForConfirmation()` etc. all work on it
too.

## `getTimeline(id)`

```ts
const events = await klap.charges.getTimeline('ch_abc123')
// [{ type: 'charge.created', at: '...' }, { type: 'transaction.detected', ... }, ...]
```

Every event recorded against a charge, in chronological order — useful
for debugging a specific payment (why didn't a webhook fire? was a
transfer detected at all?) without separate audit tooling.

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
