# Webhooks

`klap.webhooks` — also available standalone as `createWebhooksClient`
from `@klappay/node/webhooks`. The management methods require an
`apiKey`; the signature-verification helpers need no credential at all
(they're pure functions, no network call).

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
names for the same thing: `confirmed` means Klap detected the payment on
-chain; `settled` means the merchant's wallet actually received it — a
separate, later step. Subscribe to `confirmed` if you only need "will I
get paid," or `settled` if you need "has the money actually arrived."
A `mode: 'continuous'` charge (see [`charges.md`](./charges.md)) never
reaches `confirmed`/`settled` — it emits `charge.contribution_received`/
`charge.contribution_settled` per contribution instead. See the full
event list in `@klappay/types`' `WebhookEventTypeSchema`.

### Environment scoping

`webhook.environment` (`'live' | 'test' | null`) is set automatically
from whichever API key created it — there's no `create()` input field
for it, and it can't be changed afterward. `null` means the webhook was
created before this field existed, and it keeps receiving every
environment, same as always. Most events (every `charge.*`, the
webhook-management/delivery-health events, `api_key.created`/
`api_key.revoked`) are only delivered to a webhook whose `environment`
matches the event's own; the remaining account/security events
(`member.*`, `auth.*`, `fee_tier.updated`, `payout_address.changed`)
have no environment concept and reach every subscribed webhook
regardless. In practice: register a webhook with each of your `live`
and `test` API keys if you want separate endpoints/handlers per
environment — a `test`-key webhook never receives a real `live` charge
event, and a `live`-key webhook never receives a sandbox-triggered one.

### Subscribing by category or wildcard, not just individual events

Events are grouped into four categories — `payments`, `account`,
`webhooks` (delivery health), `security`:

```ts
// receive every event in these categories — new events added to a
// category later arrive automatically, no need to update the subscription
await klap.webhooks.create({
  url: 'https://your-server.com/webhooks/klap',
  eventCategories: ['payments', 'security'],
})

// everything except specific exclusions
await klap.webhooks.create({
  url: 'https://your-server.com/webhooks/klap',
  events: ['*'],
  excludeEvents: ['auth.login'],
})
```

`klap.webhooks.categories` lists every event per category, for
discoverability:

```ts
klap.webhooks.categories.security
// ['auth.login', 'auth.login_failed', 'auth.suspicious_activity']
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
      req.headers['x-klap-signature'],
      process.env.KLAP_WEBHOOK_SECRET,
    )

    switch (event.event) {
      case 'charge.settled':
        // event.data is a fully-typed Charge
        break
      case 'payout_address.changed':
        // event.data is { organizationId, from, to } — a different, smaller
        // shape, and TypeScript already knows it here without a cast
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
    // InvalidWebhookSignatureError — reject, don't process
    res.sendStatus(400)
  }
})
```

`constructEvent(rawBody, signatureHeader, secret, options?)` does three
things in one call: verifies the HMAC-SHA256 signature (timing-safe
comparison — never implement this comparison yourself with `===`,
timing attacks are a real risk), checks that the delivery is recent
(`options.toleranceSeconds`, default 300 — 5 minutes), and parses the
body into `TypedWebhookPayload` — a discriminated union keyed by
`event`, so `data` narrows automatically in a `switch`/`if` on `event`
(same pattern as Stripe's `Event.data.object`). Charge events
(`charge.*`) carry the full `Charge` object; every other category
carries a smaller, event-specific object — see `WebhookEventDataMap` in
`@klappay/types` for the exact shape per event. Throws
`InvalidWebhookSignatureError` if the HMAC doesn't match, or
`WebhookTimestampToleranceError` if the signature is valid but the
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
