---
"@klappay/node": patch
---

Bumps `@klappay/types` to `^5.2.0`, which re-enables USDC/USDT payments on BNB Chain (`live`). No SDK API change — `bnb` pairs now show up in `networks.get()` and are accepted by `charges.create()`. `docs/charges.md` now notes that BNB's Binance-Peg tokens use 18 decimals, so prefer `amountReceivedExact` over the numeric `amountReceived`.
