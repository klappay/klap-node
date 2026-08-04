import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChargesClient } from './charges'

vi.mock('./http', () => ({ request: vi.fn() }))
vi.mock('./sse', () => ({ streamChargeEvents: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)
const { streamChargeEvents } = await import('./sse')
const streamMock = vi.mocked(streamChargeEvents)

const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }

describe('createChargesClient().create()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue({
      id: 'ch_fake',
      amount: 10,
      amountReceived: null,
      isOverpaid: false,
      currency: 'USD',
      acceptedPayments: [{ token: 'USDC', network: 'base' }],
      paidWith: [],
      address: '0xabc',
      status: 'pending',
      settlementStatus: null,
      environment: 'test',
      txHash: null,
      externalRef: null,
      source: null,
      metadata: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T01:00:00.000Z',
      confirmedAt: null,
    })
  })

  it('generates an idempotency key matching the sdk_<timestamp>_<hex> format when none is supplied', async () => {
    await createChargesClient(config).create({
      amount: 10,
      acceptedPayments: [{ token: 'USDC', network: 'base' }],
      currency: 'USD',
    })

    const body = requestMock.mock.calls[0]?.[1].body as { idempotencyKey: string }
    expect(body.idempotencyKey).toMatch(/^sdk_\d+_[0-9a-f]{16}$/)
  })

  it('generates a different key on every call', async () => {
    await createChargesClient(config).create({
      amount: 10,
      acceptedPayments: [{ token: 'USDC', network: 'base' }],
      currency: 'USD',
    })
    await createChargesClient(config).create({
      amount: 10,
      acceptedPayments: [{ token: 'USDC', network: 'base' }],
      currency: 'USD',
    })

    const firstKey = (requestMock.mock.calls[0]?.[1].body as { idempotencyKey: string })
      .idempotencyKey
    const secondKey = (requestMock.mock.calls[1]?.[1].body as { idempotencyKey: string })
      .idempotencyKey
    expect(firstKey).not.toBe(secondKey)
  })

  it('passes through a caller-supplied idempotency key unchanged', async () => {
    await createChargesClient(config).create({
      amount: 10,
      acceptedPayments: [{ token: 'USDC', network: 'base' }],
      currency: 'USD',
      idempotencyKey: 'my-own-key',
    })

    const body = requestMock.mock.calls[0]?.[1].body as { idempotencyKey: string }
    expect(body.idempotencyKey).toBe('my-own-key')
  })
})

describe('createChargesClient().watch()', () => {
  beforeEach(() => {
    streamMock.mockReset()
  })

  it('opens the raw event stream for the given charge id', () => {
    streamMock.mockReturnValue((async function* () {})())

    createChargesClient(config).watch('ch_fake')

    expect(streamMock).toHaveBeenCalledWith(
      config,
      '/v1/charges/ch_fake/events',
      expect.any(AbortSignal),
    )
  })
})
