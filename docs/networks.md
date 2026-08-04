# Networks

`klap.networks` — also available standalone as `createNetworksClient`
from `@klappay/node/networks` (see
[`tree-shaking.md`](./tree-shaking.md)). Requires an `apiKey`.

## `get()`

```ts
const capabilities = await klap.networks.get()
// { acceptedPayments: [
//   { token: 'USDC', network: 'base' },
//   { token: 'USDC', network: 'optimism' },
//   { token: 'USDT', network: 'base' },
//   ...
// ] }
```

Returns the live `(token, network)` capability matrix for the calling
key's own environment (`live` or `test`) — every pair currently
configured, read straight from the same lookup `POST /v1/charges`
validates `acceptedPayments` against. A pair listed here is always safe
to submit as a charge's `acceptedPayments`; a pair not listed here is
rejected with `422 token_not_supported`.

Build a payment-method picker from this instead of hardcoding the
matrix client-side — it changes as new networks/tokens come online, and
`live`/`test` can differ (a network can be enabled on testnet before it
goes live).

See [`charges.md`](./charges.md) for how `acceptedPayments` is used when
creating a charge.
