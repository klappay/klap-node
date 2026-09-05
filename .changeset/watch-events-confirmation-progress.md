---
"@klappay/node": minor
---

Add `charges.watchEvents(id, signal?)`: the same live SSE stream as `watch()`, without the `event: charge` filter, so `confirmation_progress` events can also be observed on the same connection. Exports the `isChargeEvent`/`isConfirmationProgressEvent` type guards (used internally by `waitForConfirmation()`) to discriminate the resulting union. `watch()` is unchanged.
