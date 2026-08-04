import type { Organization, OrganizationWithRole, PaginatedOrganizations } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MissingCredentialError } from './errors'
import { createOrganizationClient } from './organization'

vi.mock('./http', async () => {
  const actual = await vi.importActual<typeof import('./http')>('./http')
  return { ...actual, request: vi.fn() }
})

const { request } = await import('./http')
const requestMock = vi.mocked(request)

const FAKE_ORG_WITH_ROLE: OrganizationWithRole = {
  id: 'org_1',
  name: 'Acme',
  payoutAddress: '0x0000000000000000000000000000000000000000',
  currentFeePercent: 1.5,
  feeUpdatedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  role: 'owner',
}

describe('createOrganizationClient().list()', () => {
  const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

  beforeEach(() => {
    requestMock.mockReset()
  })

  it('defaults the query to the default pagination limit, with sessionToken auth', async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null, hasMore: false })

    await createOrganizationClient(config).list()

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'GET',
      path: '/v1/organizations',
      query: { limit: 20 },
      auth: 'sessionToken',
    })
  })
})

describe('createOrganizationClient().listAll()', () => {
  it('follows cursors across pages until hasMore is false', async () => {
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }
    const page1: PaginatedOrganizations = {
      data: [{ ...FAKE_ORG_WITH_ROLE, id: 'org_1' }],
      nextCursor: 'cur_2',
      hasMore: true,
    }
    const page2: PaginatedOrganizations = {
      data: [{ ...FAKE_ORG_WITH_ROLE, id: 'org_2' }],
      nextCursor: null,
      hasMore: false,
    }
    requestMock.mockReset()
    requestMock.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2)

    const orgs: OrganizationWithRole[] = []
    for await (const org of createOrganizationClient(config).listAll()) orgs.push(org)

    expect(orgs.map((o) => o.id)).toEqual(['org_1', 'org_2'])
    expect(requestMock.mock.calls[1]?.[1].query).toMatchObject({ cursor: 'cur_2' })
  })
})

describe('createOrganizationClient().update()', () => {
  const FAKE_ORG: Organization = {
    id: 'org_1',
    name: 'New Name',
    payoutAddress: null,
    currentFeePercent: 1.5,
    feeUpdatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue(FAKE_ORG)
  })

  it('patches the resolved organization with sessionToken auth', async () => {
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

    await createOrganizationClient(config).update('org_1', { name: 'New Name' })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'PATCH',
      path: '/v1/organizations/org_1',
      body: { name: 'New Name' },
      auth: 'sessionToken',
    })
  })

  it('falls back to the configured default organizationId', async () => {
    const config = {
      baseUrl: 'https://api.example.com',
      sessionToken: 'sess_1',
      organizationId: 'org_default',
    }

    await createOrganizationClient(config).update(undefined, { name: 'New Name' })

    expect(requestMock.mock.calls[0]?.[1].path).toBe('/v1/organizations/org_default')
  })

  it('throws when no organizationId is available', async () => {
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }
    await expect(createOrganizationClient(config).update(undefined, { name: 'x' })).rejects.toThrow(
      MissingCredentialError,
    )
  })
})

describe('createOrganizationClient().get()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue({ id: 'org_1' })
  })

  it('uses the explicit organizationId when one is passed', async () => {
    const config = { baseUrl: 'https://api.example.com', organizationId: 'org_default' }
    await createOrganizationClient(config).get('org_explicit')

    expect(requestMock.mock.calls[0]?.[1].path).toBe('/v1/organizations/org_explicit')
  })

  it('falls back to the configured default organizationId', async () => {
    const config = { baseUrl: 'https://api.example.com', organizationId: 'org_default' }
    await createOrganizationClient(config).get()

    expect(requestMock.mock.calls[0]?.[1].path).toBe('/v1/organizations/org_default')
  })

  it('throws when neither an explicit id nor a default is configured', async () => {
    const config = { baseUrl: 'https://api.example.com' }
    await expect(createOrganizationClient(config).get()).rejects.toThrow(MissingCredentialError)
  })
})
