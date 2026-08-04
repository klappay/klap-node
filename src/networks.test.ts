import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNetworksClient } from './networks'

vi.mock('./http', () => ({ request: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)

describe('createNetworksClient().get()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue({ acceptedPayments: [] })
  })

  it('requests GET /v1/networks', async () => {
    const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }
    await createNetworksClient(config).get()

    expect(requestMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', path: '/v1/networks' })
  })
})
