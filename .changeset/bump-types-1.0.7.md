---
"@klappay/node": patch
---

Bump `@klappay/types` to 1.0.7. `Webhook`/`WebhookListItem` gain a required `environment: 'live' | 'test' | null` field (set automatically from the API key that created the webhook, never a `create()` input — server now scopes delivery of most events to a webhook's own environment, `null` receiving every environment for backward compatibility). No SDK code changes needed (`klap.webhooks.create()`'s input type is unaffected), but the type change did break the `Webhook` test fixture in `webhooks.test.ts`, fixed here. `docs/webhooks.md` documents the new environment scoping behavior.
