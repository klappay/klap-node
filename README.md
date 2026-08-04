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
  baseUrl: 'https://your-klap-api-host', // no default — always required
  apiKey: process.env.KLAP_API_KEY,
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

Full docs live at [`docs/`](https://github.com/klappay/klap-node/tree/main/docs) on GitHub.

| Doc | Covers |
|---|---|
| [`docs/getting-started.md`](https://github.com/klappay/klap-node/tree/main/docs/getting-started.md) | Install, client setup, your first charge |
| [`docs/charges.md`](https://github.com/klappay/klap-node/tree/main/docs/charges.md) | The core resource — create, list, paginate, `waitForConfirmation`/`waitForSettlement` in depth |
| [`docs/webhooks.md`](https://github.com/klappay/klap-node/tree/main/docs/webhooks.md) | Registering webhooks, verifying signatures, `constructEvent` |
| [`docs/verify.md`](https://github.com/klappay/klap-node/tree/main/docs/verify.md) | Public proof-of-payment lookup — the one call needing no credential |
| [`docs/distributions.md`](https://github.com/klappay/klap-node/tree/main/docs/distributions.md) | Discovering and streaming claimable 0xSplits payouts — for keepers/bots, not a typical merchant integration |
| [`docs/authentication.md`](https://github.com/klappay/klap-node/tree/main/docs/authentication.md) | API key vs session token, every account/dashboard resource, and setting a default organization |
| [`docs/errors.md`](https://github.com/klappay/klap-node/tree/main/docs/errors.md) | Every error class the SDK throws, and when |
| [`docs/sandbox-testing.md`](https://github.com/klappay/klap-node/tree/main/docs/sandbox-testing.md) | Simulating any charge event end-to-end with no real on-chain activity |
| [`docs/tree-shaking.md`](https://github.com/klappay/klap-node/tree/main/docs/tree-shaking.md) | Subpath imports for minimal bundles — matters for serverless cold starts too, not just the browser |

## License

MIT — see [`LICENSE`](./LICENSE).
