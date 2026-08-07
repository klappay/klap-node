---
"@klappay/node": minor
---

Bump `@klappay/types` to 1.1.0 and sync the SDK with everything klap-core shipped alongside it. No real production consumers of the removed pieces yet, so bundled as one `minor` — same call klap-core's own changeset made for the underlying API changes.

**Breaking: `klap.verify`/`createVerifyClient`/`verifyCharge` removed** — the underlying `/v1/verify` endpoint no longer exists server-side. Replaced by `klap.publicCharges`/`createPublicChargesClient`/`getPublicCharge` (`@klappay/node/public-charges`), hitting the new `GET /v1/public/charges/{id}` (+ SSE sibling) — same "no credential needed" positioning, different (richer, redacted) response shape, and `environment` is now a required parameter since there's no API key to infer it from. See `docs/public-charges.md`.

**Breaking: `klap.distributions.list()` is now paginated** — was a bare array (capped at 200), now returns `{ data, nextCursor, hasMore }` like every other list endpoint, with a new `listAll()` async generator to match. `streamPending()` gained an optional `limit` param for a self-contained snapshot+live connection.

**New: `klap.charges.cancel(id)`** — `POST /v1/charges/{id}/cancel`, the one terminal charge status (`canceled`) reached by the merchant rather than automatically. Not sandbox-triggerable by design — see `docs/sandbox-testing.md`.

**New: `klap.charges.getQrCode(id, query?)`** — `GET /v1/charges/{id}/qrcode`, returns a scannable payment QR code as a raw SVG string. First non-JSON response in the SDK — `http.ts`'s `request()` gained an internal `responseType?: 'json' | 'text'` option (default unchanged) to support it.

**New: self-service account methods on `klap.auth`** — `updateName()`, `changePassword()` (returns a fresh session token), `changeEmail()`, `confirmEmailChange()`.

**New webhook events** (`charge.canceled`, `charge.paid_after_cancel`, `auth.password_changed`, `auth.email_change_requested`, `auth.email_changed`) — no code change needed, `webhooks.ts` never hardcodes the event list; added test coverage only.

`Charge` gained a required (nullable) `canceledAt` field — no consumer-facing SDK change, but fixed the `Charge`-typed test fixtures it broke.

**Fix: `waitForConfirmation()` now recognizes `canceled` as terminal.** The new `canceled` status wasn't handled by `waitForConfirmation()`'s own status check — a charge canceled mid-wait would silently keep polling until `WaitTimeoutError` fired at the full `timeoutMs` (1 hour by default) instead of failing fast. Now throws a new `ChargeCanceledError` (same shape as `ChargeExpiredError`/`ChargeUnderpaidError`) as soon as the cancellation is observed.
