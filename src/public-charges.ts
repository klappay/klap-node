import type { Environment, PublicCharge } from '@klappay/types'
import { type HttpConfig, request } from './http'
import { streamSSEEvents } from './sse'

export function createPublicChargesClient(config: Omit<HttpConfig, 'apiKey' | 'sessionToken'>) {
  return {
    async get(chargeId: string, environment: Environment): Promise<PublicCharge> {
      return request<PublicCharge>(config, {
        method: 'GET',
        path: `/v1/public/charges/${chargeId}`,
        query: { environment },
        auth: 'none',
      })
    },

    /**
     * Publicly watch a payment's status progress with no credential
     * needed, same as `get()` above. Yields the full (redacted)
     * `PublicCharge` every time it changes; closes when the server does.
     */
    async *streamEvents(
      chargeId: string,
      environment: Environment,
      signal: AbortSignal = new AbortController().signal,
    ): AsyncGenerator<PublicCharge> {
      const events = streamSSEEvents<PublicCharge>(
        config,
        `/v1/public/charges/${chargeId}/events?environment=${environment}`,
        signal,
        { auth: 'none' },
      )
      for await (const { event, data } of events) {
        if (event === 'charge') yield data
      }
    },
  }
}

export async function getPublicCharge(
  chargeId: string,
  environment: Environment,
  baseUrl: string,
): Promise<PublicCharge> {
  return createPublicChargesClient({ baseUrl }).get(chargeId, environment)
}
