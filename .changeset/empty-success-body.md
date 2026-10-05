---
'@klappay/node': patch
---

Treat a successful response with an empty body (e.g. `202 Accepted` from `webhooks.retryDelivery`) as `undefined` instead of throwing `Unexpected end of JSON input`.
