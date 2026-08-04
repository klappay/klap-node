import type { ChargeStatusEvent, VerifyCharge } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVerifyClient, verifyCharge } from './verify'

vi.mock('./sse', () => ({ streamSSEEvents: vi.fn() }))
vi.mock('./http', () => ({ request: vi.fn() }))

const { streamSSEEvents } = await import('./sse')
const streamMock = vi.mocked(streamSSEEvents)
const { request } = await import('./http')
const requestMock = vi.mocked(request)

const config = { baseUrl: 'https://api.example.com' }

const FAKE_EVENT: ChargeStatusEvent = {
  id: 'ch_fake',
  status: 'pending',
  settlementStatus: null,
  amount: 10,
  amountReceived: null,
  paidWith: [],
}

const FAKE_VERIFY_CHARGE: VerifyCharge = {
  id: 'ch_fake',
  amount: 10,
  amountReceived: 0,
  confirmedAt: null,
  splitAddress: '0xabc',
  payments: [],
}

describe('createVerifyClient().get()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue(FAKE_VERIFY_CHARGE)
  })

  it('fetches the public verify endpoint with no auth', async () => {
    const result = await createVerifyClient(config).get('ch_fake')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'GET',
      path: '/v1/verify/ch_fake',
      auth: 'none',
    })
    expect(result).toEqual(FAKE_VERIFY_CHARGE)
  })
})

describe('verifyCharge()', () => {
  it('builds a one-off verify client from a bare baseUrl and looks up the charge', async () => {
    requestMock.mockReset()
    requestMock.mockResolvedValue(FAKE_VERIFY_CHARGE)

    const result = await verifyCharge('ch_fake', 'https://api.example.com')

    expect(requestMock).toHaveBeenCalledWith(
      { baseUrl: 'https://api.example.com' },
      { method: 'GET', path: '/v1/verify/ch_fake', auth: 'none' },
    )
    expect(result).toEqual(FAKE_VERIFY_CHARGE)
  })
})

describe('createVerifyClient().streamEvents()', () => {
  beforeEach(() => {
    streamMock.mockReset()
  })

  it('requires no auth, matching get()', async () => {
    streamMock.mockImplementation(async function* () {
      yield { event: 'charge', data: FAKE_EVENT }
    })

    for await (const _event of createVerifyClient(config).streamEvents('ch_fake')) {
      // drain
    }

    expect(streamMock.mock.calls[0]?.[3]).toEqual({ auth: 'none' })
    expect(streamMock.mock.calls[0]?.[1]).toBe('/v1/verify/ch_fake/events')
  })

  it('only yields events named "charge", ignoring anything else on the stream', async () => {
    streamMock.mockImplementation(async function* () {
      yield { event: 'something-else', data: { unexpected: true } }
      yield { event: 'charge', data: FAKE_EVENT }
    })

    const events: ChargeStatusEvent[] = []
    for await (const event of createVerifyClient(config).streamEvents('ch_fake')) {
      events.push(event)
    }

    expect(events).toEqual([FAKE_EVENT])
  })
})
