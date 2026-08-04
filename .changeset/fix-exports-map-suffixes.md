---
"@klappay/node": patch
---

Fix `package.json`'s `exports` map pointing `import` at a nonexistent `.mjs` file and `require` at the ESM build instead of the CJS one. `tsup` builds `.js` (ESM) + `.cjs` (CJS) for a `"type": "module"` package — the reversed-from-usual suffix convention `exports` was never updated to match. The package was unimportable via `import` (`ERR_MODULE_NOT_FOUND`) and broken via `require()` (rejects an ESM file) in every published version through 1.0.0.
