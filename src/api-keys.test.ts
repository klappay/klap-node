import type { ApiKey, PaginatedApiKeys } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiKeysClient } from './api-keys'
import { MissingCredentialError } from './errors'

vi.mock('./http', async () => {
  const actual = await vi.importActual<typeof import('./http')>('./http')
  return { ...actual, request: vi.fn() }
})

const { request } = await import('./http')
const requestMock = vi.mocked(request)

const FAKE_KEY: ApiKey = {
  id: 'key_1',
  name: 'Production',
  environment: 'live',
  hint: 'klap_live_...ab12',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: null,
  createdByUserId: null,
}

beforeEach(() => {
  requestMock.mockReset()
})

describe('createApiKeysClient().create()', () => {
  it('scopes the request to the given organization and posts to /api-keys with sessionToken auth', async () => {
    requestMock.mockResolvedValue(FAKE_KEY)
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

    await createApiKeysClient(config).create('org_1', { name: 'Production', environment: 'live' })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/organizations/org_1/api-keys',
      body: { name: 'Production', environment: 'live' },
      auth: 'sessionToken',
    })
  })

  it('falls back to the configured default organizationId', async () => {
    requestMock.mockResolvedValue(FAKE_KEY)
    const config = {
      baseUrl: 'https://api.example.com',
      sessionToken: 'sess_1',
      organizationId: 'org_default',
    }

    await createApiKeysClient(config).create(undefined, { name: 'x', environment: 'test' })

    expect(requestMock.mock.calls[0]?.[1].path).toBe('/v1/organizations/org_default/api-keys')
  })

  it('throws when no organizationId is available', async () => {
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }
    await expect(
      createApiKeysClient(config).create(undefined, { name: 'x', environment: 'test' }),
    ).rejects.toThrow(MissingCredentialError)
    expect(requestMock).not.toHaveBeenCalled()
  })
})

describe('createApiKeysClient().list()', () => {
  const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

  it('defaults the query to the default pagination limit when no input is given', async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null, hasMore: false })

    await createApiKeysClient(config).list('org_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'GET',
      path: '/v1/organizations/org_1/api-keys',
      query: { limit: 20 },
      auth: 'sessionToken',
    })
  })

  it('passes through a custom query', async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null, hasMore: false })

    await createApiKeysClient(config).list('org_1', { limit: 5, cursor: 'cur_1' })

    expect(requestMock.mock.calls[0]?.[1].query).toEqual({ limit: 5, cursor: 'cur_1' })
  })
})

describe('createApiKeysClient().listAll()', () => {
  it('follows cursors until hasMore is false, yielding every key across pages', async () => {
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }
    const page1: PaginatedApiKeys = {
      data: [{ ...FAKE_KEY, id: 'key_1' }],
      nextCursor: 'cur_2',
      hasMore: true,
    }
    const page2: PaginatedApiKeys = {
      data: [{ ...FAKE_KEY, id: 'key_2' }],
      nextCursor: null,
      hasMore: false,
    }
    requestMock.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2)

    const keys: ApiKey[] = []
    for await (const key of createApiKeysClient(config).listAll('org_1')) keys.push(key)

    expect(keys.map((k) => k.id)).toEqual(['key_1', 'key_2'])
    expect(requestMock.mock.calls[1]?.[1].query).toMatchObject({ cursor: 'cur_2' })
  })

  it('stops after one page when hasMore is false even with a nextCursor', async () => {
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }
    requestMock.mockResolvedValue({
      data: [{ ...FAKE_KEY, id: 'key_1' }],
      nextCursor: 'cur_2',
      hasMore: false,
    })

    const keys: ApiKey[] = []
    for await (const key of createApiKeysClient(config).listAll('org_1')) keys.push(key)

    expect(keys).toHaveLength(1)
    expect(requestMock).toHaveBeenCalledTimes(1)
  })
})

describe('createApiKeysClient().revoke()', () => {
  it('deletes the key by id under the resolved organization', async () => {
    requestMock.mockResolvedValue(undefined)
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

    await createApiKeysClient(config).revoke('org_1', 'key_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'DELETE',
      path: '/v1/organizations/org_1/api-keys/key_1',
      auth: 'sessionToken',
    })
  })
})
