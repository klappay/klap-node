# @klappay/node

## 1.1.1

### Patch Changes

- 83e6ac3: Bump `@klappay/types` to 1.0.6. The only change visible to consumers is `MetricsQuerySchema`'s `orderBy.key` now requiring the same safe-identifier pattern (`^[a-zA-Z_][a-zA-Z0-9_]*$`) `metrics[].alias` already enforced — a defense-in-depth tightening that only rejects a value that could never have been a real output column name. No SDK code changes needed (the type shape is unchanged, only a runtime validation rule server-side). `docs/metrics.md` updated to document the constraint.

## 1.1.0

### Minor Changes

- af5a7d2: Add `klap.metrics.query(organizationId, input)` — ad-hoc analytics over your organization's `charges`/`transactions`/`distributions` data, backed by `POST /v1/organizations/{id}/metrics/query` and `@klappay/types@1.0.5`'s `MetricsQueryRequest`/`MetricsQueryResult`. Session-token-authenticated, same as `organization`/`users`/`apiKeys`/`invitations`. Also available standalone via `@klappay/node/metrics`. See `docs/metrics.md`.

## 1.0.1

### Patch Changes

- 3e02cac: Fix `package.json`'s `exports` map pointing `import` at a nonexistent `.mjs` file and `require` at the ESM build instead of the CJS one. `tsup` builds `.js` (ESM) + `.cjs` (CJS) for a `"type": "module"` package — the reversed-from-usual suffix convention `exports` was never updated to match. The package was unimportable via `import` (`ERR_MODULE_NOT_FOUND`) and broken via `require()` (rejects an ESM file) in every published version through 1.0.0.
