# Testing your integration

Requires a `test`-environment API key (`klap_test_...`, created with
`environment: 'test'` on `klap.apiKeys.create()`). `live` keys don't have
access to `klap.sandbox`, and a `test` key can only ever act on a `test`
charge — not a `live` one, even in the same organization.

## Simulating any event

```ts
const charge = await klap.charges.create({
  amount: 10,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
})

// instead of waiting for a real on-chain transfer:
await klap.sandbox.confirm(charge.id)
```

`klap.sandbox` wraps a single REST primitive,
`POST /v1/sandbox/charges/{id}/trigger`, which can push a charge into
**any** state transition — not just full payment. `confirm()` is the
convenience method for the most common case; the others cover the rest:

| Method | Simulates |
|---|---|
| `klap.sandbox.confirm(chargeId)` | `charge.confirmed` — full payment |
| `klap.sandbox.partiallyPay(chargeId, amount?)` | `charge.partially_paid` — partial payment (defaults to half the charge amount) |
| `klap.sandbox.overpay(chargeId, amount?)` | `charge.confirmed` + `charge.overpaid` — payment above `amount` (defaults to 1.5x the charge amount) |
| `klap.sandbox.expire(chargeId)` | `charge.expired` — expired with zero payment |
| `klap.sandbox.underpay(chargeId)` | `charge.underpaid` — expired after a partial payment (trigger `partiallyPay` first) |
| `klap.sandbox.settle(chargeId)` | `charge.settled` — payout completed |
| `klap.sandbox.failSettlement(chargeId)` | `charge.settlement_failed` — payout failed |
| `klap.sandbox.trigger(chargeId, event, amount?)` | Any of the above, by event name — what the others call internally |

None of these ever touch the blockchain — `settle()`/`failSettlement()`
simulate the outcome directly instead of calling `distribute()`, so a
test charge never spends real gas. Each has a precondition on the
charge's current state (e.g. `underpay()` requires the charge to already
be `partially_paid`); triggering one out of order rejects with a
`KlapApiError` (`code: 'invalid_trigger_state'`). `overpay()` isn't a
standalone state — it always fires alongside `charge.confirmed`, same as
a real overpayment detected on-chain.

## Simulating account, security, and webhook-delivery events

Events that aren't tied to any charge — `payout_address.changed`,
`api_key.created`/`revoked`, `fee_tier.updated`, `auth.login`/
`auth.login_failed`/`auth.suspicious_activity`,
`webhook.delivery_failed`/`delivery_recovered`/`endpoint_unhealthy`,
`member.removed`/`role_changed` — have their own primitive, since there's
no charge (or any real precondition) to act on:

```ts
await klap.sandbox.triggerEvent('auth.suspicious_activity')
```

This dispatches the event to your subscribed webhooks with synthetic
data matching the real payload shape (see `WebhookEventDataMap` in
`@klappay/types`) — useful for exercising webhook handler code paths that
are otherwise rare or hard to reproduce on demand, like
`webhook.endpoint_unhealthy`. Requires a `test` API key, same as
`klap.sandbox.trigger()`.

## A full integration test

Combine this with `waitFor()` to test your own webhook-handling code
end-to-end, for any event, without any real money or waiting for real
block times:

```ts
const charge = await klap.charges.create({
  amount: 10,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
})

const [confirmed] = await Promise.all([
  charge.waitFor('charge.confirmed', { timeoutMs: 15_000 }),
  klap.sandbox.confirm(charge.id),
])

expect(confirmed.status).toBe('confirmed')
expect(confirmed.amountReceived).toBe(10)
```

Or drive it through the full partial-payment lifecycle:

```ts
await klap.sandbox.partiallyPay(charge.id, 4)
await charge.waitFor('charge.partially_paid')

await klap.sandbox.underpay(charge.id)
const underpaid = await charge.waitFor('charge.underpaid')

expect(underpaid.amountReceived).toBe(4)
```

See [`charges.md`](./charges.md#waitforevent-options) for `waitFor()` in
depth.

## Testing your webhook handler without deploying anything

Pair this with `@klappay/cli`'s `klap listen --forward-to` and
`klap sandbox trigger` — drive any event from your terminal while your
own webhook handler, running on `localhost`, receives it with a real
signature. See [`@klappay/cli`](https://www.npmjs.com/package/@klappay/cli)'s
own README for the full mechanism.
