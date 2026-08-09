import type { Charge } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSandboxClient } from './sandbox'

vi.mock('./http', () => ({ request: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)

const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }

const FAKE_CHARGE: Charge = {
  id: 'ch_1',
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
}

beforeEach(() => {
  requestMock.mockReset()
  requestMock.mockResolvedValue(FAKE_CHARGE)
})

describe('createSandboxClient().trigger()', () => {
  it('posts the event (and optional amount) to the charge trigger endpoint with apiKey auth', async () => {
    const result = await createSandboxClient(config).trigger('ch_1', 'charge.partially_paid', 5)

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/sandbox/charges/ch_1/trigger',
      body: { event: 'charge.partially_paid', amount: 5 },
    })
    expect(result).toEqual(FAKE_CHARGE)
  })
})

describe('createSandboxClient() convenience methods', () => {
  it.each([
    ['confirm', 'charge.confirmed'],
    ['expire', 'charge.expired'],
    ['underpay', 'charge.underpaid'],
    ['settle', 'charge.settled'],
    ['failSettlement', 'charge.settlement_failed'],
  ] as const)('%s() triggers %s with no amount', async (method, event) => {
    // biome-ignore lint/suspicious/noExplicitAny: exercising every convenience method generically
    const result = await (createSandboxClient(config)[method] as any)('ch_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/sandbox/charges/ch_1/trigger',
      body: { event, amount: undefined },
    })
    expect(result).toEqual(FAKE_CHARGE)
  })

  it('partiallyPay() forwards the optional amount', async () => {
    const result = await createSandboxClient(config).partiallyPay('ch_1', 3.5)

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/sandbox/charges/ch_1/trigger',
      body: { event: 'charge.partially_paid', amount: 3.5 },
    })
    expect(result).toEqual(FAKE_CHARGE)
  })

  it('overpay() forwards the optional amount', async () => {
    const result = await createSandboxClient(config).overpay('ch_1', 99)

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/sandbox/charges/ch_1/trigger',
      body: { event: 'charge.overpaid', amount: 99 },
    })
    expect(result).toEqual(FAKE_CHARGE)
  })
})
