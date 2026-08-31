---
"@klappay/node": minor
---

`klap.charges.check()`'s result now carries `transactionSender` — the checked `txHash` transaction's own signer, which stays the payer's real wallet even when the payment routed through a swap/aggregator, unlike the credited transfer's own sender. Only populated when `txHash`/`network` was passed and a matching receipt was found; `null` otherwise. Adds the `CheckedCharge<T>` type. Bumps `@klappay/types` to `^3.6.0`.
