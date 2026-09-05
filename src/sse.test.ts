import type { Charge, ConfirmationProgress } from '@klappay/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MissingCredentialError } from './errors'
import {
  type SSEEvent,
  isChargeEvent,
  isConfirmationProgressEvent,
  streamChargeEvents,
  streamSSEEvents,
} from './sse'

function fakeSseResponse(body: string): Response {
  return fakeSseResponseChunks([body])
}

function fakeSseResponseChunks(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

describe('streamSSEEvents', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses multiple named events, skipping comment-only heartbeats', async () => {
    const sseBody = 'event: foo\ndata: {"a":1}\n\n: ping\n\nevent: bar\ndata: {"b":2}\n\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeSseResponse(sseBody)))

    const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }
    const events: unknown[] = []
    for await (const event of streamSSEEvents(config, '/v1/foo', new AbortController().signal)) {
      events.push(event)
    }

    expect(events).toEqual([
      { event: 'foo', data: { a: 1 } },
      { event: 'bar', data: { b: 2 } },
    ])
  })

  it('reassembles an event split across multiple network chunks', async () => {
    const fullEvent = 'event: foo\ndata: {"a":1}\n\n'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        fakeSseResponseChunks([
          fullEvent.slice(0, 12), // splits mid "data:" line
          fullEvent.slice(12),
        ]),
      ),
    )

    const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }
    const events: unknown[] = []
    for await (const event of streamSSEEvents(config, '/v1/foo', new AbortController().signal)) {
      events.push(event)
    }

    expect(events).toEqual([{ event: 'foo', data: { a: 1 } }])
  })

  it('throws MissingCredentialError when no apiKey is configured', async () => {
    const config = { baseUrl: 'https://api.example.com' }
    const iterator = streamSSEEvents(config, '/v1/foo', new AbortController().signal)

    await expect(iterator.next()).rejects.toThrow(MissingCredentialError)
  })

  it('throws a plain Error when the connection is not ok or has no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })))

    const config = { baseUrl: 'https://api.example.com', apiKey: 'k' }
    const iterator = streamSSEEvents(config, '/v1/foo', new AbortController().signal)

    await expect(iterator.next()).rejects.toThrow('SSE connection failed with status 502')
  })
})

describe('streamChargeEvents', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('yields only charge-typed events, ignoring other event names', async () => {
    const sseBody =
      'event: charge\ndata: {"id":"ch_1","status":"pending"}\n\n' +
      'event: ping\ndata: {}\n\n' +
      'event: charge\ndata: {"id":"ch_1","status":"confirmed"}\n\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeSseResponse(sseBody)))

    const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }
    const events: unknown[] = []
    for await (const charge of streamChargeEvents(
      config,
      '/v1/charges/ch_1/events',
      new AbortController().signal,
    )) {
      events.push(charge)
    }

    expect(events).toEqual([
      { id: 'ch_1', status: 'pending' },
      { id: 'ch_1', status: 'confirmed' },
    ])
  })

  it('yields a charge event regardless of whether the event or data line comes first', async () => {
    const sseBody = 'data: {"id":"ch_1","status":"pending"}\nevent: charge\n\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeSseResponse(sseBody)))

    const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }
    const events: unknown[] = []
    for await (const charge of streamChargeEvents(
      config,
      '/v1/charges/ch_1/events',
      new AbortController().signal,
    )) {
      events.push(charge)
    }

    expect(events).toEqual([{ id: 'ch_1', status: 'pending' }])
  })

  it('sends the Bearer apiKey header and the right Accept header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeSseResponse(''))
    vi.stubGlobal('fetch', fetchMock)

    const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }
    const iterator = streamChargeEvents(
      config,
      '/v1/charges/ch_1/events',
      new AbortController().signal,
    )
    await iterator.next()

    const requestInit = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }
    expect(requestInit.headers.Authorization).toBe('Bearer klap_test_key')
    expect(requestInit.headers.Accept).toBe('text/event-stream')
  })

  it('throws MissingCredentialError when no apiKey is configured', async () => {
    const config = { baseUrl: 'https://api.example.com' }
    const iterator = streamChargeEvents(
      config,
      '/v1/charges/ch_1/events',
      new AbortController().signal,
    )

    await expect(iterator.next()).rejects.toThrow(MissingCredentialError)
  })

  it('throws a plain Error when the connection is not ok or has no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    const config = { baseUrl: 'https://api.example.com', apiKey: 'k' }
    const iterator = streamChargeEvents(
      config,
      '/v1/charges/ch_1/events',
      new AbortController().signal,
    )

    await expect(iterator.next()).rejects.toThrow('SSE connection failed with status 500')
  })
})

describe('isChargeEvent / isConfirmationProgressEvent', () => {
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
  const FAKE_PROGRESS: ConfirmationProgress = {
    network: 'base',
    percent: 50,
    blocksSeen: 1,
    blocksRequired: 2,
  }

  const charge: SSEEvent<Charge | ConfirmationProgress> = { event: 'charge', data: FAKE_CHARGE }
  const progress: SSEEvent<Charge | ConfirmationProgress> = {
    event: 'confirmation_progress',
    data: FAKE_PROGRESS,
  }

  it('discriminates a charge event from a confirmation_progress event', () => {
    expect(isChargeEvent(charge)).toBe(true)
    expect(isChargeEvent(progress)).toBe(false)
    expect(isConfirmationProgressEvent(progress)).toBe(true)
    expect(isConfirmationProgressEvent(charge)).toBe(false)
  })
})
