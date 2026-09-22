---
"@klappay/node": minor
---

Bumps `@klappay/types` to `^5.0.0`. Additive charge fields flow through automatically since `create()`/`get()`/`check()` already re-export their types: `amountExact`/`amountReceivedExact` (decimal-string amounts, safe from the precision loss `amount`/`amountReceived`'s JSON numbers can suffer) and `paymentUnavailable` (pause payment instructions/fulfillment for this charge without changing its `status`). `getQuote()`'s `SwapQuote` gains matching `inputAmountExact`/`outputAmountExact`/`fees.klappayFeeExact`/`fees.zeroExFeeExact` decimal-string fields.

This is a major bump upstream — `AltTokenSchema`'s `'MATIC'` literal is renamed `'POL'` (Polygon's own 2024 native-currency rename — same asset), and gains `LINK`/`ARB`/`OP`/`CBETH` as additional trusted swap-to-pay input tokens — but neither the renamed nor the new literal is referenced anywhere in this SDK's own code (`charge.swapAlternatives`/`getQuote()`'s types just flow through from `@klappay/types`), so there's no behavior change or migration needed here beyond updating any of your own code that pattern-matches on the literal `'MATIC'` string.

TRON and Arc network onboarding, and per-deployment token metadata (`TOKEN_DEPLOYMENTS`/`getTokenDeployment`), are entirely server-side/data-driven through `klap.networks.get()` — this SDK never hardcoded a network or token list, so there's nothing to update here for either.
