import {
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_LIMIT_MAX,
  type PaginatedPendingDistributions,
  type PaginationQueryRequest,
  type PendingDistribution,
  type PendingDistributionEvent,
} from '@klappay/types'
import { type HttpConfig, request } from './http'
import { streamSSEEvents } from './sse'

export function createDistributionsClient(config: HttpConfig) {
  const list = (input: PaginationQueryRequest = { limit: PAGINATION_LIMIT_DEFAULT }) =>
    request<PaginatedPendingDistributions>(config, {
      method: 'GET',
      path: '/v1/distributions/pending',
      query: input,
    })

  return {
    /**
     * Cursor-paginated snapshot of every split in the calling key's own
     * environment with a confirmed payout still inside its grace period
     * before Klap's own worker claims it — `distribute()` on 0xSplits is
     * permissionless, so this is for discoverability, not a new on-chain
     * capability. Pair with `streamPending()` for real-time deltas — open
     * that stream *first*, then call this (or `listAll()`) to bootstrap
     * state, per the API's own ordering guidance.
     */
    list,

    async *listAll(): AsyncGenerator<PendingDistribution> {
      let cursor: string | undefined
      for (;;) {
        const page = await list({ limit: PAGINATION_LIMIT_MAX, cursor })
        for (const distribution of page.data) yield distribution
        if (!page.hasMore || !page.nextCursor) return
        cursor = page.nextCursor
      }
    },

    /**
     * Real-time stream of distribution availability, scoped to the
     * calling key's own environment. Yields `{ type: 'distribution.available', distribution }`
     * or `{ type: 'distribution.claimed', splitAddress }`. With no
     * `limit`, no initial snapshot is sent — connect here first and call
     * `list()`/`listAll()` to bootstrap, applying every event (before or
     * after that resolves) as an idempotent add/remove on top of it.
     * Pass `limit` (1-100) for a self-contained connection instead: the
     * server sends up to that many currently-claimable distributions as
     * synthetic `distribution.available` events right after connecting,
     * then continues with live deltas — note this snapshot isn't a full
     * page (no cursor), so if more than `limit` are claimable, use
     * `list()`/`listAll()` directly for a complete listing during a
     * backlog.
     */
    async *streamPending(
      signal: AbortSignal = new AbortController().signal,
      limit?: number,
    ): AsyncGenerator<PendingDistributionEvent> {
      const path =
        limit === undefined
          ? '/v1/distributions/pending/events'
          : `/v1/distributions/pending/events?limit=${limit}`
      const events = streamSSEEvents<PendingDistributionEvent>(config, path, signal)
      for await (const { data } of events) yield data
    },
  }
}
