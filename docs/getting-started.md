# Getting started

## Install

```bash
npm install @klappay/node
```

`@klappay/types` comes along as a dependency automatically — you don't
need to install it separately just to use the SDK.

## Create a client

```ts
import { createClient } from '@klappay/node'

const klap = createClient({
  baseUrl: 'https://your-klap-api-host', // required, no default
  apiKey: process.env.KLAP_API_KEY,
})
```

`baseUrl` has no default on purpose — there's no single hardcoded API
host to fall back to, and a wrong silent default is a much harder bug to
notice than a required field that fails loudly if you forget it.

`apiKey` is a `klap_live_...`/`klap_test_...` key created via the Klap
dashboard or `klap.apiKeys.create(...)` (see
[`authentication.md`](./authentication.md)). It's required for
`charges`, `webhooks`, `sandbox`, `distributions`, and `networks` — the
payment-critical part of the API. A handful of other resources
(`organization`, `users`, `apiKeys`, `invitations`) need a **session
token** instead, not an API key — see
[`authentication.md`](./authentication.md) for why these are two
separate credentials, not one.

Optional: `sessionToken` (for the session-scoped resources above),
`organizationId` (a default used by every session-scoped method call
that doesn't pass one explicitly — see [`authentication.md`](./authentication.md#setting-a-default-organization)),
`debug: true` (logs every outgoing request's method + URL — never the
`Authorization` header — to help diagnose what the SDK is actually
sending), and `timeoutMs` (aborts a request after this long; default
30s — a hung API or dropped connection would otherwise hang your code
forever. The `waitFor*()` methods use their own `AbortSignal`/timeout
logic and aren't affected by this option). `apiKey`/`organizationId`
can also both change after construction, without building a new
client — `klap.setApiKey()`/`klap.setOrganizationId()`, see
[`authentication.md`](./authentication.md).

## Your first charge

```ts
const charge = await klap.charges.create({
  amount: 49.9,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
})

console.log(charge.id, charge.address, charge.status) // 'pending'
```

`charge` here isn't just plain data — it's a live object with methods
attached (`refresh()`, `waitForConfirmation()`, `waitForSettlement()`).
See [`charges.md`](./charges.md) for the full resource reference,
including what those methods actually do and how they resolve/reject.

## Where to go next

- [`charges.md`](./charges.md) — the core resource: create, list,
  paginate, and (the SDK's main value-add) observe a charge's status
  until it resolves.
- [`authentication.md`](./authentication.md) — the two credential types,
  and every account/dashboard-management resource.
- [`webhooks.md`](./webhooks.md) — registering webhooks, and verifying
  signatures on what you receive.
- [`public-charges.md`](./public-charges.md) — public, credential-less
  charge lookup, the one part of the SDK safe to call from a browser.
- [`distributions.md`](./distributions.md) — discovering and streaming
  claimable 0xSplits payouts, for keepers/bots, not a typical merchant
  integration.
- [`networks.md`](./networks.md) — the live `(token, network)`
  capability matrix, for building a payment-method picker instead of
  hardcoding it.
- [`metrics.md`](./metrics.md) — ad-hoc analytics over your charges/
  transactions/distributions data.
- [`errors.md`](./errors.md) — every error class the SDK throws, and
  when.
- [`sandbox-testing.md`](./sandbox-testing.md) — testing your
  integration end-to-end without any real on-chain activity.
- [`tree-shaking.md`](./tree-shaking.md) — importing only what you use,
  for bundle-size-sensitive environments (e.g. serverless cold starts).
