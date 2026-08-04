import {
  type ApiKey,
  type CreateApiKeyInput,
  type ListApiKeysInput,
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_LIMIT_MAX,
  type PaginatedApiKeys,
} from '@klappay/types'
import { type HttpConfig, request, resolveOrganizationId } from './http'

export function createApiKeysClient(config: HttpConfig) {
  const list = (
    organizationId?: string,
    input: ListApiKeysInput = { limit: PAGINATION_LIMIT_DEFAULT },
  ) => {
    const id = resolveOrganizationId(config, 'apiKeys.list()', organizationId)
    return request<PaginatedApiKeys>(config, {
      method: 'GET',
      path: `/v1/organizations/${id}/api-keys`,
      query: input,
      auth: 'sessionToken',
    })
  }

  return {
    async create(organizationId: string | undefined, input: CreateApiKeyInput): Promise<ApiKey> {
      const id = resolveOrganizationId(config, 'apiKeys.create()', organizationId)
      return request<ApiKey>(config, {
        method: 'POST',
        path: `/v1/organizations/${id}/api-keys`,
        body: input,
        auth: 'sessionToken',
      })
    },

    list,

    async *listAll(organizationId?: string): AsyncGenerator<ApiKey> {
      let cursor: string | undefined
      for (;;) {
        const page = await list(organizationId, { limit: PAGINATION_LIMIT_MAX, cursor })
        for (const key of page.data) yield key
        if (!page.hasMore || !page.nextCursor) return
        cursor = page.nextCursor
      }
    },

    async revoke(organizationId: string | undefined, keyId: string): Promise<void> {
      const id = resolveOrganizationId(config, 'apiKeys.revoke()', organizationId)
      return request<void>(config, {
        method: 'DELETE',
        path: `/v1/organizations/${id}/api-keys/${keyId}`,
        auth: 'sessionToken',
      })
    },
  }
}
