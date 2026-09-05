import type { Charge, SwapQuote, TimelineEvent } from '@klappay/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChargesClient } from './charges'

vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>()
  return { ...actual, request: vi.fn() }
})
vi.mock('./sse', () => ({ streamChargeEvents: vi.fn(), streamSSEEvents: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)
const { streamChargeEvents, streamSSEEvents } = await import('./sse')
const streamMock = vi.mocked(streamChargeEvents)
const streamEventsMock = vi.mocked(streamSSEEvents)

const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }

const FAKE_CHARGE: Charge = {
  id: 'ch_fake',
  amount: 10,
  amountReceived: null,
  isOverpaid: false,
  feePayer: 'merchant',
  feePercent: 1,
  feeAmount: 0.1,
  merchantAmount: 9.9,
  currency: 'USD',
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  paidWith: [],
  swapAlternatives: [],
  address: '0xabc',
  status: 'pending',
  settlementStatus: null,
  environment: 'test',
  apiKeyId: null,
  txHash: null,
  externalRef: null,
  source: null,
  metadata: null,
  redirectUrl: null,
  checkoutUrl: null,
  splitRecipients: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-01T01:00:00.000Z',
  confirmedAt: null,
  settledAt: null,
  lastActivityAt: '2026-01-01T00:00:00.000Z',
  escrow: null,
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
      expiresIn: 3600,
    })

    const body = requestMock.mock.calls[0]?.[1].body as { idempotencyKey: string }
    expect(body.idempotencyKey).toMatch(/^sdk_\d+_[0-9a-f]{16}$/)
  })

  it('generates a different key on every call', async () => {
    await createChargesClient(config).create({
      amount: 10,
      acceptedPayments: [{ token: 'USDC', network: 'base' }],
      currency: 'USD',
      expiresIn: 3600,
    })
    await createChargesClient(config).create({
      amount: 10,
      acceptedPayments: [{ token: 'USDC', network: 'base' }],
      currency: 'USD',
      expiresIn: 3600,
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
      expiresIn: 3600,
      idempotencyKey: 'my-own-key',
    })

    const body = requestMock.mock.calls[0]?.[1].body as { idempotencyKey: string }
    expect(body.idempotencyKey).toBe('my-own-key')
  })
})

describe('createChargesClient().create() splitRecipients', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue(FAKE_CHARGE)
  })

  it('sends split entries keyed by recipientId, not a raw address', async () => {
    await createChargesClient(config).create({
      amount: 10,
      acceptedPayments: [{ token: 'USDC', network: 'base' }],
      expiresIn: 3600,
      splitRecipients: [{ recipientId: 'rc_1', percent: 10, label: 'sales rep' }],
    })

    const body = requestMock.mock.calls[0]?.[1].body as {
      splitRecipients: { recipientId: string }[]
    }
    expect(body.splitRecipients).toEqual([{ recipientId: 'rc_1', percent: 10, label: 'sales rep' }])
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

  it('stops after one page when hasMore is false, even if nextCursor is non-null', async () => {
    requestMock.mockResolvedValueOnce({
      data: [{ ...FAKE_CHARGE, id: 'ch_1' }],
      nextCursor: 'cur_2',
      hasMore: false,
    })

    const ids: string[] = []
    for await (const charge of createChargesClient(config).listAll()) {
      ids.push(charge.id)
    }

    expect(ids).toEqual(['ch_1'])
    expect(requestMock).toHaveBeenCalledTimes(1)
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

describe('createChargesClient().getQuote()', () => {
  const FAKE_QUOTE: SwapQuote = {
    inputToken: 'ETH',
    inputNetwork: 'base',
    inputAmount: 0.005,
    outputToken: 'USDC',
    outputNetwork: 'base',
    outputAmount: 10,
    fees: { klappayFee: 0.1, zeroExFee: null },
    expiresAt: '2026-01-01T00:00:30.000Z',
    transaction: { to: '0xdef', data: '0x', value: '0' },
  }

  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue(FAKE_QUOTE)
  })

  it('posts inputToken/inputNetwork/takerAddress to the quote endpoint', async () => {
    const result = await createChargesClient(config).getQuote('ch_fake', {
      inputToken: 'ETH',
      inputNetwork: 'base',
      takerAddress: '0x1111111111111111111111111111111111111111',
    })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/charges/ch_fake/quote',
      body: {
        inputToken: 'ETH',
        inputNetwork: 'base',
        takerAddress: '0x1111111111111111111111111111111111111111',
      },
    })
    expect(result).toEqual(FAKE_QUOTE)
  })
})

