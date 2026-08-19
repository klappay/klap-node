import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  type CreateWebhookRequest,
  type ListWebhookDeliveriesInput,
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_LIMIT_MAX,
  type PaginatedWebhookDeliveries,
  type TypedWebhookPayload,
  WEBHOOK_EVENT_CATEGORIES,
  type Webhook,
  type WebhookDelivery,
  type WebhookListItem,
  WebhookPayloadSchema,
} from '@klappay/types'
import { InvalidWebhookSignatureError, WebhookTimestampToleranceError } from './errors'
import { type HttpConfig, request, withApiKeyEnvFallback } from './http'

const DEFAULT_TOLERANCE_SECONDS = 300

function parseSignatureHeader(header: string): { timestamp: number; signature: string } | null {
  const parts: Record<string, string> = {}
  for (const part of header.split(',')) {
    const [key, value] = part.split('=')
    if (key && value) parts[key] = value
  }
  const timestamp = Number(parts.t)
  if (!parts.v1 || !Number.isFinite(timestamp)) return null
  return { timestamp, signature: parts.v1 }
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) return false

  const expected = createHmac('sha256', secret)
    .update(`${parsed.timestamp}.${rawBody}`, 'utf8')
    .digest('hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  const signatureBuffer = Buffer.from(parsed.signature, 'hex')
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  )
}

export function constructWebhookEvent(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  options?: { toleranceSeconds?: number },
): TypedWebhookPayload {
  if (!verifyWebhookSignature(rawBody, signatureHeader, secret)) {
    throw new InvalidWebhookSignatureError()
  }

  const parsed = parseSignatureHeader(signatureHeader)
  const toleranceSeconds = options?.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (parsed && Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) {
    throw new WebhookTimestampToleranceError(parsed.timestamp, toleranceSeconds)
  }

  const payload = WebhookPayloadSchema.parse(JSON.parse(rawBody))
  return payload as TypedWebhookPayload
}

export function createWebhooksClient(passedConfig: HttpConfig = {}) {
  const config = withApiKeyEnvFallback(passedConfig, 'KLAP_WEBHOOKS_API_KEY')
  return {
    async create(input: CreateWebhookRequest): Promise<Webhook> {
      return request<Webhook>(config, { method: 'POST', path: '/v1/webhooks', body: input })
    },

    async list(): Promise<WebhookListItem[]> {
      return request<WebhookListItem[]>(config, { method: 'GET', path: '/v1/webhooks' })
    },

    async delete(id: string): Promise<void> {
      return request<void>(config, {
        method: 'DELETE',
        path: `/v1/webhooks/${encodeURIComponent(id)}`,
      })
    },

    async rotateSecret(id: string): Promise<Webhook> {
      return request<Webhook>(config, {
        method: 'POST',
        path: `/v1/webhooks/${encodeURIComponent(id)}/rotate-secret`,
      })
    },

    listDeliveries(
      id: string,
      input: ListWebhookDeliveriesInput = { limit: PAGINATION_LIMIT_DEFAULT },
    ) {
      return request<PaginatedWebhookDeliveries>(config, {
        method: 'GET',
        path: `/v1/webhooks/${encodeURIComponent(id)}/deliveries`,
        query: input,
      })
    },

    async *listAllDeliveries(id: string): AsyncGenerator<WebhookDelivery> {
      let cursor: string | undefined
      for (;;) {
        const page = await request<PaginatedWebhookDeliveries>(config, {
          method: 'GET',
          path: `/v1/webhooks/${encodeURIComponent(id)}/deliveries`,
          query: { limit: PAGINATION_LIMIT_MAX, cursor },
        })
        for (const delivery of page.data) yield delivery
        if (!page.hasMore || !page.nextCursor) return
        cursor = page.nextCursor
      }
    },

    async retryDelivery(id: string, deliveryId: string): Promise<void> {
      return request<void>(config, {
        method: 'POST',
        path: `/v1/webhooks/${encodeURIComponent(id)}/deliveries/${encodeURIComponent(deliveryId)}/retry`,
      })
    },

    verifySignature: verifyWebhookSignature,
    constructEvent: constructWebhookEvent,
    categories: WEBHOOK_EVENT_CATEGORIES,
  }
}
