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

`apiKey` is a `klap_live_...`/`klap_test_...` key — it's required for
every method on the client (`charges`, `webhooks`, `sandbox`,
`distributions`, `networks`, `metrics`, `recipients`).

Optional: `debug: true` (logs every outgoing request's method + URL —
never the `Authorization` header — to help diagnose what the SDK is
actually sending), and `timeoutMs` (aborts a request after this long;
default 30s — a hung API or dropped connection would otherwise hang
your code forever. The `waitFor*()` methods use their own
`AbortSignal`/timeout logic and aren't affected by this option).
`apiKey` can also change after construction, without building a new
client — `klap.setApiKey()`.

## Your first charge

```ts
const charge = await klap.charges.create({
  amount: 49.9,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  expiresIn: 3600,
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
- [`webhooks.md`](./webhooks.md) — registering webhooks, and verifying
  signatures on what you receive.
- [`recipients.md`](./recipients.md) — registering trusted split
  recipients, and referencing them by `recipientId` in a charge split.
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

## For LLMs and agents

This site (built from these same files with VitePress) publishes
[`llms.txt`](https://node-sdk.klappay.com/llms.txt) — a link index of
every doc page — and [`llms-full.txt`](https://node-sdk.klappay.com/llms-full.txt)
— the full content of every doc page concatenated into one plain-text
file. Point an agent, RAG pipeline, or MCP server at either as a
lightweight way to give it the whole SDK's documentation without
scraping HTML. Both regenerate on every deploy, so they never drift
from what's on this page.
