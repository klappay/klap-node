import type { PaginatedUsers, User } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MissingCredentialError } from './errors'
import { createUsersClient } from './users'

vi.mock('./http', async () => {
  const actual = await vi.importActual<typeof import('./http')>('./http')
  return { ...actual, request: vi.fn() }
})

const { request } = await import('./http')
const requestMock = vi.mocked(request)

const FAKE_USER: User = {
  id: 'usr_1',
  email: 'a@example.com',
  name: 'Ada',
  role: 'member',
  emailVerifiedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  requestMock.mockReset()
})

describe('createUsersClient().list()', () => {
  it('resolves the organization and defaults the query to the default pagination limit', async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null, hasMore: false })
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

    await createUsersClient(config).list('org_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'GET',
      path: '/v1/organizations/org_1/users',
      query: { limit: 20 },
      auth: 'sessionToken',
    })
  })

  it('falls back to the configured default organizationId', async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null, hasMore: false })
    const config = {
      baseUrl: 'https://api.example.com',
      sessionToken: 'sess_1',
      organizationId: 'org_default',
    }

    await createUsersClient(config).list()

    expect(requestMock.mock.calls[0]?.[1].path).toBe('/v1/organizations/org_default/users')
  })

  it('throws when no organizationId is available', () => {
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }
    expect(() => createUsersClient(config).list()).toThrow(MissingCredentialError)
  })
})

describe('createUsersClient().listAll()', () => {
  it('follows cursors across pages until hasMore is false', async () => {
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }
    const page1: PaginatedUsers = {
      data: [{ ...FAKE_USER, id: 'usr_1' }],
      nextCursor: 'cur_2',
      hasMore: true,
    }
    const page2: PaginatedUsers = {
      data: [{ ...FAKE_USER, id: 'usr_2' }],
      nextCursor: null,
      hasMore: false,
    }
    requestMock.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2)

    const users: User[] = []
    for await (const user of createUsersClient(config).listAll('org_1')) users.push(user)

    expect(users.map((u) => u.id)).toEqual(['usr_1', 'usr_2'])
  })
})

describe('createUsersClient().updateRole()', () => {
  it('patches the user role under the resolved organization', async () => {
    requestMock.mockResolvedValue(FAKE_USER)
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

    await createUsersClient(config).updateRole('org_1', 'usr_1', { role: 'admin' })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'PATCH',
      path: '/v1/organizations/org_1/users/usr_1',
      body: { role: 'admin' },
      auth: 'sessionToken',
    })
  })
})

describe('createUsersClient().remove()', () => {
  it('deletes the user under the resolved organization', async () => {
    requestMock.mockResolvedValue(undefined)
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

    await createUsersClient(config).remove('org_1', 'usr_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'DELETE',
      path: '/v1/organizations/org_1/users/usr_1',
      auth: 'sessionToken',
    })
  })

  it('throws when no organizationId is available', async () => {
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }
    await expect(createUsersClient(config).remove(undefined, 'usr_1')).rejects.toThrow(
      MissingCredentialError,
    )
  })
})
