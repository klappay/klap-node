---
"@klappay/node": patch
---

Bump `@klappay/types` to 2.0.2. `CreateChargeRequest` gains an optional
`splitRecipients` — up to 5 extra addresses (e.g. a supplier, or
whoever closed the sale) to route a slice of a charge's split to, each
with a `percent` of your own net share and an optional `label`.
`Charge` gains a matching `splitRecipients` (echoes what was set,
empty array if none). No SDK code changes needed, but the type change
did break the `Charge` test fixture in `charges.test.ts`,
`charges-wait.test.ts`, and `sandbox.test.ts`, fixed here.
`docs/charges.md` documents the new field.
