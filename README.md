<img src="./logo.png" alt="Klap" width="80" />

# @klappay/node

Official Node.js SDK for the Klap Core API — non-custodial crypto
payments. Install it into your own backend project; **it is a library
only** — not meant to be run as a standalone script, and not for browser
use (it handles secret API keys, which must never reach client-side
code).

Built on top of [`@klappay/types`](https://www.npmjs.com/package/@klappay/types) — the same
request/response contracts the API itself uses, so the SDK is always in sync with the actual
API shape.

## Install

```bash
npm install @klappay/node
```

## Quick start

```ts
import { createClient } from '@klappay/node'

const klap = createClient({
  baseUrl: 'https://your-klap-api-host', // no hardcoded default — or set KLAP_BASE_URL and omit this
  apiKey: process.env.KLAP_API_KEY, // or just set KLAP_API_KEY and omit this too
})

const charge = await klap.charges.create({
  amount: 49.9,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
})

try {
  const confirmed = await charge.waitForConfirmation({ timeoutMs: 60 * 60_000 })
  console.log('Paid!', confirmed.amountReceived)
} catch (err) {
  // ChargeExpiredError | ChargeUnderpaidError | WaitTimeoutError — see docs/errors.md
}
```

## Documentation

Full docs live at [`docs/`](https://github.com/klappay/klap-node/tree/main/docs) on GitHub,
and as a browsable site at [node-sdk.klappay.com](https://node-sdk.klappay.com). The site
also publishes [`llms.txt`](https://node-sdk.klappay.com/llms.txt) and
[`llms-full.txt`](https://node-sdk.klappay.com/llms-full.txt) — plain-text, LLM-friendly
versions of these docs, regenerated on every deploy, for feeding an agent or MCP server.

| Doc | Covers |
|---|---|
| [`docs/getting-started.md`](https://github.com/klappay/klap-node/tree/main/docs/getting-started.md) | Install, client setup, your first charge |
| [`docs/charges.md`](https://github.com/klappay/klap-node/tree/main/docs/charges.md) | The core resource — create, list, paginate, `waitForConfirmation`/`waitForSettlement` in depth |
| [`docs/webhooks.md`](https://github.com/klappay/klap-node/tree/main/docs/webhooks.md) | Registering webhooks, verifying signatures, `constructEvent` |
| [`docs/recipients.md`](https://github.com/klappay/klap-node/tree/main/docs/recipients.md) | Registering trusted split recipients, and referencing them by `recipientId` in a charge split |
| [`docs/distributions.md`](https://github.com/klappay/klap-node/tree/main/docs/distributions.md) | Discovering and streaming claimable 0xSplits payouts — for keepers/bots, not a typical merchant integration |
| [`docs/networks.md`](https://github.com/klappay/klap-node/tree/main/docs/networks.md) | The live `(token, network)` capability matrix — build a payment-method picker instead of hardcoding it |
| [`docs/metrics.md`](https://github.com/klappay/klap-node/tree/main/docs/metrics.md) | Ad-hoc analytics over your charges/transactions/distributions data |
| [`docs/errors.md`](https://github.com/klappay/klap-node/tree/main/docs/errors.md) | Every error class the SDK throws, and when |
| [`docs/sandbox-testing.md`](https://github.com/klappay/klap-node/tree/main/docs/sandbox-testing.md) | Simulating any charge event end-to-end with no real on-chain activity |
| [`docs/tree-shaking.md`](https://github.com/klappay/klap-node/tree/main/docs/tree-shaking.md) | Subpath imports for minimal bundles — matters for serverless cold starts too, not just the browser |

## License

MIT — see [`LICENSE`](./LICENSE).
