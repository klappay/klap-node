# Authentication

The SDK mirrors the API's own two separate auth schemes exactly — it
never blends them into one, because they authenticate genuinely
different things.

| Credential | Used for | Get one via |
|---|---|---|
| **API key** (`apiKey`) | `charges`, `webhooks`, `sandbox` — payment operations | Klap dashboard, or `klap.apiKeys.create(organizationId, ...)` (needs a session token) |
| **Session token** (`sessionToken`) | `organization`, `users`, `apiKeys`, `invitations`, `metrics` — account/dashboard management and analytics | `klap.auth.login()` / `klap.auth.signup()` / `klap.invitations.accept()` |

An API key is long-lived and environment-scoped (`live`/`test`), with no
user attached — it's what a backend integration authenticates with. A
session token is short-lived (7 days) and tied to a specific human
**user only** — never a single organization or role, since a user can
belong to more than one organization, each with its own role. Every
method below that acts on an organization takes its id as an explicit
argument, or falls back to a configured default — see "Setting a
default organization" below.

## Providing credentials

```ts
const klap = createClient({
  baseUrl: '...',
  apiKey: process.env.KLAP_API_KEY, // for charges/webhooks/sandbox
  sessionToken: mySessionToken, // for organization/users/apiKeys/invitations, if needed
  organizationId: 'org_...', // optional default — see below
})
```

You can provide any subset at construction time — the client doesn't
validate anything up front. Each method call checks for the credential
*it specifically needs* at call time. All three can also change later,
without building a new client:

```ts
klap.setApiKey(newKey) // affects every charges/webhooks/sandbox call from here on
klap.setOrganizationId(orgId) // affects every organization/users/apiKeys/invitations call from here on
```

## Setting a default organization

Most integrations only ever act on one organization — repeating its id
on every `klap.organization`/`klap.users`/`klap.apiKeys`/
`klap.invitations` call is pure friction. Configure it once, and every
method below that takes an `organizationId` treats it as optional,
falling back to this default:

```ts
const klap = createClient({ baseUrl: '...', sessionToken, organizationId: 'org_...' })

await klap.organization.get() // uses the default
await klap.apiKeys.create(undefined, { name: 'prod', environment: 'live' }) // same, explicit undefined
await klap.organization.get('org_other') // an explicit id always overrides the default
```

An explicit `organizationId` argument always wins over the configured
default, so a client managing more than one organization (e.g. a
platform integration) can still override it per call. Note that on a
method with more than one argument, the `organizationId` position isn't
fully optional in TypeScript's eyes (a required argument can't follow an
optional one) — pass `undefined` explicitly to use the default, as in
the `apiKeys.create()` example above.

Calling a method with neither an explicit id nor a configured default
throws `MissingCredentialError` immediately, client-side, the same way a
missing `apiKey`/`sessionToken` does. Change the default later with
`klap.setOrganizationId(newId)` — no need to build a new client, e.g.
after `klap.organization.list()` reveals which organization the current
user actually belongs to.

## What happens if you call a method without the right credential

```ts
const klap = createClient({ baseUrl: '...' }) // no apiKey configured

await klap.charges.create({ ... })
// throws MissingCredentialError:
// "/v1/charges requires a apiKey — pass it to createClient(), or call
//  klap.setApiKey() first."
```

This is a client-side check, thrown immediately, before any network call
— not a generic 401 round-tripped from the server. See
[`errors.md`](./errors.md).

## `klap.auth`

```ts
const { token, user } = await klap.auth.signup({ email, password })
// or
const { token, user } = await klap.auth.login({ email, password })

const authenticatedKlap = createClient({ baseUrl: '...', sessionToken: token })

await klap.auth.logout() // revokes the session token immediately, before its 7-day expiry
```

`signup()` creates a brand-new organization (you become its `owner`) —
`login()` doesn't select one at all, since a user can belong to several.
`user` on both responses is pure identity (`id`, `email`, `name`,
`emailVerifiedAt`) — no `organizationId`/`role`, since neither means
anything without first picking which organization. Call
`klap.organization.list()` right after to discover which one(s) you
belong to and each one's role.

