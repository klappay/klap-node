import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from './client'

describe('createClient()', () => {
  it('wires up every resource client', () => {
    const klap = createClient({ baseUrl: 'https://api.example.com' })

    expect(klap.charges).toBeDefined()
    expect(klap.webhooks).toBeDefined()
    expect(klap.metrics).toBeDefined()
    expect(klap.sandbox).toBeDefined()
    expect(klap.distributions).toBeDefined()
    expect(klap.networks).toBeDefined()
    expect(klap.setApiKey).toBeTypeOf('function')
  })
})

describe('createClient() mutators', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(
      () => new Response(JSON.stringify({ id: 'ch_1' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('setApiKey() changes the key used by every subsequent apiKey-authed call', async () => {
    const klap = createClient({ baseUrl: 'https://api.example.com', apiKey: 'klap_old' })

    await klap.charges.get('ch_1')
    const initialInit = fetchMock.mock.calls[0]?.[1] as RequestInit & {
      headers: Record<string, string>
    }
    expect(initialInit.headers.Authorization).toBe('Bearer klap_old')

    klap.setApiKey('klap_new')
    await klap.charges.get('ch_1')
    const updatedInit = fetchMock.mock.calls[1]?.[1] as RequestInit & {
      headers: Record<string, string>
    }
    expect(updatedInit.headers.Authorization).toBe('Bearer klap_new')
  })
})
