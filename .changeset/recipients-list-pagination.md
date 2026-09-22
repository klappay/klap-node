---
"@klappay/node": major
---

**Breaking:** `klap.recipients.list()` now matches `GET /v1/recipients`'s own cursor-based pagination — it returns `{ data, nextCursor, hasMore }` instead of a flat `Recipient[]`, the same shape `klap.charges.list()` already used. `list(input?)` takes an optional `{ limit?, cursor? }` (defaulting to the standard 20-item page); a new `klap.recipients.listAll()` async generator pages through every recipient automatically, mirroring `charges.listAll()`. `create()`, `setPayout()`, and `revoke()` are unchanged.
