import {
  type CreateRecipientRequest,
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_LIMIT_MAX,
  type PaginationQueryRequest,
  type Recipient,
  type RecipientTransferability,
} from '@klappay/types'
import { type HttpConfig, request, withApiKeyEnvFallback } from './http'

export function createRecipientsClient(passedConfig: HttpConfig = {}) {
  const config = withApiKeyEnvFallback(passedConfig, 'KLAP_RECIPIENTS_API_KEY')
  const list = (input: PaginationQueryRequest = { limit: PAGINATION_LIMIT_DEFAULT }) =>
    request<{ data: Recipient[]; nextCursor: string | null; hasMore: boolean }>(config, {
      method: 'GET',
      path: '/v1/recipients',
      query: input,
    })

  return {
    async create(input: CreateRecipientRequest): Promise<Recipient> {
      return request<Recipient>(config, { method: 'POST', path: '/v1/recipients', body: input })
    },

    list,

    async *listAll(): AsyncGenerator<Recipient> {
      let cursor: string | undefined
      for (;;) {
        const page = await list({ limit: PAGINATION_LIMIT_MAX, cursor })
        yield* page.data
        if (!page.hasMore || !page.nextCursor) return
        cursor = page.nextCursor
      }
    },

    async setPayout(id: string, payout: boolean): Promise<Recipient> {
      return request<Recipient>(config, {
        method: 'PATCH',
        path: `/v1/recipients/${encodeURIComponent(id)}`,
        body: { payout },
      })
    },

    /**
     * What each token issuer's own contract says about this recipient's
     * address, per token/network pair enabled in this key's environment:
     * `receive` (can it be credited) and `send` (can it move funds out).
     * Requires `recipients:read`.
     */
    async getTransferability(id: string): Promise<RecipientTransferability> {
      return request<RecipientTransferability>(config, {
        method: 'GET',
        path: `/v1/recipients/${encodeURIComponent(id)}/transferability`,
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
