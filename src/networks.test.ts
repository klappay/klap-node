import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNetworksClient } from './networks'

vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>()
  return { ...actual, request: vi.fn() }
})

const { request } = await import('./http')
const requestMock = vi.mocked(request)

describe('createNetworksClient().get()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue({ acceptedPayments: [] })
  })

  it('requests GET /v1/networks and returns the resolved capability matrix', async () => {
    const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }
    const result = await createNetworksClient(config).get()

    expect(requestMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', path: '/v1/networks' })
    expect(result).toEqual({ acceptedPayments: [] })
  })
})

describe('createNetworksClient() env fallback', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to KLAP_NETWORKS_API_KEY when apiKey is omitted', async () => {
    vi.stubEnv('KLAP_NETWORKS_API_KEY', 'klap_env_key')
    requestMock.mockResolvedValue({ acceptedPayments: [] })

    await createNetworksClient({ baseUrl: 'https://api.example.com' }).get()

    expect(requestMock.mock.calls[0]?.[0]).toMatchObject({ apiKey: 'klap_env_key' })
  })

  it('prefers an explicit apiKey over KLAP_NETWORKS_API_KEY', async () => {
    vi.stubEnv('KLAP_NETWORKS_API_KEY', 'klap_env_key')
    requestMock.mockResolvedValue({ acceptedPayments: [] })

    await createNetworksClient({
      baseUrl: 'https://api.example.com',
      apiKey: 'klap_explicit',
    }).get()

    expect(requestMock.mock.calls[0]?.[0]).toMatchObject({ apiKey: 'klap_explicit' })
  })
})
