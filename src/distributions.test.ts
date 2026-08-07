import type {
  PaginatedPendingDistributions,
  PendingDistribution,
  PendingDistributionEvent,
} from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDistributionsClient } from './distributions'

vi.mock('./http', () => ({ request: vi.fn() }))
vi.mock('./sse', () => ({ streamSSEEvents: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)
const { streamSSEEvents } = await import('./sse')
const streamMock = vi.mocked(streamSSEEvents)

const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }

const FAKE_DISTRIBUTION: PendingDistribution = {
  splitAddress: '0xabc',
  network: 'base',
  token: 'USDC',
  recipients: [],
  distributorFeePercent: 0.1,
  estimatedRewardAmount: 1,
  availableSince: '2026-01-01T00:00:00.000Z',
  graceEndsAt: '2026-01-01T00:05:00.000Z',
}

beforeEach(() => {
  requestMock.mockReset()
})

describe('createDistributionsClient().list()', () => {
  it('defaults the query to the default pagination limit', async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null, hasMore: false })

    await createDistributionsClient(config).list()

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'GET',
      path: '/v1/distributions/pending',
      query: { limit: 20 },
    })
  })

  it('passes through a custom query', async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null, hasMore: false })

    await createDistributionsClient(config).list({ limit: 5, cursor: 'cur_1' })

    expect(requestMock.mock.calls[0]?.[1].query).toEqual({ limit: 5, cursor: 'cur_1' })
  })
})

describe('createDistributionsClient().listAll()', () => {
  it('follows cursors across pages, yielding every distribution', async () => {
    const page1: PaginatedPendingDistributions = {
      data: [{ ...FAKE_DISTRIBUTION, splitAddress: '0x1' }],
      nextCursor: 'cur_2',
      hasMore: true,
    }
    const page2: PaginatedPendingDistributions = {
      data: [{ ...FAKE_DISTRIBUTION, splitAddress: '0x2' }],
      nextCursor: null,
      hasMore: false,
    }
    requestMock.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2)

    const addresses: string[] = []
    for await (const distribution of createDistributionsClient(config).listAll()) {
      addresses.push(distribution.splitAddress)
    }

    expect(addresses).toEqual(['0x1', '0x2'])
    expect(requestMock.mock.calls[1]?.[1].query).toMatchObject({ cursor: 'cur_2' })
  })

  it('stops if hasMore is true but nextCursor is null — a malformed page has nothing left to follow', async () => {
    requestMock.mockResolvedValue({
      data: [{ ...FAKE_DISTRIBUTION, splitAddress: '0x1' }],
      nextCursor: null,
      hasMore: true,
    })

    const addresses: string[] = []
    for await (const distribution of createDistributionsClient(config).listAll()) {
      addresses.push(distribution.splitAddress)
    }

    expect(addresses).toEqual(['0x1'])
    expect(requestMock).toHaveBeenCalledTimes(1)
  })
})

describe('createDistributionsClient().streamPending()', () => {
  beforeEach(() => {
    streamMock.mockReset()
  })

  it('yields the data payload of each SSE event, unwrapping the event-name envelope, with no query by default', async () => {
    const available: PendingDistributionEvent = {
      type: 'distribution.available',
      distribution: FAKE_DISTRIBUTION,
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

  it('appends ?limit= for a self-contained snapshot+live connection when given', async () => {
    streamMock.mockImplementation(async function* () {})

    const iterator = createDistributionsClient(config).streamPending(
      new AbortController().signal,
      10,
    )
    await iterator.next()

    expect(streamMock.mock.calls[0]?.[1]).toBe('/v1/distributions/pending/events?limit=10')
  })
})
