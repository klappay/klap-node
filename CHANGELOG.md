# @klappay/node

## 1.1.0

### Minor Changes

- af5a7d2: Add `klap.metrics.query(organizationId, input)` — ad-hoc analytics over your organization's `charges`/`transactions`/`distributions` data, backed by `POST /v1/organizations/{id}/metrics/query` and `@klappay/types@1.0.5`'s `MetricsQueryRequest`/`MetricsQueryResult`. Session-token-authenticated, same as `organization`/`users`/`apiKeys`/`invitations`. Also available standalone via `@klappay/node/metrics`. See `docs/metrics.md`.

## 1.0.1

### Patch Changes

- 3e02cac: Fix `package.json`'s `exports` map pointing `import` at a nonexistent `.mjs` file and `require` at the ESM build instead of the CJS one. `tsup` builds `.js` (ESM) + `.cjs` (CJS) for a `"type": "module"` package — the reversed-from-usual suffix convention `exports` was never updated to match. The package was unimportable via `import` (`ERR_MODULE_NOT_FOUND`) and broken via `require()` (rejects an ESM file) in every published version through 1.0.0.
