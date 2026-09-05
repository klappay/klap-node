# @klappay/node

## 4.1.1

### Patch Changes

- 58a92d4: Bumps `@klappay/types` to `^4.0.0`. This is a major bump upstream — it renames the `moralis_webhook` `TransactionSource` value to `contract_watcher` and `HealthSchema.lastMoralisEventAgeSeconds` to `lastContractWatcherEventAgeSeconds`, reflecting Core's move from Moralis Streams to a self-hosted contract-watcher for payment detection — but neither renamed symbol is referenced anywhere in this SDK's code, tests, or docs, so there's no behavior change or migration needed here.

## 4.1.0

### Minor Changes

- c6f0957: Bumps `@klappay/types` to `^3.8.0`, bringing two additive charge features through automatically since `create()`/`get()`/`check()` already re-export their types: `feePayer` on `create()` (set `feePayer: 'payer'` to gross up `amount` so the payer covers Klappay's fee), plus `feePercent`, `feeAmount`, and `merchantAmount` on every `Charge`.

  Also adds `onConfirmationProgress` to `WaitOptions` — fires on the live SSE path with `{ network, blocksSeen, blocksRequired, percent }` while a detected transfer hasn't yet reached its network's required confirmation depth, for rendering a "confirming payment" progress bar instead of a blank wait. `charges.check()`'s result carries the same shape as `confirmationProgress`.

  `getTimeline()` can now return `transfer.reclaimed` — an on-chain transfer that was detected but never reached confirmation depth before vanishing (reverted, or dropped from the canonical chain).

## 4.0.0

### Major Changes

- b05b9da: Adds `klap.charges.refund(id, input)` — refunds an escrow-configured charge's live token balance from its Safe back to the payer instead of the split address, given a valid Safe transaction signature from `escrow.releaserAddress` (mirrors `release()` exactly, mutually exclusive with it). Fires the new `charge.escrow_refunded` event. Bumps `@klappay/types` to `^3.7.0` accordingly.

  **Breaking:** `@klappay/types` 3.7.0 excludes both escrow-terminal events from `TriggerableChargeEvent` — they're only reachable by actually calling `release()`/`refund()`, not the generic sandbox trigger. This removes `klap.sandbox.releaseEscrow(chargeId)` (call `klap.charges.release()` on a test-environment escrow charge instead) and drops `'charge.escrow_released'` as a valid `charge.waitFor(event)` argument (its response already reflects the terminal state, so there's nothing left to wait for).

## 3.5.0

### Minor Changes

- c197d1a: `klap.charges.check()`'s result now carries `transactionSender` — the checked `txHash` transaction's own signer, which stays the payer's real wallet even when the payment routed through a swap/aggregator, unlike the credited transfer's own sender. Only populated when `txHash`/`network` was passed and a matching receipt was found; `null` otherwise. Adds the `CheckedCharge<T>` type. Bumps `@klappay/types` to `^3.6.0`.

## 3.4.2

### Patch Changes

- 8e5187b: Bump `@klappay/types` to 3.5.2. Docs for `charges.create()` now note the
  `409 idempotency_key_reused` error returned when `idempotencyKey` is reused
  with a different request body.

## 3.4.1

### Patch Changes

- db06aac: Bump `@klappay/types` to `^3.5.1` and remove the `create()` escrow caveat from `docs/charges.md` — klap-core's creation guard for `escrow`-configured charges was lifted after live end-to-end verification, so `create()` now accepts `escrow` as documented. No schema or code change.

## 3.4.0

### Minor Changes

- a8a4cb3: Adds `klap.charges.release(id, input)` — releases an escrow-configured charge's live token balance from its Safe to the charge's split address, given a valid Safe transaction signature from `escrow.releaserAddress`. `charge.waitFor('charge.escrow_released')` and `klap.sandbox.releaseEscrow(chargeId)` round out the new `charge.escrow_released` event. Requires `@klappay/types` ^3.5.0, bumped accordingly. `create()`'s `escrow` field is still rejected with `503 escrow_unavailable` — creating an escrow charge isn't possible through this SDK yet, only releasing one already configured.

## 3.3.0

### Minor Changes

- 1e442a9: Adds `klap.charges.check(id, input?)` — triggers an immediate on-chain re-check of a charge instead of waiting for the ~60s background reconciliation pass. Pass `txHash`/`network` (e.g. right after a swap-to-pay or wallet-connect transaction is sent) to verify that specific transaction directly, one RPC call instead of a block-range scan. Never trusts the caller — the charge only changes state if a real matching transfer is found on-chain. Requires `@klappay/types` ^3.2.0, bumped accordingly.

## 3.2.2

### Patch Changes

- 1f69f7c: Bump `@klappay/types` to 3.1.1 (fixes `SwapQuoteSchema.permit2` rejecting `null` for a native-currency swap quote).

## 3.2.1

### Patch Changes

- ea36836: Bump `@klappay/types` to 3.1.0. Purely additive on the types side (new `CHAIN_IDS` constant and a `@klappay/types/constants` entry point) — no changes to any schema or type this SDK uses, so no code changes here.

## 3.2.0

### Minor Changes

