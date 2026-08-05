import { createApiKeysClient } from './api-keys'
import { createAuthClient } from './auth'
import { createChargesClient } from './charges'
import { createDistributionsClient } from './distributions'
import type { HttpConfig } from './http'
import { createInvitationsClient } from './invitations'
import { createMetricsClient } from './metrics'
import { createNetworksClient } from './networks'
import { createOrganizationClient } from './organization'
import { createSandboxClient } from './sandbox'
import { createUsersClient } from './users'
import { createVerifyClient } from './verify'
import { createWebhooksClient } from './webhooks'

export type CreateClientOptions = {
  /** Base URL of the Klap API you're integrating with (no default — always required). */
  baseUrl: string
  /** `klap_live_...` / `klap_test_...` — required for charges/webhooks/sandbox. */
  apiKey?: string
  /** Session JWT from `klap.auth.login()` — required for every `organization`/`users`/`apiKeys`/`invitations` method (`invitations.accept()` is the one exception — it takes no session, same as signup/login). */
  sessionToken?: string
  /** Default organization id for organization/users/apiKeys/invitations methods that don't get one passed explicitly — most integrations only ever act on one organization, so this saves repeating it on every call. An explicit argument on a given call always overrides this. Change it later with `klap.setOrganizationId()`. */
  organizationId?: string
  /** Logs each outgoing request (method + URL, never the Authorization header). */
  debug?: boolean
  /** Aborts a request after this many ms. Default 30s — `waitFor*()` methods use their own `AbortSignal` and are unaffected. */
  timeoutMs?: number
}

export function createClient(options: CreateClientOptions) {
  const config: HttpConfig = {
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    sessionToken: options.sessionToken,
    organizationId: options.organizationId,
    debug: options.debug,
    timeoutMs: options.timeoutMs,
  }

  return {
    charges: createChargesClient(config),
    webhooks: createWebhooksClient(config),
    verify: createVerifyClient(config),
    organization: createOrganizationClient(config),
    users: createUsersClient(config),
    apiKeys: createApiKeysClient(config),
    invitations: createInvitationsClient(config),
    metrics: createMetricsClient(config),
    auth: createAuthClient(config),
    sandbox: createSandboxClient(config),
    distributions: createDistributionsClient(config),
    networks: createNetworksClient(config),
    /** `klap_live_...` / `klap_test_...` — changes what every subsequent charges/webhooks/sandbox call authenticates with, no need to build a new client. */
    setApiKey(apiKey: string): void {
      config.apiKey = apiKey
    },
    /** Changes the default org used by any organization/users/apiKeys/invitations call that doesn't pass one explicitly, effective on the very next call. */
    setOrganizationId(organizationId: string): void {
      config.organizationId = organizationId
    },
  }
}

export type KlapClient = ReturnType<typeof createClient>
