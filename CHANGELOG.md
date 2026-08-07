# @klappay/node

## 1.4.0

### Minor Changes

- 1966fed: Bump `@klappay/types` to 1.1.2. **Breaking: `klap.publicCharges.get()`/`.getQrCode()`/`.streamEvents()` no longer take an `environment` parameter.** The underlying endpoints (`GET /v1/public/charges/{id}`, its SSE sibling, and `GET /v1/public/charges/{id}/qrcode`) now look a charge up by `id` alone — already a global primary key, not scoped by organization or environment, so there was nothing left to disambiguate. `environment` comes back as a field on the `PublicCharge` response instead; assert it yourself if your integration needs to. `getPublicCharge()`'s standalone signature drops the parameter too. No real production consumers of `klap.publicCharges` yet, so this ships as a `minor` rather than forcing a major bump — same call made for the original `klap.verify` removal.

## 1.3.0

### Minor Changes

- 94fbcf2: Bump `@klappay/types` to 1.1.1 and add `klap.publicCharges.getQrCode(chargeId, environment, query?)` — the unauthenticated sibling of `klap.charges.getQrCode()`, backed by the new `GET /v1/public/charges/{id}/qrcode`. Same EIP-681 QR code, no API key required. The authenticated method isn't going away — this is an additional option for a consumer with no API key at all (e.g. embedding a QR code directly in a checkout page).

## 1.2.0

### Minor Changes

- 3a4a810: Bump `@klappay/types` to 1.1.0 and sync the SDK with everything klap-core shipped alongside it. No real production consumers of the removed pieces yet, so bundled as one `minor` — same call klap-core's own changeset made for the underlying API changes.

  **Breaking: `klap.verify`/`createVerifyClient`/`verifyCharge` removed** — the underlying `/v1/verify` endpoint no longer exists server-side. Replaced by `klap.publicCharges`/`createPublicChargesClient`/`getPublicCharge` (`@klappay/node/public-charges`), hitting the new `GET /v1/public/charges/{id}` (+ SSE sibling) — same "no credential needed" positioning, different (richer, redacted) response shape, and `environment` is now a required parameter since there's no API key to infer it from. See `docs/public-charges.md`.

  **Breaking: `klap.distributions.list()` is now paginated** — was a bare array (capped at 200), now returns `{ data, nextCursor, hasMore }` like every other list endpoint, with a new `listAll()` async generator to match. `streamPending()` gained an optional `limit` param for a self-contained snapshot+live connection.

  **New: `klap.charges.cancel(id)`** — `POST /v1/charges/{id}/cancel`, the one terminal charge status (`canceled`) reached by the merchant rather than automatically. Not sandbox-triggerable by design — see `docs/sandbox-testing.md`.

  **New: `klap.charges.getQrCode(id, query?)`** — `GET /v1/charges/{id}/qrcode`, returns a scannable payment QR code as a raw SVG string. First non-JSON response in the SDK — `http.ts`'s `request()` gained an internal `responseType?: 'json' | 'text'` option (default unchanged) to support it.

  **New: self-service account methods on `klap.auth`** — `updateName()`, `changePassword()` (returns a fresh session token), `changeEmail()`, `confirmEmailChange()`.

  **New webhook events** (`charge.canceled`, `charge.paid_after_cancel`, `auth.password_changed`, `auth.email_change_requested`, `auth.email_changed`) — no code change needed, `webhooks.ts` never hardcodes the event list; added test coverage only.

  `Charge` gained a required (nullable) `canceledAt` field — no consumer-facing SDK change, but fixed the `Charge`-typed test fixtures it broke.

  **Fix: `waitForConfirmation()` now recognizes `canceled` as terminal.** The new `canceled` status wasn't handled by `waitForConfirmation()`'s own status check — a charge canceled mid-wait would silently keep polling until `WaitTimeoutError` fired at the full `timeoutMs` (1 hour by default) instead of failing fast. Now throws a new `ChargeCanceledError` (same shape as `ChargeExpiredError`/`ChargeUnderpaidError`) as soon as the cancellation is observed.

## 1.1.2

### Patch Changes

- 3b62452: Bump `@klappay/types` to 1.0.7. `Webhook`/`WebhookListItem` gain a required `environment: 'live' | 'test' | null` field (set automatically from the API key that created the webhook, never a `create()` input — server now scopes delivery of most events to a webhook's own environment, `null` receiving every environment for backward compatibility). No SDK code changes needed (`klap.webhooks.create()`'s input type is unaffected), but the type change did break the `Webhook` test fixture in `webhooks.test.ts`, fixed here. `docs/webhooks.md` documents the new environment scoping behavior.

## 1.1.1

### Patch Changes

- 83e6ac3: Bump `@klappay/types` to 1.0.6. The only change visible to consumers is `MetricsQuerySchema`'s `orderBy.key` now requiring the same safe-identifier pattern (`^[a-zA-Z_][a-zA-Z0-9_]*$`) `metrics[].alias` already enforced — a defense-in-depth tightening that only rejects a value that could never have been a real output column name. No SDK code changes needed (the type shape is unchanged, only a runtime validation rule server-side). `docs/metrics.md` updated to document the constraint.

## 1.1.0

### Minor Changes

- af5a7d2: Add `klap.metrics.query(organizationId, input)` — ad-hoc analytics over your organization's `charges`/`transactions`/`distributions` data, backed by `POST /v1/organizations/{id}/metrics/query` and `@klappay/types@1.0.5`'s `MetricsQueryRequest`/`MetricsQueryResult`. Session-token-authenticated, same as `organization`/`users`/`apiKeys`/`invitations`. Also available standalone via `@klappay/node/metrics`. See `docs/metrics.md`.

## 1.0.1

### Patch Changes

- 3e02cac: Fix `package.json`'s `exports` map pointing `import` at a nonexistent `.mjs` file and `require` at the ESM build instead of the CJS one. `tsup` builds `.js` (ESM) + `.cjs` (CJS) for a `"type": "module"` package — the reversed-from-usual suffix convention `exports` was never updated to match. The package was unimportable via `import` (`ERR_MODULE_NOT_FOUND`) and broken via `require()` (rejects an ESM file) in every published version through 1.0.0.
