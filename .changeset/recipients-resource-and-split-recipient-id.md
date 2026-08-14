---
"@klappay/node": major
---

Add a `recipients` resource (`klap.recipients.create/list/setPayout/revoke`) for registering trusted split-recipient addresses, mirroring `@klappay/types@3.0.0`'s new recipients registry.

**Breaking:** `charges.create()`'s `splitRecipients` entries are now `{ recipientId, percent, label? }` — a raw `address` is no longer accepted. Register the address first with `klap.recipients.create()`, then reference its `id`. The response shape is unchanged: `charge.splitRecipients` still echoes back the resolved `{ address, percent, label? }`. See `docs/recipients.md` and `docs/charges.md`.

Bumps the `@klappay/types` dependency to `^3.0.0` and `engines.node` to `>=24`, matching upstream.
