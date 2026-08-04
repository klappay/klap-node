import type { Charge } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSandboxClient } from './sandbox'

vi.mock('./http', () => ({ request: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)

const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }

const FAKE_CHARGE = { id: 'ch_1' } as Charge

beforeEach(() => {
  requestMock.mockReset()
  requestMock.mockResolvedValue(FAKE_CHARGE)
})

describe('createSandboxClient().trigger()', () => {
  it('posts the event (and optional amount) to the charge trigger endpoint with apiKey auth', async () => {
    await createSandboxClient(config).trigger('ch_1', 'charge.partially_paid', 5)

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/sandbox/charges/ch_1/trigger',
      body: { event: 'charge.partially_paid', amount: 5 },
    })
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
    await (createSandboxClient(config)[method] as any)('ch_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/sandbox/charges/ch_1/trigger',
      body: { event, amount: undefined },
    })
  })

  it('partiallyPay() forwards the optional amount', async () => {
    await createSandboxClient(config).partiallyPay('ch_1', 3.5)

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/sandbox/charges/ch_1/trigger',
      body: { event: 'charge.partially_paid', amount: 3.5 },
    })
  })

  it('overpay() forwards the optional amount', async () => {
    await createSandboxClient(config).overpay('ch_1', 99)

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/sandbox/charges/ch_1/trigger',
      body: { event: 'charge.overpaid', amount: 99 },
    })
  })
})

describe('createSandboxClient().triggerEvent()', () => {
  it('posts the non-charge event to the events trigger endpoint', async () => {
    requestMock.mockResolvedValue(undefined)
    await createSandboxClient(config).triggerEvent('member.invited')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/sandbox/events/trigger',
      body: { event: 'member.invited' },
    })
  })
})
