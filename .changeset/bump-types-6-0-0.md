---
"@klappay/node": patch
---

Bumps `@klappay/types` to `^6.0.0`: Arc now settles through the official 0xSplits v2.2 contracts, so `NETWORK_FAMILIES.arc` is `'evm-official'` and `'arc'` is gone from the `NetworkFamily` union. This SDK never referenced `NetworkFamily` or re-exported it, so there's no SDK API change — `charges.create()` now accepts `arc` mixed with any other EVM network in `acceptedPayments` (only `tron` stays isolated). `docs/distributions.md`/`docs/charges.md` updated to match.
