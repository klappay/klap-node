# Webhooks

`klap.webhooks` — also available standalone as `createWebhooksClient`
from `@klappay/node/webhooks`. The management methods require an
`apiKey`; the signature-verification helpers need no credential at all
(they're pure functions, no network call).

```ts
import { createWebhooksClient } from '@klappay/node/webhooks'

const webhooks = createWebhooksClient({ baseUrl: '...', apiKey: '...' })
const webhook = await webhooks.create({
  url: 'https://your-server.com/webhooks/klap',
  events: ['charge.confirmed', 'charge.settled'],
})
```

`baseUrl`/`apiKey` are optional — they fall back to `KLAP_BASE_URL`/
`KLAP_WEBHOOKS_API_KEY` (see [`getting-started.md`](./getting-started.md#environment-variables))
if omitted.

## Registering a webhook

```ts
const webhook = await klap.webhooks.create({
  url: 'https://your-server.com/webhooks/klap',
  events: ['charge.confirmed', 'charge.settled'],
})

console.log(webhook.secret) // whsec_... — returned in full ONLY this once, store it now
```

`url` must be HTTPS and publicly reachable — private/internal addresses
are rejected. `secret` is never returned again after this call; every
later `klap.webhooks.list()` only returns a truncated `hint`. If a secret
ever leaks, call `klap.webhooks.rotateSecret(webhookId)` (see "Managing
webhooks" below) rather than deleting and recreating the webhook — the
old secret stops verifying immediately, and the webhook keeps its id and
delivery history.

`charge.confirmed` vs `charge.settled` is a real distinction, not two
names for the same thing: `confirmed` means Klap detected the payment
on-chain; `settled` means the merchant's wallet actually received it —
a separate, later step. Subscribe to `confirmed` if you only need "will
I get paid," or `settled` if you need "has the money actually arrived."
See the full event list in `@klappay/types`' `ChargeWebhookEventTypeSchema`
(10 charge events) and `WebhookDeliveryEventTypeSchema` (3 delivery-health
events) — 13 events total.

### Environment scoping

`webhook.environment` (`'live' | 'test' | null`) is set automatically
from whichever API key created it — there's no `create()` input field
for it, and it can't be changed afterward. `null` means the webhook was
created before this field existed, and it keeps receiving every
environment, same as always. A webhook only receives events whose own
environment matches — a `test`-key webhook never receives a real `live`
charge event, and a `live`-key webhook never receives a sandbox-triggered
one. Register a webhook with each of your `live` and `test` API keys if
you want separate endpoints/handlers per environment.

### Subscribing by category or wildcard, not just individual events

Events are grouped into two categories — `payments` (every `charge.*`
event) and `webhooks` (the three delivery-health events):

```ts
// receive every event in these categories — new events added to a
// category later arrive automatically, no need to update the subscription
await klap.webhooks.create({
  url: 'https://your-server.com/webhooks/klap',
  eventCategories: ['payments', 'webhooks'],
})

// everything except specific exclusions
await klap.webhooks.create({
  url: 'https://your-server.com/webhooks/klap',
  events: ['*'],
  excludeEvents: ['charge.overpaid'],
})
```

`klap.webhooks.categories` lists every event per category, for
discoverability:

```ts
klap.webhooks.categories.payments
// ['charge.created', 'charge.partially_paid', 'charge.confirmed', ...]
```

These are additive — `events` alone (the first example above) keeps
working exactly as before; you only reach for `eventCategories`/wildcard
when you want them.

## Verifying and parsing an inbound webhook

**Always verify the signature before trusting a webhook payload** —
anyone who can reach your endpoint can send you a structurally-valid
request otherwise.

```ts
import { WebhookTimestampToleranceError } from '@klappay/node'

app.post('/webhooks/klap', (req, res) => {
  try {
    const event = klap.webhooks.constructEvent(
      req.rawBody, // the raw, unparsed request body string — not req.body
      req.headers['x-klappay-signature'],
      process.env.KLAP_WEBHOOK_SECRET,
    )

    switch (event.event) {
      case 'charge.settled':
        // event.data is a fully-typed Charge
        break
      case 'webhook.endpoint_unhealthy':
        // event.data is { webhookId, url, failureRatio } — a different,
        // smaller shape, and TypeScript already knows it here without a cast
        break
      // ...
    }

    res.sendStatus(200)
  } catch (err) {
    if (err instanceof WebhookTimestampToleranceError) {
      // validly signed, but too old — likely a replay of a captured delivery
      res.sendStatus(400)
      return
    }
    if (err instanceof SyntaxError) {
      // signature checked out, but the body isn't valid JSON — a
      // corrupted delivery, not a forgery; don't lump this in with a bad signature
      res.sendStatus(400)
      return
    }
    // InvalidWebhookSignatureError — reject, don't process
    res.sendStatus(400)
  }
})
```

App Router's `Request` has no raw-body middleware to configure — call
`req.text()` yourself before any JSON parsing happens:

```ts
import { WebhookTimestampToleranceError } from '@klappay/node'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const rawBody = await req.text()

  try {
    const event = klap.webhooks.constructEvent(
      rawBody,
      req.headers.get('x-klappay-signature') ?? '',
      process.env.KLAP_WEBHOOK_SECRET!,
    )

    switch (event.event) {
      case 'charge.settled':
        break
      // ...
    }

    return new NextResponse(null, { status: 200 })
  } catch (err) {
    if (err instanceof WebhookTimestampToleranceError) {
      return new NextResponse(null, { status: 400 })
    }
    if (err instanceof SyntaxError) {
      return new NextResponse(null, { status: 400 })
    }
    return new NextResponse(null, { status: 400 })
  }
}
```

The only real difference from the Express handler is how the raw body is
obtained — everything downstream of `rawBody` is identical. Whichever
framework you use, get the raw body first: if you read it as JSON
(`req.json()`, `express.json()`) before verification, the bytes
`constructEvent` needs to compute the HMAC over no longer exist.

**A malformed body is not a signature failure.** `constructEvent` verifies
the signature and checks the timestamp tolerance before it ever calls
`JSON.parse` on the body — but if the body isn't valid JSON (a corrupted
delivery, a proxy that mangled it), `JSON.parse` throws a plain
`SyntaxError`, not `InvalidWebhookSignatureError`. A catch-all that
assumes "anything that isn't `WebhookTimestampToleranceError` must be a
bad signature" silently misattributes this case — check for `SyntaxError`
explicitly, as both examples above do. See [`errors.md`](./errors.md) for
every error class the SDK throws.

`constructEvent(rawBody, signatureHeader, secret, options?)` does three
things in one call: verifies the HMAC-SHA256 signature (timing-safe
comparison — never implement this comparison yourself with `===`,
timing attacks are a real risk), checks that the delivery is recent
(`options.toleranceSeconds`, default 300 — 5 minutes), and parses the
body into `TypedWebhookPayload` — a discriminated union keyed by
`event`, so `data` narrows automatically in a `switch`/`if` on `event`
(same pattern as Stripe's `Event.data.object`). Every `charge.*` event
carries the full `Charge` object as `data`; every `webhook.*`
delivery-health event carries `{ webhookId, url, failureRatio? }`
instead (`failureRatio` only present on `webhook.endpoint_unhealthy`) —
see `WebhookEventDataMap` in `@klappay/types` for the exact shape per
event. Throws `InvalidWebhookSignatureError` if the HMAC doesn't match,
or `WebhookTimestampToleranceError` if the signature is valid but the
timestamp is outside the tolerance window (a strong signal of a replayed
delivery — see "Signing and replay protection" below). The envelope
(`id`/`event`/`createdAt`) is validated at runtime; `data` itself is
trusted rather than re-validated per event type, since Klap controls
both producer and consumer of this shape.

If you only want the boolean check without parsing (note: this checks
the HMAC only, not the timestamp tolerance):

```ts
const isValid = klap.webhooks.verifySignature(rawBody, signatureHeader, secret)
```

### Signing and replay protection

The signature header is `t=<unix timestamp>,v1=<hmac>` — the HMAC covers
`${timestamp}.${rawBody}`, not just the body. This is what lets
`constructEvent` reject a delivery that's validly signed but old: anyone
who captures one legitimate delivery (a leaked proxy log, a compromised
intermediary) and replays the exact same body+signature later gets
rejected once the timestamp falls outside the tolerance window,
regardless of how long they hold onto it.

The tolerance window is a mitigation, not a guarantee — a replay sent
*within* the window (a few minutes) still passes. For belt-and-suspenders
protection against that narrower case, deduplicate by the payload's own
`id` (unique per delivery) on your side, especially for any handler whose
effect isn't naturally idempotent.

**Getting the raw body**: most Node frameworks parse the request body
into an object before your handler runs, which is too late for signature
verification (the signature is computed over the exact raw bytes). Make
sure your framework gives you the raw string — e.g. in Express, use
`express.raw({ type: 'application/json' })` (not `express.json()`) on
this specific route, or capture the raw body in middleware before the
JSON parser runs.

## Managing webhooks

```ts
const webhooks = await klap.webhooks.list()
await klap.webhooks.delete(webhookId)

const rotated = await klap.webhooks.rotateSecret(webhookId)
console.log(rotated.secret) // a fresh whsec_... — the old one stops verifying immediately

const page = await klap.webhooks.listDeliveries(webhookId)
// page.data, page.nextCursor, page.hasMore — status, HTTP response code, attempt count

for await (const delivery of klap.webhooks.listAllDeliveries(webhookId)) {
  console.log(delivery.id, delivery.status)
}

await klap.webhooks.retryDelivery(webhookId, deliveryId)
// immediately retries a specific delivery, regardless of its normal retry schedule
```

`listDeliveries()` returns one cursor-paginated page (same `{ limit,
cursor }` → `{ data, nextCursor, hasMore }` shape as
`klap.charges.list()`); `listAllDeliveries()` pages through every
delivery automatically. `klap.webhooks.list()` itself (the webhooks, not
their deliveries) stays unpaginated — capped at 20 active webhooks per
organization.

### None of the management methods are idempotent on a stale id

`delete()` and `rotateSecret()`, called with a webhook id that's already
been deleted, both throw a `KlapApiError` with `code: 'webhook_not_found'`
and `status: 404` — the exact same error you'd get for an id that never
existed at all. This is deliberate on the API side, not a bug: a deleted
webhook is indistinguishable from a nonexistent one, so don't treat either
call as a safe-to-repeat no-op — check `list()` first if you need to know
whether a webhook is still there before acting on it.

`retryDelivery(webhookId, deliveryId)` behaves slightly differently
because it looks up two things: its webhook lookup *does* include deleted
webhooks (so retrying a delivery that was recorded before the webhook was
deleted still resolves the webhook itself), but it still 404s with
`code: 'delivery_not_found'` if that specific `deliveryId` doesn't exist
under it. Pass a `webhookId` that never existed at all, and you get
`code: 'webhook_not_found'` instead — the two failure modes are
distinguishable by `err.code`:

```ts
import { KlapApiError } from '@klappay/node'

try {
  await klap.webhooks.retryDelivery(webhookId, deliveryId)
} catch (err) {
  if (err instanceof KlapApiError && err.code === 'delivery_not_found') {
    // webhookId is valid (even if since deleted); deliveryId isn't
  } else if (err instanceof KlapApiError && err.code === 'webhook_not_found') {
    // webhookId itself never existed
  } else {
    throw err
  }
}
```

See [`errors.md`](./errors.md) for `KlapApiError`'s full shape.

### Scope errors look the same as not-found errors

Every management method (`create`, `list`, `delete`, `rotateSecret`,
`listDeliveries`/`listAllDeliveries`, `retryDelivery`) needs an API key
carrying the appropriate write scope for webhooks. Calling one without it
doesn't throw a distinct "forbidden" class — it raises the same
`KlapApiError` as every other API-side rejection, just with a different
`status`/`code` describing the permission failure. Branch on `err.code`
(not on having caught *a* `KlapApiError` at all) if your handling needs to
tell a scope problem apart from a not-found one.
