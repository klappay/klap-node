---
"@klappay/node": patch
---

Bumps `@klappay/types` to `^6.0.1`: `charges.check()`'s `transactionSender` is now only populated when the hinted `txHash` actually paid the charge — on an open charge its receipt must contain a Transfer of an accepted token to the charge's address, and on an already-`confirmed`/`underpaid` charge it must be a transfer already credited to it (previously always `null` there). Description-only change upstream, no SDK API change; `docs/charges.md` and the `check()` JSDoc updated to match.
