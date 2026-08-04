import type { PendingDistribution, PendingDistributionEvent } from '@klappay/types'
import { type HttpConfig, request } from './http'
import { streamSSEEvents } from './sse'

export function createDistributionsClient(config: HttpConfig) {
  return {
    /**
     * Snapshot of every split in the calling key's own environment with a
     * confirmed payout still inside its grace period before Klap's own
     * worker claims it — `distribute()` on 0xSplits is permissionless, so
     * this is for discoverability, not a new on-chain capability. Pair
     * with `streamPending()` for real-time deltas — open that stream
     * *first*, then call this to bootstrap state, per the API's own
     * ordering guidance.
     */
    async list(): Promise<PendingDistribution[]> {
      return request<PendingDistribution[]>(config, {
        method: 'GET',
        path: '/v1/distributions/pending',
      })
    },

    /**
     * Real-time stream of distribution availability, scoped to the
     * calling key's own environment. Yields `{ type: 'distribution.available', distribution }`
     * or `{ type: 'distribution.claimed', splitAddress }` — no initial
     * snapshot is sent, connect here first and call `list()` to
     * bootstrap, applying every event (before or after `list()` resolves)
     * as an idempotent add/remove on top of it.
     */
    async *streamPending(
      signal: AbortSignal = new AbortController().signal,
    ): AsyncGenerator<PendingDistributionEvent> {
      const events = streamSSEEvents<PendingDistributionEvent>(
        config,
        '/v1/distributions/pending/events',
        signal,
      )
      for await (const { data } of events) yield data
    },
  }
}