describe('createChargesClient().check()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue(FAKE_CHARGE)
  })

  it('posts to the check endpoint with no body when called with no txHash/network', async () => {
    const result = await createChargesClient(config).check('ch_fake')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/charges/ch_fake/check',
      body: undefined,
    })
    expect(result).toMatchObject(FAKE_CHARGE)
    expect(result.refresh).toBeInstanceOf(Function)
  })

  it('posts txHash/network through when checking a specific transaction', async () => {
    await createChargesClient(config).check('ch_fake', {
      txHash: `0x${'1'.repeat(64)}`,
      network: 'base',
    })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/charges/ch_fake/check',
      body: { txHash: `0x${'1'.repeat(64)}`, network: 'base' },
    })
  })

  it('surfaces transactionSender from the response', async () => {
    requestMock.mockResolvedValue({ ...FAKE_CHARGE, transactionSender: '0xsender' })

    const result = await createChargesClient(config).check('ch_fake', {
      txHash: `0x${'1'.repeat(64)}`,
      network: 'base',
    })

    expect(result.transactionSender).toBe('0xsender')
  })
})

describe('createChargesClient().release()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue(FAKE_CHARGE)
  })

  it('posts the signature to the release endpoint and wraps the result', async () => {
    const signature = `0x${'1'.repeat(130)}`
    const result = await createChargesClient(config).release('ch_fake', { signature })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/charges/ch_fake/release',
      body: { signature },
    })
    expect(result).toMatchObject(FAKE_CHARGE)
    expect(result.refresh).toBeInstanceOf(Function)
  })
})

describe('createChargesClient().refund()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue(FAKE_CHARGE)
  })

  it('posts the signature to the refund endpoint and wraps the result', async () => {
    const signature = `0x${'1'.repeat(130)}`
    const result = await createChargesClient(config).refund('ch_fake', { signature })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/charges/ch_fake/refund',
      body: { signature },
    })
    expect(result).toMatchObject(FAKE_CHARGE)
    expect(result.refresh).toBeInstanceOf(Function)
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

describe('createChargesClient().watchEvents()', () => {
  beforeEach(() => {
    streamEventsMock.mockReset()
  })

  it('opens the raw event stream, unfiltered, for the given charge id', () => {
    streamEventsMock.mockReturnValue((async function* () {})())

    createChargesClient(config).watchEvents('ch_fake')

    expect(streamEventsMock).toHaveBeenCalledWith(
      config,
      '/v1/charges/ch_fake/events',
      expect.any(AbortSignal),
    )
  })
})

describe('createChargesClient() env fallback', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to KLAP_CHARGES_API_KEY when apiKey is omitted', async () => {
    vi.stubEnv('KLAP_CHARGES_API_KEY', 'klap_env_key')
    requestMock.mockResolvedValue(FAKE_CHARGE)

    await createChargesClient({ baseUrl: 'https://api.example.com' }).get('ch_fake')

    expect(requestMock.mock.calls[0]?.[0]).toMatchObject({ apiKey: 'klap_env_key' })
  })

  it('prefers an explicit apiKey over KLAP_CHARGES_API_KEY', async () => {
    vi.stubEnv('KLAP_CHARGES_API_KEY', 'klap_env_key')
    requestMock.mockResolvedValue(FAKE_CHARGE)

    await createChargesClient({
      baseUrl: 'https://api.example.com',
      apiKey: 'klap_explicit',
    }).get('ch_fake')

    expect(requestMock.mock.calls[0]?.[0]).toMatchObject({ apiKey: 'klap_explicit' })
  })
})
