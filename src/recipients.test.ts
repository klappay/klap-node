import type { Recipient } from '@klappay/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRecipientsClient } from './recipients'

vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>()
  return { ...actual, request: vi.fn() }
})

const { request } = await import('./http')
const requestMock = vi.mocked(request)

const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }

const FAKE_RECIPIENT: Recipient = {
  id: 'rc_1',
  environment: 'live',
  address: '0x000000000000000000000000000000000000ab',
  label: 'supplier',
  payout: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('createRecipientsClient()', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('create() posts the address/label to register a recipient', async () => {
    requestMock.mockResolvedValue(FAKE_RECIPIENT)

    const result = await createRecipientsClient(config).create({
      address: '0x000000000000000000000000000000000000ab',
      label: 'supplier',
    })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/recipients',
      body: { address: '0x000000000000000000000000000000000000ab', label: 'supplier' },
    })
    expect(result).toEqual(FAKE_RECIPIENT)
  })

  it('list() fetches every non-revoked recipient with no query params', async () => {
    requestMock.mockResolvedValue([FAKE_RECIPIENT])

    const result = await createRecipientsClient(config).list()

    expect(requestMock).toHaveBeenCalledWith(config, { method: 'GET', path: '/v1/recipients' })
    expect(result).toEqual([FAKE_RECIPIENT])
  })

  it('setPayout() PATCHes only the payout flag for the given id', async () => {
    requestMock.mockResolvedValue({ ...FAKE_RECIPIENT, payout: true })

    const result = await createRecipientsClient(config).setPayout('rc_1', true)

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'PATCH',
      path: '/v1/recipients/rc_1',
      body: { payout: true },
    })
    expect(result.payout).toBe(true)
  })

  it('revoke() deletes a recipient by id', async () => {
    requestMock.mockResolvedValue(undefined)

    await createRecipientsClient(config).revoke('rc_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'DELETE',
      path: '/v1/recipients/rc_1',
    })
  })

  it('encodes an id containing special characters in the path for setPayout() and revoke()', async () => {
    requestMock.mockResolvedValue(FAKE_RECIPIENT)

    await createRecipientsClient(config).setPayout('rc/1 x', true)
    await createRecipientsClient(config).revoke('rc/1 x')

    expect(requestMock.mock.calls[0]?.[1].path).toBe('/v1/recipients/rc%2F1%20x')
    expect(requestMock.mock.calls[1]?.[1].path).toBe('/v1/recipients/rc%2F1%20x')
  })
})

describe('createRecipientsClient() env fallback', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to KLAP_RECIPIENTS_API_KEY when apiKey is omitted', async () => {
    vi.stubEnv('KLAP_RECIPIENTS_API_KEY', 'klap_env_key')
    requestMock.mockResolvedValue([])

    await createRecipientsClient({ baseUrl: 'https://api.example.com' }).list()

    expect(requestMock.mock.calls[0]?.[0]).toMatchObject({ apiKey: 'klap_env_key' })
  })

  it('prefers an explicit apiKey over KLAP_RECIPIENTS_API_KEY', async () => {
    vi.stubEnv('KLAP_RECIPIENTS_API_KEY', 'klap_env_key')
    requestMock.mockResolvedValue([])

    await createRecipientsClient({
      baseUrl: 'https://api.example.com',
      apiKey: 'klap_explicit',
    }).list()

    expect(requestMock.mock.calls[0]?.[0]).toMatchObject({ apiKey: 'klap_explicit' })
  })
})