### Email verification and password recovery

```ts
await klap.auth.verifyEmail(token) // token from the email signup() sends in the background
await klap.auth.resendVerificationEmail() // session-authenticated, no args

await klap.auth.forgotPassword({ email }) // always resolves the same way, real account or not
await klap.auth.resetPassword({ token, newPassword })
```

`forgotPassword` never reveals whether the email matched an account —
don't build UI that branches on its result. A successful
`resetPassword` invalidates every session token issued before it, not
just the one you're currently holding — an already-authenticated client
built with the old `sessionToken` will start getting `401` and needs a
fresh `klap.auth.login()`.

## `klap.organization`

```ts
const page = await klap.organization.list()
// page.data — each entry is { ...organization, role } — your role in it

for await (const org of klap.organization.listAll()) {
  console.log(org.id, org.role)
}

const org = await klap.organization.get(organizationId)
await klap.organization.update(organizationId, { name: 'New name', payoutAddress: '0x...' })
```

`list()`/`listAll()` are the entry point for discovering which
organization id(s) to use everywhere below — a session token doesn't
carry one. `payoutAddress` must be configured before that organization
can create any charge — `charges.create()` fails with a `422` until it
is. Changing it only affects charges created afterward; an
already-created charge's payout split is frozen from the moment it was
created. Changing `payoutAddress` specifically (not `name`) requires the
calling user's email to be verified — an unverified attempt fails with
`403 email_not_verified`.

## `klap.users`

```ts
const page = await klap.users.list(organizationId)
// page.data, page.nextCursor, page.hasMore

for await (const member of klap.users.listAll(organizationId)) {
  console.log(member.email, member.role)
}

await klap.users.updateRole(organizationId, userId, { role: 'admin' })
await klap.users.remove(organizationId, userId)
```

`list()` returns one cursor-paginated page (same `{ limit, cursor }` →
`{ data, nextCursor, hasMore }` shape as `klap.charges.list()` — see
[`charges.md`](./charges.md#listinput-and-listallfilter)); `listAll()`
pages through every member of that organization automatically.

Role rules are enforced server-side, same as the REST API: you can only
manage a member with a strictly lower role than your own (unless you're
an `owner`), an `admin` can never promote anyone to `admin`/`owner`, and
the organization's last `owner` can never be removed or demoted.

## `klap.apiKeys`

```ts
const key = await klap.apiKeys.create(organizationId, { name: 'production backend', environment: 'live' })
console.log(key.key) // full secret — returned in full only this once

const page = await klap.apiKeys.list(organizationId)
for await (const k of klap.apiKeys.listAll(organizationId)) {
  console.log(k.hint)
}

await klap.apiKeys.revoke(organizationId, keyId)
```

Same cursor-paginated `list()`/`listAll()` pair as `klap.users` above.

Creating a `live` key requires the calling user's email to be verified
(`test` keys don't) — an unverified attempt fails with `403
email_not_verified`.

## `klap.invitations`

```ts
const invitation = await klap.invitations.invite(organizationId, { email: 'teammate@example.com', role: 'member' })
await klap.invitations.revoke(organizationId, invitation.id)

// No session needed — this is how a brand-new teammate gets their first token.
const { token, user } = await klap.invitations.accept({
  token: codeFromTheEmail,
  password: 'only-required-for-a-brand-new-account',
})
```

`invite()` sends a plain-text email with a single-use code (valid 7
days), following the same role-hierarchy rule as `users.updateRole()` —
an `admin` inviter can't invite an `admin` or `owner`. `accept()` needs
no `sessionToken` at all: if the invited email already has a Klap
account, it just adds the membership (`password` is ignored, and any
other organizations that account already belongs to are untouched); if
it doesn't, `password` is required and creates the account in the same
step.

## `klap.metrics`

Ad-hoc analytics over your organization's `charges`/`transactions`/
`distributions` data — same session-token requirement as everything
else on this page. See [`metrics.md`](./metrics.md) for the full query
shape (it's more involved than the resources above, so it gets its own
page).
