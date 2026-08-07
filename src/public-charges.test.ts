import type { PublicCharge } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPublicChargesClient, getPublicCharge } from './public-charges'

vi.mock('./http', () => ({ request: vi.fn() }))
vi.mock('./sse', () => ({ streamSSEEvents: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)
const { streamSSEEvents } = await import('./sse')
const streamMock = vi.mocked(streamSSEEvents)

const config = { baseUrl: 'https://api.example.com' }

const FAKE_PUBLIC_CHARGE: PublicCharge = {
  id: 'ch_fake',
  mode: 'standard',
  status: 'pending',
  settlementStatus: null,
  amount: 10,
  amountReceived: null,
  isOverpaid: false,
  currency: 'USD',
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  paidWith: [],
  address: '0xabc',
  environment: 'test',
  txHash: null,
  metadata: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-01T01:00:00.000Z',
  confirmedAt: null,
  settledAt: null,
  lastActivityAt: '2026-01-01T00:00:00.000Z',
  pausedAt: null,
  canceledAt: null,
}

describe('createPublicChargesClient().get()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue(FAKE_PUBLIC_CHARGE)
  })

  it('fetches the public charge endpoint with the required environment query param and no auth', async () => {
    const result = await createPublicChargesClient(config).get('ch_fake', 'live')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'GET',
      path: '/v1/public/charges/ch_fake',
      query: { environment: 'live' },
      auth: 'none',
    })
    expect(result).toEqual(FAKE_PUBLIC_CHARGE)
  })
})

describe('createPublicChargesClient().getQrCode()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue('<svg>...</svg>')
  })

  it('fetches the QR code as raw text, with no auth, sending only environment by default', async () => {
    const result = await createPublicChargesClient(config).getQrCode('ch_fake', 'live')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'GET',
      path: '/v1/public/charges/ch_fake/qrcode',
      query: { environment: 'live' },
      auth: 'none',
      responseType: 'text',
    })
    expect(result).toBe('<svg>...</svg>')
  })

  it('merges token/network into the query when given', async () => {
    await createPublicChargesClient(config).getQrCode('ch_fake', 'test', {
      token: 'USDC',
      network: 'base',
    })

    expect(requestMock.mock.calls[0]?.[1].query).toEqual({
      environment: 'test',
      token: 'USDC',
      network: 'base',
    })
  })
})

describe('createPublicChargesClient().streamEvents()', () => {
  beforeEach(() => {
    streamMock.mockReset()
  })

  it('requires no auth and puts environment on the query string', async () => {
    streamMock.mockImplementation(async function* () {
      yield { event: 'charge', data: FAKE_PUBLIC_CHARGE }
    })

    for await (const _charge of createPublicChargesClient(config).streamEvents('ch_fake', 'test')) {
      // drain
    }

    expect(streamMock.mock.calls[0]?.[1]).toBe('/v1/public/charges/ch_fake/events?environment=test')
    expect(streamMock.mock.calls[0]?.[3]).toEqual({ auth: 'none' })
  })

  it('only yields events named "charge", ignoring anything else on the stream', async () => {
    streamMock.mockImplementation(async function* () {
      yield { event: 'something-else', data: { unexpected: true } }
      yield { event: 'charge', data: FAKE_PUBLIC_CHARGE }
    })

    const charges: PublicCharge[] = []
    for await (const charge of createPublicChargesClient(config).streamEvents('ch_fake', 'live')) {
      charges.push(charge)
    }

    expect(charges).toEqual([FAKE_PUBLIC_CHARGE])
  })
})

describe('getPublicCharge()', () => {
  it('builds a one-off client from a bare baseUrl and looks up the charge', async () => {
    requestMock.mockReset()
    requestMock.mockResolvedValue(FAKE_PUBLIC_CHARGE)

    const result = await getPublicCharge('ch_fake', 'live', 'https://api.example.com')

    expect(requestMock).toHaveBeenCalledWith(
      { baseUrl: 'https://api.example.com' },
      {
        method: 'GET',
        path: '/v1/public/charges/ch_fake',
        query: { environment: 'live' },
        auth: 'none',
      },
    )
    expect(result).toEqual(FAKE_PUBLIC_CHARGE)
  })
})
