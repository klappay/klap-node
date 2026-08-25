---
"@klappay/node": patch
---

Bump `@klappay/types` to `^3.5.1` and remove the `create()` escrow caveat from `docs/charges.md` — klap-core's creation guard for `escrow`-configured charges was lifted after live end-to-end verification, so `create()` now accepts `escrow` as documented. No schema or code change.
