---
"@klappay/node": patch
---

Bump `@klappay/types` to 2.0.4. `Charge.metadata`/`CreateChargeRequest.metadata`
now type-check the reserved `klappay` key against `KlappayCheckoutMetadataSchema`
— today just an optional `products` list (`name`, optional `quantity`/`imageUrl`,
up to 20) shown on Klappay's hosted checkout page. Every other `metadata` key is
unaffected. `CheckoutProduct`/`CheckoutProductSchema`/`KlappayCheckoutMetadata`/
`KlappayCheckoutMetadataSchema`/`MetadataWithKlappaySchema`/`CHECKOUT_PRODUCTS_MAX`
are now re-exported from `@klappay/types` too (2.0.3 defined the schema but didn't
export it — 2.0.4 fixes that), so you can import the type directly instead of
relying on `Charge['metadata']`'s structural shape. `docs/charges.md` documents
`metadata.klappay.products`.

No SDK code changes were needed for the new field itself — `create()` already
passes `metadata` through untyped-and-unmodified. `sandbox.ts`'s trigger methods
did need explicit `Promise<Charge>` return type annotations, though:
`Charge.metadata`'s new `.catchall()`-based type made TypeScript unable to name
the inferred return type of `createSandboxClient`/`createClient` portably
(`TS2742`/`TS7056`), since those two were the only methods in the SDK relying on
return-type inference all the way through `Charge` instead of an explicit
annotation.

Also fixes several real bugs and gaps found during a docs/structure/security/test
audit, bundled into this same release since they touch the same files:

- `http.ts`: a non-JSON error response body (e.g. an HTML error page from a
  proxy on a 502/504) threw an uncaught `SyntaxError` instead of a clean
  `KlapApiError` — `res.json()` is now guarded, falling back to the existing
  generic `unknown_error`/`Request failed` shape, same as a JSON body that
  doesn't match the expected error shape.
- `sse.ts`: `streamChargeEvents` duplicated `streamSSEEvents`' entire
  fetch/buffer/parse loop instead of building on it, and diverged from it in a
  real way — it required the `event:` line to come before `data:` in an SSE
  block, while `streamSSEEvents` (and the SSE spec) don't require any order.
  `streamChargeEvents` is now a 3-line filter over `streamSSEEvents`.
- `docs/sandbox-testing.md`: fixed a dead anchor link
  (`charges.md#waitforevent-options` → `#waitfor-event-options`).
- `CLAUDE.md`: removed a stale reference to `resolveOrganizationId()`/`users.ts`
  (klap-core-only concepts that don't exist in this package), and corrected a
  claim that `pnpm docs:build` catches every dead link — it only validates
  whole-file targets, not `#anchor` fragments.

New test coverage added for edge cases the audit found untested (all previously
correct behavior, now verified): a non-JSON error body in `http.test.ts`; a
paginated response with `hasMore: false` but a non-null `nextCursor` in
`charges.test.ts`; `verifyWebhookSignature`'s timing-safe-length guard against a
truncated (wrong-length) signature in `webhooks.test.ts`; and an SSE event split
across two network chunks, plus event/data line order-independence, in
`sse.test.ts`.
