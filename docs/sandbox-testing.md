# Testing your integration

Requires a `test`-environment API key (`klap_test_...`). `live` keys
don't have access to `klap.sandbox`, and a `test` key can only ever act
on a `test` charge — not a `live` one, even in the same organization.

## Simulating any event

```ts
const charge = await klap.charges.create({
  amount: 10,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  expiresIn: 3600,
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
a real overpayment detected on-chain. This is the only sandbox trigger
endpoint — webhook-delivery-health events (`webhook.delivery_failed`,
etc.) are derived from real delivery attempts and have no simulated
trigger of their own.

```ts
await klap.sandbox.overpay(charge.id, 15)
const overpaid = await charge.waitFor('charge.overpaid')

expect(overpaid.isOverpaid).toBe(true)
```

`settle()` and `failSettlement()` only make sense on a charge that's
already `confirmed` — this is the pair to reach for when what you're
actually testing is your settlement/payout handling, not the payment
itself, and you want it to resolve (or fail) without spending real gas:

```ts
await klap.sandbox.confirm(charge.id)
await klap.sandbox.settle(charge.id)

const settled = await charge.waitForSettlement()
expect(settled.settlementStatus).toBe('completed')
```

```ts
await klap.sandbox.confirm(charge.id)
await klap.sandbox.failSettlement(charge.id)

await expect(charge.waitForSettlement()).rejects.toThrow(SettlementFailedError)
```

`expire()` simulates a charge that nobody ever paid:

```ts
const charge = await klap.charges.create({
  amount: 10,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  expiresIn: 3600,
})

await klap.sandbox.expire(charge.id)
const expired = await charge.waitFor('charge.expired')

expect(expired.status).toBe('expired')
```

Reach for `trigger()` directly — instead of the named convenience
methods above — when the event you want is only known at runtime, e.g.
driven by a parameterized test table, or for a triggerable event that
doesn't yet have its own dedicated method:

```ts
async function simulate(chargeId: string, event: TriggerableChargeEvent) {
  await klap.sandbox.trigger(chargeId, event)
}

await simulate(charge.id, 'charge.settled')
```

## A full integration test

Combine this with `waitFor()` to test your own webhook-handling code
end-to-end, for any event, without any real money or waiting for real
block times:

```ts
const charge = await klap.charges.create({
  amount: 10,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  expiresIn: 3600,
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

See [`charges.md`](./charges.md#waitfor-event-options) for `waitFor()` in
depth.

`waitFor()` also takes the same `onStatusChange`/`signal` options as
`waitForConfirmation()`/`waitForSettlement()` — useful in a sandbox test
to log every intermediate state, or to bound how long a test can hang if
the trigger call itself never resolves:

```ts
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 5_000)

const [confirmed] = await Promise.all([
  charge.waitFor('charge.confirmed', {
    onStatusChange: (c) => console.log('status is now', c.status),
    signal: controller.signal,
  }),
  klap.sandbox.confirm(charge.id),
])
clearTimeout(timeoutId)
```

## Testing your webhook handler without deploying anything

Pair this with `@klappay/cli`'s `klap listen --forward-to` and
`klap sandbox trigger` — drive any event from your terminal while your
own webhook handler, running on `localhost`, receives it with a real
signature. See [`@klappay/cli`](https://www.npmjs.com/package/@klappay/cli)'s
own README for the full mechanism.
