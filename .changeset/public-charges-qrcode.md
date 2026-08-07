---
"@klappay/node": minor
---

Bump `@klappay/types` to 1.1.1 and add `klap.publicCharges.getQrCode(chargeId, environment, query?)` — the unauthenticated sibling of `klap.charges.getQrCode()`, backed by the new `GET /v1/public/charges/{id}/qrcode`. Same EIP-681 QR code, no API key required. The authenticated method isn't going away — this is an additional option for a consumer with no API key at all (e.g. embedding a QR code directly in a checkout page).
