import type { GetChargeQrCodeQueryRequest, PublicCharge } from '@klappay/types'
import { type HttpConfig, request } from './http'
import { streamSSEEvents } from './sse'

export function createPublicChargesClient(config: Omit<HttpConfig, 'apiKey' | 'sessionToken'>) {
  return {
    async get(chargeId: string): Promise<PublicCharge> {
      return request<PublicCharge>(config, {
        method: 'GET',
        path: `/v1/public/charges/${chargeId}`,
        auth: 'none',
      })
    },

    /**
     * Same EIP-681 QR code as `klap.charges.getQrCode()`, no API key
     * required — the QR only ever encodes data already public via
     * `get()` above (address, accepted pair, amount), so there's
     * nothing this exposes that isn't already exposed there. `query`
     * (`{ token, network }`) is only required when the charge accepts
     * more than one pair.
     */
    async getQrCode(chargeId: string, query?: GetChargeQrCodeQueryRequest): Promise<string> {
      return request<string>(config, {
        method: 'GET',
        path: `/v1/public/charges/${chargeId}/qrcode`,
        query,
        auth: 'none',
        responseType: 'text',
      })
    },

    /**
     * Publicly watch a payment's status progress with no credential
     * needed, same as `get()` above. Yields the full (redacted)
     * `PublicCharge` every time it changes; closes when the server does.
     */
    async *streamEvents(
      chargeId: string,
      signal: AbortSignal = new AbortController().signal,
    ): AsyncGenerator<PublicCharge> {
      const events = streamSSEEvents<PublicCharge>(
        config,
        `/v1/public/charges/${chargeId}/events`,
        signal,
        { auth: 'none' },
      )
      for await (const { event, data } of events) {
        if (event === 'charge') yield data
      }
    },
  }
}

export async function getPublicCharge(chargeId: string, baseUrl: string): Promise<PublicCharge> {
  return createPublicChargesClient({ baseUrl }).get(chargeId)
}
