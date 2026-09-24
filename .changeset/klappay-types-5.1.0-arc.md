---
"@klappay/node": minor
---

Bump `@klappay/types` to `^5.1.0`: `Network` gains `tron` and `arc`
(both already live on `POST /v1/networks`' capability matrix once
enabled for your environment), flowing through automatically to every
`(token, network)` field — `acceptedPayments`, `charge.paidWith`,
`distribution.network`, etc. `CHARGE_ACCEPTED_PAYMENTS_MAX` goes from
14 to 18 to fit the two new networks' token pairs.

Recipient/split-recipient `address` now validates as `SplitAddress` —
an EVM `0x...` address (this covers Arc, which is EVM-compatible) or a
TRON `T...` address — instead of an unchecked string; the request-side
type callers build against is unchanged (still a plain `string`).

Documented an existing-but-previously-undocumented constraint that's
now easy to hit with TRON in the mix: `charges.create()` rejects
`escrow` unless every `acceptedPayments` network is EVM, since escrow's
underlying Safe custody contract isn't deployed on TRON and never will
be.
