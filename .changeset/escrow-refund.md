---
"@klappay/node": major
---

Adds `klap.charges.refund(id, input)` — refunds an escrow-configured charge's live token balance from its Safe back to the payer instead of the split address, given a valid Safe transaction signature from `escrow.releaserAddress` (mirrors `release()` exactly, mutually exclusive with it). Fires the new `charge.escrow_refunded` event. Bumps `@klappay/types` to `^3.7.0` accordingly.

**Breaking:** `@klappay/types` 3.7.0 excludes both escrow-terminal events from `TriggerableChargeEvent` — they're only reachable by actually calling `release()`/`refund()`, not the generic sandbox trigger. This removes `klap.sandbox.releaseEscrow(chargeId)` (call `klap.charges.release()` on a test-environment escrow charge instead) and drops `'charge.escrow_released'` as a valid `charge.waitFor(event)` argument (its response already reflects the terminal state, so there's nothing left to wait for).
