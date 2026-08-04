import {
  type ListUsersInput,
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_LIMIT_MAX,
  type PaginatedUsers,
  type UpdateUserRoleInput,
  type User,
} from '@klappay/types'
import { type HttpConfig, request, resolveOrganizationId } from './http'

export function createUsersClient(config: HttpConfig) {
  const list = (
    organizationId?: string,
    input: ListUsersInput = { limit: PAGINATION_LIMIT_DEFAULT },
  ) => {
    const id = resolveOrganizationId(config, 'users.list()', organizationId)
    return request<PaginatedUsers>(config, {
      method: 'GET',
      path: `/v1/organizations/${id}/users`,
      query: input,
      auth: 'sessionToken',
    })
  }

  return {
    list,

    async *listAll(organizationId?: string): AsyncGenerator<User> {
      let cursor: string | undefined
      for (;;) {
        const page = await list(organizationId, { limit: PAGINATION_LIMIT_MAX, cursor })
        for (const user of page.data) yield user
        if (!page.hasMore || !page.nextCursor) return
        cursor = page.nextCursor
      }
    },

    async updateRole(
      organizationId: string | undefined,
      userId: string,
      input: UpdateUserRoleInput,
    ): Promise<User> {
      const id = resolveOrganizationId(config, 'users.updateRole()', organizationId)
      return request<User>(config, {
        method: 'PATCH',
        path: `/v1/organizations/${id}/users/${userId}`,
        body: input,
        auth: 'sessionToken',
      })
    },

    async remove(organizationId: string | undefined, userId: string): Promise<void> {
      const id = resolveOrganizationId(config, 'users.remove()', organizationId)
      return request<void>(config, {
        method: 'DELETE',
        path: `/v1/organizations/${id}/users/${userId}`,
        auth: 'sessionToken',
      })
    },
  }
}
