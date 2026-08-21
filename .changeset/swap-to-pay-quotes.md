---
"@klappay/node": minor
---

Adds `klap.charges.getQuote(id, input)` — quotes a swap-to-pay (via 0x) from a non-stablecoin cryptocurrency the payer holds into one of a charge's `acceptedPayments` tokens, using the new `charge.swapAlternatives` field to advertise which `(token, network)` pairs are trusted as input. Requires `@klappay/types` ^3.0.2, bumped accordingly.