- 62cf953: Adds `klap.charges.getQuote(id, input)` — quotes a swap-to-pay (via 0x) from a non-stablecoin cryptocurrency the payer holds into one of a charge's `acceptedPayments` tokens, using the new `charge.swapAlternatives` field to advertise which `(token, network)` pairs are trusted as input. Requires `@klappay/types` ^3.0.2, bumped accordingly.

## 3.1.0

### Minor Changes

- aa18e3d: `createClient()` and every standalone `create*Client()` now fall back
  to `process.env` when `baseUrl`/`apiKey` are omitted, instead of always
  requiring them as constructor args. `KLAP_BASE_URL` is shared across
  every client; `apiKey` is resolved per resource (`KLAP_API_KEY` for the
  composed `createClient()`, `KLAP_CHARGES_API_KEY`/`KLAP_WEBHOOKS_API_KEY`/
  etc. for each standalone client), since different resources are commonly
  issued keys with different scopes. An explicit argument always wins over
  its env var. A new `MissingBaseUrlError` is thrown (mirroring the
  existing `MissingCredentialError`) when neither is set. This is backward
  compatible — every existing call site that already passes `baseUrl`/
  `apiKey` explicitly behaves identically.

## 3.0.0

### Major Changes

- c24aa4e: Add a `recipients` resource (`klap.recipients.create/list/setPayout/revoke`) for registering trusted split-recipient addresses, mirroring `@klappay/types@3.0.0`'s new recipients registry.

  **Breaking:** `charges.create()`'s `splitRecipients` entries are now `{ recipientId, percent, label? }` — a raw `address` is no longer accepted. Register the address first with `klap.recipients.create()`, then reference its `id`. The response shape is unchanged: `charge.splitRecipients` still echoes back the resolved `{ address, percent, label? }`. See `docs/recipients.md` and `docs/charges.md`.

  Bumps the `@klappay/types` dependency to `^3.0.0` and `engines.node` to `>=24`, matching upstream.

## 2.0.3

### Patch Changes

