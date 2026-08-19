import type { CreateRecipientRequest, Recipient } from '@klappay/types'
import { type HttpConfig, request, withApiKeyEnvFallback } from './http'

export function createRecipientsClient(passedConfig: HttpConfig = {}) {
  const config = withApiKeyEnvFallback(passedConfig, 'KLAP_RECIPIENTS_API_KEY')
  return {
    async create(input: CreateRecipientRequest): Promise<Recipient> {
      return request<Recipient>(config, { method: 'POST', path: '/v1/recipients', body: input })
    },

    async list(): Promise<Recipient[]> {
      return request<Recipient[]>(config, { method: 'GET', path: '/v1/recipients' })
    },

    async setPayout(id: string, payout: boolean): Promise<Recipient> {
      return request<Recipient>(config, {
        method: 'PATCH',
        path: `/v1/recipients/${encodeURIComponent(id)}`,
        body: { payout },
      })
    },

    async revoke(id: string): Promise<void> {
      return request<void>(config, {
        method: 'DELETE',
        path: `/v1/recipients/${encodeURIComponent(id)}`,
      })
    },
  }
}
