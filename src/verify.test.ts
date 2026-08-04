import type { ChargeStatusEvent } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVerifyClient } from './verify'

vi.mock('./sse', () => ({ streamSSEEvents: vi.fn() }))

const { streamSSEEvents } = await import('./sse')
const streamMock = vi.mocked(streamSSEEvents)

const config = { baseUrl: 'https://api.example.com' }

const FAKE_EVENT: ChargeStatusEvent = {
  id: 'ch_fake',
  status: 'pending',
  settlementStatus: null,
  amount: 10,
  amountReceived: null,
  paidWith: [],
}

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
