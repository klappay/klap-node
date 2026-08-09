---
"@klappay/node": major
---

Bump `@klappay/types` to 2.0.0 and shrink the SDK to match klap-core's new, drastically reduced Core surface — account/organization/auth management moved to a separate Dashboard service, and Core now covers only `charges`, `webhooks`, `distributions`, `networks`, `metrics`, and `sandbox` charge-triggering. This is the same scale of change as klap-core's own major bump, so it ships as `major` here too rather than the `minor` used for prior no-real-consumers-yet breaking changes.

**Removed entirely** — `klap.auth`/`createAuthClient`, `klap.users`/`createUsersClient`, `klap.organization`/`createOrganizationClient`, `klap.apiKeys`/`createApiKeysClient`, `klap.invitations`/`createInvitationsClient`, `klap.publicCharges`/`createPublicChargesClient`/`getPublicCharge` (and their subpath exports, `docs/authentication.md`, `docs/public-charges.md`). None of the underlying endpoints exist server-side anymore.

**Removed: `klap.charges.cancel(id)`** — `POST /v1/charges/{id}/cancel` no longer exists. `'canceled'` is gone from `ChargeStatusSchema`, and `ChargeCanceledError`/`charge.canceled`/`charge.paid_after_cancel` are gone with it. Every charge status is now reached automatically, on its own timeline — there is no merchant-initiated cancellation.

**Removed: charge `mode`** — `ChargeModeSchema`/`Charge.mode`/`CreateChargeSchema.mode` and the whole `continuous`-charge concept (`Charge.pausedAt`, `charge.paused`/`charge.reactivated`/`charge.contribution_received`/`charge.contribution_settled`) are gone. Every charge follows the one lifecycle.

**Removed: `klap.sandbox.triggerEvent()`** — the generic non-charge event trigger and `NonChargeTriggerableEvent` are gone; `klap.sandbox.trigger()` and its charge-event convenience methods are unchanged.

**Changed: `klap.metrics.query(input)`** — dropped the `organizationId` parameter entirely (was `query(organizationId, input)`, session-token-authenticated against `POST /v1/organizations/{id}/metrics/query`). Now `query(input)`, API-key-authenticated against `POST /v1/metrics/query` — every key only ever sees its own tenant's data, so there's no id to pass. `MetricsQueryResult.meta.scope` is gone (no more member-vs-org access split to report). `MetricsDateGranularity` gains `'year'`; `charges` gains `expiresAt` as a date field; `distributions` gains `distributorAddress`/`processingStartedAt`.

**Changed: `CreateChargeRequest.amount`/`.expiresIn` are now both required** (previously optional, falling back to an account default). `expiresIn` is capped at 3600 seconds (60 minutes), down from 365 days.

**Changed: `klap.webhooks.categories`** — now only `payments` (every `charge.*` event) and `webhooks` (the 3 delivery-health events); the `account`/`security` categories and every non-charge, non-delivery-health event they held (`auth.*`, `member.*`, `api_key.*`, `fee_tier.updated`, `payout_address.changed`) are gone. `TypedWebhookPayload` narrows to 11 event types total.

**Changed: only one credential left** — `apiKey` is now the sole auth mode across the entire client; `sessionToken`/`organizationId` are gone from `CreateClientOptions`/`HttpConfig`, `klap.setOrganizationId()` is gone, and `MissingCredentialError`'s constructor simplified to a single `context` argument (it's always about a missing `apiKey` now).

Webhook signature headers changed on the wire (server-side, no code change needed): `X-Klap-Signature` → `X-Klappay-Signature`, `X-Klap-Delivery` → `X-Klappay-Delivery`, plus a new `X-Klappay-Event` header — `docs/webhooks.md`'s example updated to match.
