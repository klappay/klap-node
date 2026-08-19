import { createChargesClient } from './charges'
import { createDistributionsClient } from './distributions'
import type { HttpConfig } from './http'
import { createMetricsClient } from './metrics'
import { createNetworksClient } from './networks'
import { createRecipientsClient } from './recipients'
import { createSandboxClient } from './sandbox'
import { createWebhooksClient } from './webhooks'

export type CreateClientOptions = {
  /** Base URL of the Klap API you're integrating with. Falls back to `process.env.KLAP_BASE_URL`. */
  baseUrl?: string
  /** `klap_live_...` / `klap_test_...` — required for every method. Falls back to `process.env.KLAP_API_KEY`. */
  apiKey?: string
  /** Logs each outgoing request (method + URL, never the Authorization header). */
  debug?: boolean
  /** Aborts a request after this many ms. Default 30s — `waitFor*()` methods use their own `AbortSignal` and are unaffected. */
  timeoutMs?: number
}

export function createClient(options: CreateClientOptions = {}) {
  const config: HttpConfig = {
    baseUrl: options.baseUrl,
    apiKey: options.apiKey ?? process.env.KLAP_API_KEY,
    debug: options.debug,
    timeoutMs: options.timeoutMs,
  }

  return {
    charges: createChargesClient(config),
    webhooks: createWebhooksClient(config),
    metrics: createMetricsClient(config),
    sandbox: createSandboxClient(config),
    distributions: createDistributionsClient(config),
    networks: createNetworksClient(config),
    recipients: createRecipientsClient(config),
    /** `klap_live_...` / `klap_test_...` — changes what every subsequent call authenticates with, no need to build a new client. */
    setApiKey(apiKey: string): void {
      config.apiKey = apiKey
    },
  }
}

export type KlapClient = ReturnType<typeof createClient>
