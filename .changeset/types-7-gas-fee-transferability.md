---
"@klappay/node": minor
---

Bumps `@klappay/types` to `^7.0.0` and adds what 6.3.0 and 7.0.0 introduced.

New: `recipients.getTransferability(id)` (`GET /v1/recipients/{id}/transferability`, `recipients:read`) reports what each token issuer's contract says about a recipient's address. `sandbox.settleBelowMinimum(chargeId)` and `waitFor('charge.settlement_below_minimum')` cover the new settlement state.

**Behavior change:** `waitForSettlement()` now rejects with the new `SettlementBelowMinimumError` (carrying `selfSettlement`) when `settlementStatus` reaches `below_minimum`, instead of running out its timeout.

API changes that reach integrators through this SDK: a charge's `amount` now includes a live-quoted `gasFeeAmount` the payer covers, so show `charge.amount` rather than your own input (`requestedAmount` echoes what you asked for). `charges.create()` can reject with `422 amount_below_minimum` (below 0.10 live, 5.00 live on `ethereum`, 0.01 test), `422 recipient_transfer_restricted`, `503 gas_quote_unavailable`, and `400 validation_error` when `acceptedPayments` mixes `ethereum` with another network. `charges.release()` can reject with `422 escrow_release_not_covered`.
