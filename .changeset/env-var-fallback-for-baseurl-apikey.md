---
"@klappay/node": minor
---

`createClient()` and every standalone `create*Client()` now fall back
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
