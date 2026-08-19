# Errors

The SDK throws, it doesn't return `{ ok, error }` unions — use
`try`/`catch`, and check the error's class (or `instanceof`) to decide
what happened. None of the classes below share a common SDK base error —
each extends `Error` directly — so there's no single SDK type to `catch`
that covers all of them; check `instanceof` against the specific classes
you care about, falling back to `instanceof KlapApiError` for the whole
family of API-side errors, or `instanceof Error` as the final catch-all.

## `KlapApiError`

Thrown for any non-2xx response from the API itself (validation errors,
auth failures, not-found, etc.).

```ts
import { KlapApiError } from '@klappay/node'

try {
  await klap.charges.create({
    amount: -5,
    acceptedPayments: [{ token: 'USDC', network: 'base' }],
    expiresIn: 3600,
  })
} catch (err) {
  if (err instanceof KlapApiError) {
    console.log(err.status) // HTTP status, e.g. 400
    console.log(err.code) // stable machine-readable code, e.g. 'validation_error'
    console.log(err.message) // human-readable explanation
    console.log(err.param) // which field, when applicable, e.g. 'amount'
  }
}
```

`code`/`message`/`param` come straight from the API's own error payload
shape (`@klappay/types`' `ErrorPayloadSchema`) — `code` is the stable
value to branch on programmatically; `message` is for logs/debugging, not
for showing end users.

## Errors from `waitForConfirmation()` / `waitForSettlement()`

These reject instead of resolving with a charge you'd have to inspect —
see [`charges.md`](./charges.md) for the full behavior.

| Error | Thrown when |
|---|---|
| `ChargeExpiredError` | `waitForConfirmation()` — the charge's `status` reached `expired` (nobody paid before `expiresAt`) |
| `ChargeUnderpaidError` | `waitForConfirmation()` — the charge's `status` reached `underpaid` (partial payment, then `expiresAt` passed) |
| `SettlementFailedError` | `waitForSettlement()` — `settlementStatus` reached `failed` (retries exhausted; rare, contact support) |
| `WaitTimeoutError` | Either method — the `timeoutMs` elapsed before a terminal state was reached |

Each carries a `chargeId` property. `WaitTimeoutError` also carries the
`timeoutMs` that was configured.

```ts
import {
  ChargeExpiredError,
  ChargeUnderpaidError,
  WaitTimeoutError,
} from '@klappay/node'

try {
  await charge.waitForConfirmation({ timeoutMs: 60_000 })
} catch (err) {
  if (err instanceof ChargeExpiredError) { /* nobody paid */ }
  else if (err instanceof ChargeUnderpaidError) { /* partial payment only */ }
  else if (err instanceof WaitTimeoutError) { /* still pending, keep checking later */ }
  else throw err
}
```

## `InvalidWebhookSignatureError`

Thrown by `klap.webhooks.constructEvent()` when the signature doesn't
match. See [`webhooks.md`](./webhooks.md).

```ts
import { InvalidWebhookSignatureError } from '@klappay/node'

try {
  const event = klap.webhooks.constructEvent(
    req.rawBody,
    req.headers['x-klappay-signature'],
    process.env.KLAP_WEBHOOK_SECRET,
  )
  // ... handle event
} catch (err) {
  if (err instanceof InvalidWebhookSignatureError) {
    res.sendStatus(400)
    return
  }
  throw err
}
```

See [`webhooks.md`](./webhooks.md#verifying-and-parsing-an-inbound-webhook)
for the full handler, including `WebhookTimestampToleranceError` and the
malformed-body case alongside it.

## `WebhookTimestampToleranceError`

Thrown by `klap.webhooks.constructEvent()` when the signature is valid
but its timestamp falls outside the tolerance window (default 300s) —
a strong signal of a replayed delivery, distinct from a forged one.
Carries `timestamp` (the delivery's own, as a Unix timestamp) and
`toleranceSeconds`. See [`webhooks.md`](./webhooks.md)'s "Signing and
replay protection".

## `MissingCredentialError`

Thrown immediately, client-side, when you call a method that needs an
`apiKey` that resolved to nothing — not passed to `createClient()`, and
no matching `KLAP_*_API_KEY` env var set either (see
[`getting-started.md`](./getting-started.md#environment-variables)).
Pass it explicitly, set the env var, or call `klap.setApiKey()` first.
No request ever reaches the API in this case.

```ts
import { createClient, MissingCredentialError } from '@klappay/node'

const klap = createClient({ baseUrl: 'https://your-klap-api-host' })

try {
  await klap.charges.create({
    amount: 10,
    acceptedPayments: [{ token: 'USDC', network: 'base' }],
    expiresIn: 3600,
  })
} catch (err) {
  if (err instanceof MissingCredentialError) {
    console.log(err.message) // "charges.create() requires an apiKey — ..."
  }
}
```

## `MissingBaseUrlError`

Thrown immediately, client-side, the same way as `MissingCredentialError`
above, but for `baseUrl` — not passed to `createClient()`/`create*Client()`,
and `KLAP_BASE_URL` isn't set either. No request ever reaches the API in
this case.

```ts
import { createChargesClient, MissingBaseUrlError } from '@klappay/node'

const charges = createChargesClient({ apiKey: 'klap_test_...' })

try {
  await charges.get('ch_1')
} catch (err) {
  if (err instanceof MissingBaseUrlError) {
    console.log(err.message) // "/v1/charges/ch_1 requires a baseUrl — ..."
  }
}
```
