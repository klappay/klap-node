# Tree-shaking and minimal bundles

The SDK is split into one module per API resource, each independently
importable via a subpath, instead of one monolithic client class. This
matters even outside the browser — a serverless function's cold-start
time depends on how much code it has to load, so a smaller bundle is a
real win on the server too, not just for front-end bundle size.

## Full client (convenience)

```ts
import { createClient } from '@klappay/node'

const klap = createClient({ baseUrl: '...', apiKey: '...' })
klap.charges.create(...)
klap.webhooks.create(...)
```

Pulls in every resource module, regardless of which ones you actually
call.

## Minimal (only what you use)

```ts
import { createChargesClient } from '@klappay/node/charges'

const charges = createChargesClient({ baseUrl: '...', apiKey: '...' })
charges.create(...)
```

A bundler never even sees the `webhooks`/`users`/`organization`/etc.
modules in this case — they're not in the import graph at all, which
doesn't depend on the bundler being smart enough to eliminate unused
code from a bigger object (dead-code elimination on object properties
isn't reliably supported everywhere; simply not importing the module in
the first place always works).

## Available subpaths

| Subpath | Exports |
|---|---|
| `@klappay/node/charges` | `createChargesClient` |
| `@klappay/node/webhooks` | `createWebhooksClient`, `verifyWebhookSignature`, `constructWebhookEvent` |
| `@klappay/node/public-charges` | `createPublicChargesClient`, `getPublicCharge` — needs no credential at all |
| `@klappay/node/organization` | `createOrganizationClient` |
| `@klappay/node/users` | `createUsersClient` |
| `@klappay/node/api-keys` | `createApiKeysClient` |
| `@klappay/node/invitations` | `createInvitationsClient` |
| `@klappay/node/metrics` | `createMetricsClient` |
| `@klappay/node/auth` | `createAuthClient` |
| `@klappay/node/sandbox` | `createSandboxClient` |
| `@klappay/node/distributions` | `createDistributionsClient` |
| `@klappay/node/networks` | `createNetworksClient` |

Each `create*Client(config)` takes the same config shape `createClient()`
does (`{ baseUrl, apiKey?, sessionToken?, organizationId?, debug?,
timeoutMs? }`) — you're just constructing one resource directly instead
of the full composed client.

## Verifying a webhook without any client at all

`verifyWebhookSignature`/`constructWebhookEvent` (from
`@klappay/node/webhooks`) and `getPublicCharge` (from
`@klappay/node/public-charges`) don't need a configured client — they're
plain functions (or, for `getPublicCharge`, take a `baseUrl` argument
directly). If all you need is webhook signature verification, you don't
need to construct a client at all:

```ts
import { verifyWebhookSignature } from '@klappay/node/webhooks'

const isValid = verifyWebhookSignature(rawBody, signatureHeader, secret)
```
