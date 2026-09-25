---
"@klappay/node": patch
---

Bump `@klappay/types` to `^5.1.1`: fixes a bundle-size regression in
`@klappay/types`'s internal `/constants` subpath (the zod-based
`SplitAddressSchema` was accidentally pulled in via a shared file with
`tronAddress()`, ballooning that subpath's bundled weight ~50x). No
public API change — klap-node doesn't import `@klappay/types/constants`
directly, so this is a transparent dependency refresh.
