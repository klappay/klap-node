import type { PendingDistributionEvent } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDistributionsClient } from './distributions'

vi.mock('./http', () => ({ request: vi.fn() }))
vi.mock('./sse', () => ({ streamSSEEvents: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)
const { streamSSEEvents } = await import('./sse')
const streamMock = vi.mocked(streamSSEEvents)

const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }

describe('createDistributionsClient().list()', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue([])
  })

  it('requests GET /v1/distributions/pending', async () => {
    await createDistributionsClient(config).list()

    expect(requestMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      path: '/v1/distributions/pending',
    })
  })
})

describe('createDistributionsClient().streamPending()', () => {
  beforeEach(() => {
    streamMock.mockReset()
  })

  it('yields the data payload of each SSE event, unwrapping the event-name envelope', async () => {
    const available: PendingDistributionEvent = {
      type: 'distribution.available',
      distribution: {
        splitAddress: '0xabc',
        network: 'base',
        token: 'USDC',
        recipients: [],
        distributorFeePercent: 0.1,
        estimatedRewardAmount: 1,
        availableSince: '2026-01-01T00:00:00.000Z',
        graceEndsAt: '2026-01-01T00:05:00.000Z',
      },
    }
    streamMock.mockImplementation(async function* () {
      yield { event: 'distribution.available', data: available }
    })

    const events: PendingDistributionEvent[] = []
    for await (const event of createDistributionsClient(config).streamPending()) {
      events.push(event)
    }

    expect(events).toEqual([available])
    expect(streamMock.mock.calls[0]?.[1]).toBe('/v1/distributions/pending/events')
  })
})