- e13a302: Bump `@klappay/types` to 2.0.4. `Charge.metadata`/`CreateChargeRequest.metadata`
  now type-check the reserved `klappay` key against `KlappayCheckoutMetadataSchema`
  — today just an optional `products` list (`name`, optional `quantity`/`imageUrl`,
  up to 20) shown on Klappay's hosted checkout page. Every other `metadata` key is
  unaffected. `CheckoutProduct`/`CheckoutProductSchema`/`KlappayCheckoutMetadata`/
  `KlappayCheckoutMetadataSchema`/`MetadataWithKlappaySchema`/`CHECKOUT_PRODUCTS_MAX`
  are now re-exported from `@klappay/types` too (2.0.3 defined the schema but didn't
  export it — 2.0.4 fixes that), so you can import the type directly instead of
  relying on `Charge['metadata']`'s structural shape. `docs/charges.md` documents
  `metadata.klappay.products`.

  No SDK code changes were needed for the new field itself — `create()` already
  passes `metadata` through untyped-and-unmodified. `sandbox.ts`'s trigger methods
  did need explicit `Promise<Charge>` return type annotations, though:
  `Charge.metadata`'s new `.catchall()`-based type made TypeScript unable to name
  the inferred return type of `createSandboxClient`/`createClient` portably
  (`TS2742`/`TS7056`), since those two were the only methods in the SDK relying on
  return-type inference all the way through `Charge` instead of an explicit
  annotation.

  Also fixes several real bugs and gaps found during a docs/structure/security/test
  audit, bundled into this same release since they touch the same files:

  - `http.ts`: a non-JSON error response body (e.g. an HTML error page from a
    proxy on a 502/504) threw an uncaught `SyntaxError` instead of a clean
    `KlapApiError` — `res.json()` is now guarded, falling back to the existing
    generic `unknown_error`/`Request failed` shape, same as a JSON body that
    doesn't match the expected error shape.
  - `sse.ts`: `streamChargeEvents` duplicated `streamSSEEvents`' entire
    fetch/buffer/parse loop instead of building on it, and diverged from it in a
    real way — it required the `event:` line to come before `data:` in an SSE
    block, while `streamSSEEvents` (and the SSE spec) don't require any order.
    `streamChargeEvents` is now a 3-line filter over `streamSSEEvents`.
  - `docs/sandbox-testing.md`: fixed a dead anchor link
    (`charges.md#waitforevent-options` → `#waitfor-event-options`).
  - `CLAUDE.md`: removed a stale reference to `resolveOrganizationId()`/`users.ts`
    (klap-core-only concepts that don't exist in this package), and corrected a
    claim that `pnpm docs:build` catches every dead link — it only validates
    whole-file targets, not `#anchor` fragments.

  New test coverage added for edge cases the audit found untested (all previously
  correct behavior, now verified): a non-JSON error body in `http.test.ts`; a
  paginated response with `hasMore: false` but a non-null `nextCursor` in
  `charges.test.ts`; `verifyWebhookSignature`'s timing-safe-length guard against a
  truncated (wrong-length) signature in `webhooks.test.ts`; and an SSE event split
  across two network chunks, plus event/data line order-independence, in
  `sse.test.ts`.

## 2.0.2

### Patch Changes

- ec6b306: Bump `@klappay/types` to 2.0.2. `CreateChargeRequest` gains an optional
  `splitRecipients` — up to 5 extra addresses (e.g. a supplier, or
  whoever closed the sale) to route a slice of a charge's split to, each
  with a `percent` of your own net share and an optional `label`.
  `Charge` gains a matching `splitRecipients` (echoes what was set,
  empty array if none). No SDK code changes needed, but the type change
  did break the `Charge` test fixture in `charges.test.ts`,
  `charges-wait.test.ts`, and `sandbox.test.ts`, fixed here.
  `docs/charges.md` documents the new field.

## 2.0.1

### Patch Changes

- d105892: Bump `@klappay/types` to 2.0.1. `Charge` gains `redirectUrl` (echoes
  the `redirectUrl` set at creation, if any) and `checkoutUrl` (Klappay's
  hosted checkout page URL for this charge, `null` unless hosted checkout
  is configured for your account) — both present on every read
  (`create()`, `get()`, `list()`). `CreateChargeRequest` gains a matching
  optional `redirectUrl` input. No SDK code changes needed, but the type
  change did break the `Charge` test fixture in `charges.test.ts`,
  `charges-wait.test.ts`, and `sandbox.test.ts`, fixed here.
  `docs/charges.md` documents the new fields.

## 2.0.0

### Major Changes

- 62b0ad4: Bump `@klappay/types` to 2.0.0 and shrink the SDK to match klap-core's new, drastically reduced Core surface — account/organization/auth management moved to a separate Dashboard service, and Core now covers only `charges`, `webhooks`, `distributions`, `networks`, `metrics`, and `sandbox` charge-triggering. This is the same scale of change as klap-core's own major bump, so it ships as `major` here too rather than the `minor` used for prior no-real-consumers-yet breaking changes.

  **Removed entirely** — `klap.auth`/`createAuthClient`, `klap.users`/`createUsersClient`, `klap.organization`/`createOrganizationClient`, `klap.apiKeys`/`createApiKeysClient`, `klap.invitations`/`createInvitationsClient`, `klap.publicCharges`/`createPublicChargesClient`/`getPublicCharge` (and their subpath exports, `docs/authentication.md`, `docs/public-charges.md`). None of the underlying endpoints exist server-side anymore.

  **Removed: `klap.charges.cancel(id)`** — `POST /v1/charges/{id}/cancel` no longer exists. `'canceled'` is gone from `ChargeStatusSchema`, and `ChargeCanceledError`/`charge.canceled`/`charge.paid_after_cancel` are gone with it. Every charge status is now reached automatically, on its own timeline — there is no merchant-initiated cancellation.

  **Removed: charge `mode`** — `ChargeModeSchema`/`Charge.mode`/`CreateChargeSchema.mode` and the whole `continuous`-charge concept (`Charge.pausedAt`, `charge.paused`/`charge.reactivated`/`charge.contribution_received`/`charge.contribution_settled`) are gone. Every charge follows the one lifecycle.

  **Removed: `klap.sandbox.triggerEvent()`** — the generic non-charge event trigger and `NonChargeTriggerableEvent` are gone; `klap.sandbox.trigger()` and its charge-event convenience methods are unchanged.

  **Changed: `klap.metrics.query(input)`** — dropped the `organizationId` parameter entirely (was `query(organizationId, input)`, session-token-authenticated against `POST /v1/organizations/{id}/metrics/query`). Now `query(input)`, API-key-authenticated against `POST /v1/metrics/query` — every key only ever sees its own tenant's data, so there's no id to pass. `MetricsQueryResult.meta.scope` is gone (no more member-vs-org access split to report). `MetricsDateGranularity` gains `'year'`; `charges` gains `expiresAt` as a date field; `distributions` gains `distributorAddress`/`processingStartedAt`.

  **Changed: `CreateChargeRequest.amount`/`.expiresIn` are now both required** (previously optional, falling back to an account default). `expiresIn` is capped at 3600 seconds (60 minutes), down from 365 days.

  **Changed: `klap.webhooks.categories`** — now only `payments` (every `charge.*` event) and `webhooks` (the 3 delivery-health events); the `account`/`security` categories and every non-charge, non-delivery-health event they held (`auth.*`, `member.*`, `api_key.*`, `fee_tier.updated`, `payout_address.changed`) are gone. `TypedWebhookPayload` narrows to 11 event types total.

  **Changed: only one credential left** — `apiKey` is now the sole auth mode across the entire client; `sessionToken`/`organizationId` are gone from `CreateClientOptions`/`HttpConfig`, `klap.setOrganizationId()` is gone, and `MissingCredentialError`'s constructor simplified to a single `context` argument (it's always about a missing `apiKey` now).

  Webhook signature headers changed on the wire (server-side, no code change needed): `X-Klap-Signature` → `X-Klappay-Signature`, `X-Klap-Delivery` → `X-Klappay-Delivery`, plus a new `X-Klappay-Event` header — `docs/webhooks.md`'s example updated to match.

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
