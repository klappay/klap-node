# klap-node

Engineering conventions for whoever (human or agent) is editing this
code — not user-facing documentation (that's `README.md` and
`docs/*.md`). This is the official Node.js SDK for the Klap Core API —
a thin, typed wrapper over `@klappay/types`' schemas and `fetch`; it has
no server, no database, no OpenAPI layer. Conventions below are adapted
from `../klap-core`'s `CLAUDE.md`/`.claude/rules`, trimmed to what
actually applies to a package this shape and size — klap-core's
`rules/` vs. `skills/` split, its Prisma/OpenAPI/VitePress-specific
rules, and its server-domain skills (auth, webhooks dispatch, sandbox
simulation, settlement, etc.) don't apply here and weren't imported.

## Commits

Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`,
`test:`, etc.), written in English regardless of what language the
conversation happened in. **Never add a `Co-Authored-By: Claude` (or
similar AI persona) trailer** — a commit is authored as the person
driving the session. Whenever asked to commit, run `git status`/`git
diff` first to see everything pending, not just whatever was most
recently touched, and split into separate commits along real seams
(a feature vs. an unrelated doc fix) rather than bundling.

## Test discipline

Proactively add unit tests that deliver real value on every non-trivial
change — not only when explicitly asked — and actively look for gaps in
the surrounding code while touching it. A test has to be a real check:

- It exercises actual behavior/branching, not a mock's own return value.
- It would fail if the logic broke — asserting on a mock's call args or
  a trivially-true assertion proves nothing.
- It covers the edge case that actually breaks naive logic (an
  already-aborted `AbortSignal`, a paginated response with `hasMore:
  false` but a non-null `nextCursor`, a malformed error-response body),
  not just the first value that happens to pass.

No false positives: a green suite has to mean the thing actually works.
Every method that talks to the network goes through the shared
`request()`/`resolveOrganizationId()` in `http.ts` — those get real
(unmocked-`fetch`) tests covering URL/query building, auth-header
selection, and error parsing; every resource wrapper (`charges.ts`,
`users.ts`, etc.) mocks `./http` and asserts the exact path/body/query/
auth it sends, not just "did it resolve." When touching a function or
reviewing one in passing: look for a branch/edge case/error path with no
test, and for an existing test that's gone stale relative to the code
(asserts a shape the code no longer produces) — fix or delete it rather
than leaving a rotting assertion.

## Code style

- **Reuse before writing.** Check whether the type/helper you're about
  to hand-write already exists — most request/response shapes should
  come straight from `@klappay/types`, not a local re-declaration that
  can drift. Prefer a schema's `*Request` type (`z.input`, pre-parse —
  what a caller actually builds, with defaulted fields optional) for a
  method parameter, and its `*Input`/plain type (`z.infer`, post-parse)
  for a value already received back from the API.
- **Split files along real seams, not line counts.** A resource client
  with several closely-related methods is fine at any length; split
  when a file mixes genuinely distinct concerns.
- **Avoid `as` type assertions** except a narrow, already-validated
  case (e.g. `as const` for literal narrowing). Reach for a type guard
  or a properly narrowed signature first.
- **Never nest a ternary inside another ternary's branch** — a lookup
  object/`Record`, an `if`/`else if` chain, or a small named function
  reads better. A single flat ternary is fine.
- **Test quality, both directions** — see "Test discipline" above.
- **Extract a constant once a magic number/string has real meaning and
  appears more than once** (a timeout, a cap, an error code, a URL
  template) — or even once, if naming it makes the call site clearer
  than the bare literal. Keep it next to the logic that owns it
  (`DEFAULT_REQUEST_TIMEOUT_MS` in `http.ts`) unless a second,
  genuinely unrelated file needs the same value. Watch for values that
  are only coincidentally identical, not conceptually the same limit —
  don't force two unrelated caps onto one shared constant just because
  they happen to both be `255` today.

## Comments

No comments in code, by default. Naming and structure should make
intent obvious. The narrow exception: something genuinely non-obvious
(a workaround for a specific upstream quirk, a deliberate
simplification, a subtle invariant) gets a short comment naming the
*why*, not the *what*. Inside a test, a short comment explaining why an
assertion isn't the naively-expected value (e.g. why a fixture needs a
specific field) is fine — not a license to narrate what the test does.

## Docs stay in sync

`docs/*.md` and `README.md`'s documentation table are real
documentation for integrators, not this file. A change to a public
method's signature, a new resource, or a behavior change to something
already documented → update the matching `docs/*.md` file in the same
change, not a follow-up. A new `docs/*.md` file → link it from
`README.md`'s table and from `docs/getting-started.md`'s "Where to go
next" list — a file sitting in `docs/` unlinked from both is orphaned.
If in doubt whether a change is doc-worthy: if it would surprise someone
reading `docs/` after not touching this code for a month, it's worth a
line.

## Releases (Changesets)

Publishing is a two-step, human-gated process, not a direct `npm
publish` on every push. `pnpm changeset` picks the affected package and
the semver bump — **never auto-inferred from the diff**; whether a
change is breaking/feature/fix is a judgment call about impact, not
something a file-level diff can determine. `.github/workflows/ci.yml`'s
`changeset-check` job fails a PR if files changed with no changeset
describing it. `.github/workflows/release.yml` (`changesets/action`)
notices a pending changeset on `main` and opens/updates a "Version
Packages" PR that bumps `package.json`/`CHANGELOG.md`; merging *that*
PR is the actual publish trigger (`pnpm release` → `changeset publish`).
`npm publish`/`changeset publish`/merging the "Version Packages" PR are
real, external, one-way actions — never run or merge them proactively;
they need the user's explicit go-ahead every time, not just the first
release.

## Parallelize independent work

Default to running independent file reads/edits/investigations/
verification passes in parallel (parallel tool calls in one message,
multiple agents/forks launched together) rather than one after another
— whichever actually shortens wall-clock time. Never leave behind
scratch/coordination files created only to support that split.
