import type { Charge } from '@klappay/types'
import { MissingCredentialError } from './errors'
import type { HttpConfig } from './http'

const CHARGE_EVENT_MARKER = 'event: charge'

export type SSEEvent<T> = { event: string; data: T }

/**
 * Lower-level than `streamChargeEvents` below — yields every named SSE
 * event on the stream (`event: <name>` + `data: <json>` pairs; a
 * comment-only heartbeat `: ping` line has neither, so it's silently
 * skipped) instead of filtering for one hardcoded event name and shape.
 * Used by streams whose event name differs from `streamChargeEvents`'
 * charges-specific assumptions (e.g. `distributions.streamPending`).
 */
export async function* streamSSEEvents<T>(
  config: HttpConfig,
  path: string,
  signal: AbortSignal,
): AsyncGenerator<SSEEvent<T>> {
  if (!config.apiKey) throw new MissingCredentialError(path)
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${config.apiKey}`,
  }

  const url = new URL(path, config.baseUrl)
  const res = await fetch(url, { headers, signal })
  if (!res.ok || !res.body) throw new Error(`SSE connection failed with status ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      buffer += decoder.decode(value, { stream: true })

      let separatorIndex = buffer.indexOf('\n\n')
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)

        const lines = rawEvent.split('\n')
        const eventLine = lines.find((line) => line.startsWith('event:'))
        const dataLine = lines.find((line) => line.startsWith('data:'))
        if (eventLine && dataLine) {
          yield {
            event: eventLine.slice('event:'.length).trim(),
            data: JSON.parse(dataLine.slice('data:'.length).trim()) as T,
          }
        }

        separatorIndex = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function* streamChargeEvents(
  config: HttpConfig,
  path: string,
  signal: AbortSignal,
): AsyncGenerator<Charge> {
  if (!config.apiKey) throw new MissingCredentialError(path)

  const url = new URL(path, config.baseUrl)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'text/event-stream' },
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`SSE connection failed with status ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      buffer += decoder.decode(value, { stream: true })

      let separatorIndex = buffer.indexOf('\n\n')
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)

        if (rawEvent.startsWith(CHARGE_EVENT_MARKER)) {
          const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data:'))
          if (dataLine) yield JSON.parse(dataLine.slice('data:'.length).trim()) as Charge
        }

        separatorIndex = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}
