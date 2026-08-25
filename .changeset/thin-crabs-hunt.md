---
"@klappay/node": patch
---

Bump `@klappay/types` to 3.5.2. Docs for `charges.create()` now note the
`409 idempotency_key_reused` error returned when `idempotencyKey` is reused
with a different request body.
