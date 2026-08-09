import { randomBytes } from 'node:crypto'
import {
  type Charge,
  type CreateChargeRequest,
  type GetChargeQrCodeQueryRequest,
  type ListChargesInput,
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_LIMIT_MAX,
  type TimelineEvent,
} from '@klappay/types'
import { type KlapCharge, wrapCharge } from './charges-wait'
import { type HttpConfig, request } from './http'
import { streamChargeEvents } from './sse'

export type { KlapCharge, WaitOptions } from './charges-wait'

function generateIdempotencyKey(): string {
  return `sdk_${Date.now()}_${randomBytes(8).toString('hex')}`
}

export type ListChargesFilter = Partial<Omit<ListChargesInput, 'cursor'>>

export function createChargesClient(config: HttpConfig) {
  const list = (input: ListChargesInput = { limit: PAGINATION_LIMIT_DEFAULT }) =>
    request<{ data: Charge[]; nextCursor: string | null; hasMore: boolean }>(config, {
      method: 'GET',
      path: '/v1/charges',
      query: input,
    })

  return {
    async create(input: CreateChargeRequest): Promise<KlapCharge> {
      const charge = await request<Charge>(config, {
        method: 'POST',
        path: '/v1/charges',
        body: { ...input, idempotencyKey: input.idempotencyKey ?? generateIdempotencyKey() },
      })
      return wrapCharge(config, charge)
    },

    async get(id: string): Promise<KlapCharge> {
      const charge = await request<Charge>(config, {
        method: 'GET',
        path: `/v1/charges/${encodeURIComponent(id)}`,
      })
      return wrapCharge(config, charge)
    },

    /**
     * A scannable EIP-681 payment QR code (SVG) for one of the charge's
     * accepted `(token, network)` pairs. `query` is only required when
     * the charge accepts more than one pair; with exactly one, it's
     * resolved automatically.
     */
    async getQrCode(id: string, query?: GetChargeQrCodeQueryRequest): Promise<string> {
      return request<string>(config, {
        method: 'GET',
        path: `/v1/charges/${encodeURIComponent(id)}/qrcode`,
        query,
        responseType: 'text',
      })
    },

    list,

    async *listAll(filter: ListChargesFilter = {}): AsyncGenerator<KlapCharge> {
      let cursor: string | undefined
      for (;;) {
        const page = await list({ limit: PAGINATION_LIMIT_MAX, ...filter, cursor })
        for (const charge of page.data) yield wrapCharge(config, charge)
        if (!page.hasMore || !page.nextCursor) return
        cursor = page.nextCursor
      }
    },

    async getTimeline(id: string): Promise<TimelineEvent[]> {
      return request<TimelineEvent[]>(config, {
        method: 'GET',
        path: `/v1/charges/${encodeURIComponent(id)}/timeline`,
      })
    },

    /**
     * Raw access to the same live event stream `waitForConfirmation()`/
     * `waitForSettlement()`/`waitFor()` already use internally — reach
     * for this only if you need custom logic beyond those three built-in
     * outcomes (e.g. reacting to every intermediate status change, not
     * just one terminal one). Yields the full `Charge` every time
     * `status`/`settlementStatus` changes; closes when the server does.
     */
    watch(id: string, signal: AbortSignal = new AbortController().signal): AsyncGenerator<Charge> {
      return streamChargeEvents(config, `/v1/charges/${encodeURIComponent(id)}/events`, signal)
    },
  }
}
