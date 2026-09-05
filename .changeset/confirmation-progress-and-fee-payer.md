---
"@klappay/node": minor
---

Bumps `@klappay/types` to `^3.8.0`, bringing two additive charge features through automatically since `create()`/`get()`/`check()` already re-export their types: `feePayer` on `create()` (set `feePayer: 'payer'` to gross up `amount` so the payer covers Klappay's fee), plus `feePercent`, `feeAmount`, and `merchantAmount` on every `Charge`.

Also adds `onConfirmationProgress` to `WaitOptions` — fires on the live SSE path with `{ network, blocksSeen, blocksRequired, percent }` while a detected transfer hasn't yet reached its network's required confirmation depth, for rendering a "confirming payment" progress bar instead of a blank wait. `charges.check()`'s result carries the same shape as `confirmationProgress`.

`getTimeline()` can now return `transfer.reclaimed` — an on-chain transfer that was detected but never reached confirmation depth before vanishing (reverted, or dropped from the canonical chain).
