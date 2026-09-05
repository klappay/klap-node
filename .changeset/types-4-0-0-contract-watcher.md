---
"@klappay/node": patch
---

Bumps `@klappay/types` to `^4.0.0`. This is a major bump upstream — it renames the `moralis_webhook` `TransactionSource` value to `contract_watcher` and `HealthSchema.lastMoralisEventAgeSeconds` to `lastContractWatcherEventAgeSeconds`, reflecting Core's move from Moralis Streams to a self-hosted contract-watcher for payment detection — but neither renamed symbol is referenced anywhere in this SDK's code, tests, or docs, so there's no behavior change or migration needed here.
