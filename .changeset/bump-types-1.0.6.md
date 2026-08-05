---
"@klappay/node": patch
---

Bump `@klappay/types` to 1.0.6. The only change visible to consumers is `MetricsQuerySchema`'s `orderBy.key` now requiring the same safe-identifier pattern (`^[a-zA-Z_][a-zA-Z0-9_]*$`) `metrics[].alias` already enforced — a defense-in-depth tightening that only rejects a value that could never have been a real output column name. No SDK code changes needed (the type shape is unchanged, only a runtime validation rule server-side). `docs/metrics.md` updated to document the constraint.
