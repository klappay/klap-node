import {
  type CreateRecipientRequest,
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_LIMIT_MAX,
  type PaginationQueryRequest,
  type Recipient,
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

    async revoke(id: string): Promise<void> {
      return request<void>(config, {
        method: 'DELETE',
        path: `/v1/recipients/${encodeURIComponent(id)}`,
      })
    },
  }
}
