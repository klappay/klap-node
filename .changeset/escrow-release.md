---
"@klappay/node": minor
---

Adds `klap.charges.release(id, input)` — releases an escrow-configured charge's live token balance from its Safe to the charge's split address, given a valid Safe transaction signature from `escrow.releaserAddress`. `charge.waitFor('charge.escrow_released')` and `klap.sandbox.releaseEscrow(chargeId)` round out the new `charge.escrow_released` event. Requires `@klappay/types` ^3.5.0, bumped accordingly. `create()`'s `escrow` field is still rejected with `503 escrow_unavailable` — creating an escrow charge isn't possible through this SDK yet, only releasing one already configured.
