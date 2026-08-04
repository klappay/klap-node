import { afterEach, describe, expect, it, vi } from 'vitest'
import { MissingCredentialError } from './errors'
import { streamSSEEvents } from './sse'

function fakeSseResponse(body: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body))
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

  it('throws MissingCredentialError when apiKey auth is required but missing', async () => {
    const config = { baseUrl: 'https://api.example.com' }
    const iterator = streamSSEEvents(config, '/v1/foo', new AbortController().signal)

    await expect(iterator.next()).rejects.toThrow(MissingCredentialError)
  })

  it('sends no Authorization header when auth is explicitly none, even with no apiKey configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeSseResponse(''))
    vi.stubGlobal('fetch', fetchMock)

    const config = { baseUrl: 'https://api.example.com' }
    const iterator = streamSSEEvents(config, '/v1/foo', new AbortController().signal, {
      auth: 'none',
    })
    await iterator.next()

    const requestInit = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }
    expect(requestInit.headers.Authorization).toBeUndefined()
  })
})
