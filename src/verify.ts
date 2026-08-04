import type { ChargeStatusEvent, VerifyCharge } from '@klappay/types'
import { type HttpConfig, request } from './http'
import { streamSSEEvents } from './sse'

export function createVerifyClient(config: Omit<HttpConfig, 'apiKey' | 'sessionToken'>) {
  return {
    async get(chargeId: string): Promise<VerifyCharge> {
      return request<VerifyCharge>(config, {
        method: 'GET',
        path: `/v1/verify/${chargeId}`,
        auth: 'none',
      })
    },

    /**
     * Publicly watch a payment's status progress before it's confirmed —
     * no credential needed, same as `get()` above. Yields a minimal
     * `ChargeStatusEvent` (not the full `Charge`) every time `status`/
     * `settlementStatus` changes; closes when the server does (terminal
     * state, expiry, or the given `signal` aborting).
     */
    async *streamEvents(
      chargeId: string,
      signal: AbortSignal = new AbortController().signal,
    ): AsyncGenerator<ChargeStatusEvent> {
      const events = streamSSEEvents<ChargeStatusEvent>(
        config,
        `/v1/verify/${chargeId}/events`,
        signal,
        { auth: 'none' },
      )
      for await (const { event, data } of events) {
        if (event === 'charge') yield data
      }
    },
  }
}

export async function verifyCharge(chargeId: string, baseUrl: string): Promise<VerifyCharge> {
  return createVerifyClient({ baseUrl }).get(chargeId)
}
