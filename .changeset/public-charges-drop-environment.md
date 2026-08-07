---
"@klappay/node": minor
---

Bump `@klappay/types` to 1.1.2. **Breaking: `klap.publicCharges.get()`/`.getQrCode()`/`.streamEvents()` no longer take an `environment` parameter.** The underlying endpoints (`GET /v1/public/charges/{id}`, its SSE sibling, and `GET /v1/public/charges/{id}/qrcode`) now look a charge up by `id` alone — already a global primary key, not scoped by organization or environment, so there was nothing left to disambiguate. `environment` comes back as a field on the `PublicCharge` response instead; assert it yourself if your integration needs to. `getPublicCharge()`'s standalone signature drops the parameter too. No real production consumers of `klap.publicCharges` yet, so this ships as a `minor` rather than forcing a major bump — same call made for the original `klap.verify` removal.
