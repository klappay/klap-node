# Errors

The SDK throws, it doesn't return `{ ok, error }` unions — use
`try`/`catch`, and check the error's class (or `instanceof`) to decide
what happened.

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

## `WebhookTimestampToleranceError`

Thrown by `klap.webhooks.constructEvent()` when the signature is valid
but its timestamp falls outside the tolerance window (default 300s) —
a strong signal of a replayed delivery, distinct from a forged one.
Carries `timestamp` (the delivery's own, as a Unix timestamp) and
`toleranceSeconds`. See [`webhooks.md`](./webhooks.md)'s "Signing and
replay protection".

## `MissingCredentialError`

Thrown immediately, client-side, when you call a method that needs an
`apiKey` you didn't provide to `createClient()` — pass it there, or call
`klap.setApiKey()` first.
