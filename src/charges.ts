import { randomBytes } from 'node:crypto'
import {
  type Charge,
  type CheckChargeRequest,
  type CheckChargeResponse,
  type CreateChargeRequest,
  type CreateSwapQuoteInput,
  type GetChargeQrCodeQueryRequest,
  type ListChargesInput,
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_LIMIT_MAX,
  type RefundEscrowRequest,
  type ReleaseEscrowRequest,
  type SwapQuote,
  type TimelineEvent,
} from '@klappay/types'
import { type CheckedCharge, type KlapCharge, wrapCharge } from './charges-wait'
import { type HttpConfig, request, withApiKeyEnvFallback } from './http'
import { streamChargeEvents } from './sse'

export type { CheckedCharge, KlapCharge, WaitOptions } from './charges-wait'

function generateIdempotencyKey(): string {
  return `sdk_${Date.now()}_${randomBytes(8).toString('hex')}`
}

export type ListChargesFilter = Partial<Omit<ListChargesInput, 'cursor'>>

export function createChargesClient(passedConfig: HttpConfig = {}) {
  const config = withApiKeyEnvFallback(passedConfig, 'KLAP_CHARGES_API_KEY')
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

    /**
     * Quotes a swap (via 0x) from a non-stablecoin cryptocurrency the payer
     * holds into one of the charge's `acceptedPayments` tokens — see
     * `charge.swapAlternatives` for which `(inputToken, inputNetwork)`
     * pairs are trusted. Requires `charges:write`.
     */
    async getQuote(id: string, input: CreateSwapQuoteInput): Promise<SwapQuote> {
      return request<SwapQuote>(config, {
        method: 'POST',
        path: `/v1/charges/${encodeURIComponent(id)}/quote`,
        body: input,
      })
    },

    /**
     * Triggers an immediate on-chain re-check of this charge instead of
     * waiting for the ~60s background reconciliation pass. Pass
     * `txHash`/`network` (e.g. right after a swap-to-pay or
     * wallet-connect transaction is sent) to verify that specific
     * transaction directly — one RPC call instead of a block-range scan.
     * Never trusts the caller: the charge only changes state if a real
     * matching transfer is found on-chain. Rate-limited per charge.
     *
     * The result also carries `transactionSender` — the checked
     * transaction's own signer, which stays the payer's real wallet even
     * when the payment routed through a swap/aggregator. Only populated
     * when `txHash`/`network` was passed and a matching receipt was found.
     * `confirmationProgress` is non-null while a detected transfer is
     * still short of its network's required confirmation depth (see
     * `WaitOptions.onConfirmationProgress` for the live-stream
     * equivalent), `null` otherwise.
     */
    async check(
      id: string,
      input?: CheckChargeRequest,
    ): Promise<CheckedCharge<CheckChargeResponse>> {
      const charge = await request<CheckChargeResponse>(config, {
        method: 'POST',
        path: `/v1/charges/${encodeURIComponent(id)}/check`,
        body: input,
      })
      return wrapCharge(config, charge)
    },

    /**
     * Releases an escrow-configured charge's entire live token balance
     * from its Safe to the charge's split address, where the normal
     * distribution mechanism then pays out the merchant/platform shares.
     * `signature` must be a valid Safe transaction signature from this
     * charge's `escrowReleaserAddress`, verified on-chain by the Safe
     * contract itself. Can only be called once per charge. Requires
     * `charges:write`.
     */
    async release(id: string, input: ReleaseEscrowRequest): Promise<KlapCharge> {
      const charge = await request<Charge>(config, {
        method: 'POST',
        path: `/v1/charges/${encodeURIComponent(id)}/release`,
        body: input,
      })
      return wrapCharge(config, charge)
    },

    /**
     * Refunds an escrow-configured charge's entire live token balance from
     * its Safe back to the address that funded it, instead of the split
     * address — no distribution follows. `signature` must be a valid Safe
     * transaction signature from this charge's `escrowReleaserAddress`,
     * verified on-chain by the Safe contract itself. Mutually exclusive
     * with `release()` — an escrow can only ever be released or refunded
     * once, never both. Requires `charges:write`.
     */
    async refund(id: string, input: RefundEscrowRequest): Promise<KlapCharge> {
      const charge = await request<Charge>(config, {
        method: 'POST',
        path: `/v1/charges/${encodeURIComponent(id)}/refund`,
        body: input,
      })
      return wrapCharge(config, charge)
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
