---
"@klappay/node": minor
---

Adds `klap.charges.check(id, input?)` — triggers an immediate on-chain re-check of a charge instead of waiting for the ~60s background reconciliation pass. Pass `txHash`/`network` (e.g. right after a swap-to-pay or wallet-connect transaction is sent) to verify that specific transaction directly, one RPC call instead of a block-range scan. Never trusts the caller — the charge only changes state if a real matching transfer is found on-chain. Requires `@klappay/types` ^3.2.0, bumped accordingly.
