---
"@klappay/node": minor
---

Bumps `@klappay/types` to `^6.2.0` and adds `charges.prepareRelease(id)`/`charges.prepareRefund(id)`, wrapping the new `GET /v1/charges/{id}/release/prepare` and `/refund/prepare` endpoints. Each returns an `EscrowSafeTransaction`: the exact Safe transaction `release()`/`refund()` will execute (destination, token, amount in base units, chain id, Safe nonce, `safeTxHash` and EIP-712 `typedData`), so the escrow's releaser signs `typedData` with any EIP-712 signer (`toSignableEscrowTypedData` from `@klappay/types` adapts it for viem) instead of rebuilding the Safe transaction. Read-only, requires `charges:write`. Escrow release, refund and prepare can now also reject with `422 escrow_safe_mismatch`.
