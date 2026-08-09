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

  it('requests GET /v1/networks and returns the resolved capability matrix', async () => {
    const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }
    const result = await createNetworksClient(config).get()

    expect(requestMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', path: '/v1/networks' })
    expect(result).toEqual({ acceptedPayments: [] })
  })
})
