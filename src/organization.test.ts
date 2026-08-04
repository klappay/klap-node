import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MissingCredentialError } from './errors'
import { createOrganizationClient } from './organization'

vi.mock('./http', async () => {
  const actual = await vi.importActual<typeof import('./http')>('./http')
  return { ...actual, request: vi.fn() }
})

const { request } = await import('./http')
const requestMock = vi.mocked(request)

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
