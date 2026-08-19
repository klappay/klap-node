# Networks

`klap.networks` — also available standalone as `createNetworksClient`
from `@klappay/node/networks` (see
[`tree-shaking.md`](./tree-shaking.md)). Requires an `apiKey`.

```ts
import { createNetworksClient } from '@klappay/node/networks'

const networks = createNetworksClient({ baseUrl: '...', apiKey: '...' })
const capabilities = await networks.get()
```

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

## Building a picker

`acceptedPayments` is a flat list of `(token, network)` pairs — group it
however your UI needs. A token-first picker (which networks does this
token settle on?) is a one-line reduce:

```ts
const { acceptedPayments } = await klap.networks.get()

const networksByToken = acceptedPayments.reduce<Record<string, string[]>>(
  (acc, { token, network }) => {
    ;(acc[token] ??= []).push(network)
    return acc
  },
  {},
)
// { USDC: ['base', 'optimism'], USDT: ['base'] }
```

Or index the other way, network-first, if your UI picks a chain before
a token:

```ts
const tokensByNetwork = acceptedPayments.reduce<Record<string, string[]>>(
  (acc, { token, network }) => {
    ;(acc[network] ??= []).push(token)
    return acc
  },
  {},
)
// { base: ['USDC', 'USDT'], optimism: ['USDC'] }
```

`acceptedPayments` can come back empty (`{ acceptedPayments: [] }`) —
not an error, just nothing currently enabled for that environment.
Build the picker to render an empty state rather than assuming the
matrix is always non-empty.

To see whether `live` and `test` actually differ for your own key,
fetch both and diff the pairs — `setApiKey()` swaps which environment
the client authenticates as, no need to build a second client:

```ts
const test = await klap.networks.get()
klap.setApiKey(liveApiKey)
const live = await klap.networks.get()
```

See [`charges.md`](./charges.md) for how `acceptedPayments` is used when
creating a charge.
