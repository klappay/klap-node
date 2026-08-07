import type { Charge, TimelineEvent } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChargesClient } from './charges'

vi.mock('./http', () => ({ request: vi.fn() }))
vi.mock('./sse', () => ({ streamChargeEvents: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)
const { streamChargeEvents } = await import('./sse')
const streamMock = vi.mocked(streamChargeEvents)

const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }

const FAKE_CHARGE: Charge = {
  id: 'ch_fake',
  mode: 'standard',
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
  apiKeyId: null,
  txHash: null,
  externalRef: null,
  source: null,
  metadata: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-01T01:00:00.000Z',
  confirmedAt: null,
  settledAt: null,
  lastActivityAt: '2026-01-01T00:00:00.000Z',
  pausedAt: null,
  canceledAt: null,
}

describe('createChargesClient().create()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue(FAKE_CHARGE)
  })

  it('generates an idempotency key matching the sdk_<timestamp>_<hex> format when none is supplied', async () => {
    await createChargesClient(config).create({
      amount: 10,
      acceptedPayments: [{ token: 'USDC', network: 'base' }],
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

describe('createChargesClient().list()', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('defaults the query to the default pagination limit', async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null, hasMore: false })

    await createChargesClient(config).list()

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'GET',
      path: '/v1/charges',
      query: { limit: 20 },
    })
  })

  it('passes through a custom filter/query', async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null, hasMore: false })

    await createChargesClient(config).list({ limit: 5, status: 'confirmed' })

    expect(requestMock.mock.calls[0]?.[1].query).toEqual({ limit: 5, status: 'confirmed' })
  })
})

describe('createChargesClient().listAll()', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('follows cursors across pages, yielding a KlapCharge for every item', async () => {
    requestMock
      .mockResolvedValueOnce({
        data: [{ ...FAKE_CHARGE, id: 'ch_1' }],
        nextCursor: 'cur_2',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        data: [{ ...FAKE_CHARGE, id: 'ch_2' }],
        nextCursor: null,
        hasMore: false,
      })

    const ids: string[] = []
    for await (const charge of createChargesClient(config).listAll()) {
      ids.push(charge.id)
      expect(charge.waitForConfirmation).toBeTypeOf('function')
    }

    expect(ids).toEqual(['ch_1', 'ch_2'])
    expect(requestMock.mock.calls[1]?.[1].query).toMatchObject({ cursor: 'cur_2' })
  })

  it('merges an explicit filter into every page request', async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null, hasMore: false })

    const gen = createChargesClient(config).listAll({ status: 'confirmed' })
    await gen.next()

    expect(requestMock.mock.calls[0]?.[1].query).toMatchObject({
      status: 'confirmed',
      limit: 100,
    })
  })
})

describe('createChargesClient().getTimeline()', () => {
  it('fetches the timeline for the given charge id', async () => {
    const events: TimelineEvent[] = [{ type: 'charge.created', at: '2026-01-01T00:00:00.000Z' }]
    requestMock.mockReset()
    requestMock.mockResolvedValue(events)

    const result = await createChargesClient(config).getTimeline('ch_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'GET',
      path: '/v1/charges/ch_1/timeline',
    })
    expect(result).toEqual(events)
  })
})

describe('createChargesClient().cancel()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue({
      ...FAKE_CHARGE,
      status: 'canceled',
      canceledAt: '2026-01-01T02:00:00.000Z',
    })
  })

  it('posts to the cancel endpoint and returns a wrapped KlapCharge', async () => {
    const result = await createChargesClient(config).cancel('ch_fake')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/charges/ch_fake/cancel',
    })
    expect(result.status).toBe('canceled')
    expect(result.waitForConfirmation).toBeTypeOf('function')
  })
})

describe('createChargesClient().getQrCode()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue('<svg>...</svg>')
  })

  it('fetches the QR code as raw text, omitting the query entirely when none is given', async () => {
    const result = await createChargesClient(config).getQrCode('ch_fake')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'GET',
      path: '/v1/charges/ch_fake/qrcode',
      query: undefined,
      responseType: 'text',
    })
    expect(result).toBe('<svg>...</svg>')
  })

  it('passes token/network when the charge accepts more than one pair', async () => {
    await createChargesClient(config).getQrCode('ch_fake', { token: 'USDC', network: 'base' })

    expect(requestMock.mock.calls[0]?.[1].query).toEqual({ token: 'USDC', network: 'base' })
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
