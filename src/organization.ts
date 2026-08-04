import {
  type ListOrganizationsInput,
  type Organization,
  type OrganizationWithRole,
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_LIMIT_MAX,
  type PaginatedOrganizations,
  type UpdateOrganizationInput,
} from '@klappay/types'
import { type HttpConfig, request, resolveOrganizationId } from './http'

export function createOrganizationClient(config: HttpConfig) {
  const list = (input: ListOrganizationsInput = { limit: PAGINATION_LIMIT_DEFAULT }) =>
    request<PaginatedOrganizations>(config, {
      method: 'GET',
      path: '/v1/organizations',
      query: input,
      auth: 'sessionToken',
    })

  return {
    list,

    async *listAll(): AsyncGenerator<OrganizationWithRole> {
      let cursor: string | undefined
      for (;;) {
        const page = await list({ limit: PAGINATION_LIMIT_MAX, cursor })
        for (const org of page.data) yield org
        if (!page.hasMore || !page.nextCursor) return
        cursor = page.nextCursor
      }
    },

    async get(organizationId?: string): Promise<Organization> {
      const id = resolveOrganizationId(config, 'organization.get()', organizationId)
      return request<Organization>(config, {
        method: 'GET',
        path: `/v1/organizations/${id}`,
        auth: 'sessionToken',
      })
    },

    async update(
      organizationId: string | undefined,
      input: UpdateOrganizationInput,
    ): Promise<Organization> {
      const id = resolveOrganizationId(config, 'organization.update()', organizationId)
      return request<Organization>(config, {
        method: 'PATCH',
        path: `/v1/organizations/${id}`,
        body: input,
        auth: 'sessionToken',
      })
    },
  }
}
