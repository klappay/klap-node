---
"@klappay/node": patch
---

Bump `@klappay/types` to 2.0.1. `Charge` gains `redirectUrl` (echoes
the `redirectUrl` set at creation, if any) and `checkoutUrl` (Klappay's
hosted checkout page URL for this charge, `null` unless hosted checkout
is configured for your account) — both present on every read
(`create()`, `get()`, `list()`). `CreateChargeRequest` gains a matching
optional `redirectUrl` input. No SDK code changes needed, but the type
change did break the `Charge` test fixture in `charges.test.ts`,
`charges-wait.test.ts`, and `sandbox.test.ts`, fixed here.
`docs/charges.md` documents the new fields.
