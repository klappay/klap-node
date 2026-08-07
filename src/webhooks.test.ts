import { createHmac } from 'node:crypto'
import type { PaginatedWebhookDeliveries, Webhook, WebhookDelivery } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvalidWebhookSignatureError, WebhookTimestampToleranceError } from './errors'
import { constructWebhookEvent, createWebhooksClient, verifyWebhookSignature } from './webhooks'

vi.mock('./http', () => ({ request: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)

const SECRET = 'whsec_test_secret'

function sign(
  body: string,
  secret: string = SECRET,
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`, 'utf8')
    .digest('hex')
  return `t=${timestamp},v1=${signature}`
}

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed body', () => {
    const body = JSON.stringify({ hello: 'world' })
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true)
  })

  it('rejects a body signed with a different secret', () => {
    const body = JSON.stringify({ hello: 'world' })
    expect(verifyWebhookSignature(body, sign(body, 'wrong-secret'), SECRET)).toBe(false)
  })

  it('rejects a tampered body', () => {
    const body = JSON.stringify({ hello: 'world' })
    const signature = sign(body)
    expect(verifyWebhookSignature(JSON.stringify({ hello: 'tampered' }), signature, SECRET)).toBe(
      false,
    )
  })

  it('rejects a header missing the v1 or t component', () => {
    const body = JSON.stringify({ hello: 'world' })
    expect(verifyWebhookSignature(body, 'v1=deadbeef', SECRET)).toBe(false)
    expect(verifyWebhookSignature(body, 't=1234567890', SECRET)).toBe(false)
    expect(verifyWebhookSignature(body, 'garbage', SECRET)).toBe(false)
  })

  it('still validates a signature whose timestamp is old — verifyWebhookSignature checks only the HMAC, not freshness', () => {
    const body = JSON.stringify({ hello: 'world' })
    const oldTimestamp = Math.floor(Date.now() / 1000) - 10_000
    expect(verifyWebhookSignature(body, sign(body, SECRET, oldTimestamp), SECRET)).toBe(true)
  })
})

describe('constructWebhookEvent', () => {
  const chargePayload = {
    id: 'evt_1',
    event: 'charge.confirmed',
    createdAt: '2026-01-01T00:00:00.000Z',
    data: { id: 'ch_1', amount: 10 },
  }

  it('parses a validly signed charge event and narrows data by event', () => {
    const body = JSON.stringify(chargePayload)
    const parsed = constructWebhookEvent(body, sign(body), SECRET)
    expect(parsed.event).toBe('charge.confirmed')
    if (parsed.event === 'charge.confirmed') {
      expect(parsed.data.id).toBe('ch_1')
    }
  })

  it('parses a non-charge event payload the same way', () => {
    const payload = {
      id: 'evt_2',
      event: 'payout_address.changed',
      createdAt: '2026-01-01T00:00:00.000Z',
      data: { organizationId: 'org_1', from: null, to: '0xabc' },
    }
    const body = JSON.stringify(payload)
    const parsed = constructWebhookEvent(body, sign(body), SECRET)
    expect(parsed.event).toBe('payout_address.changed')
    if (parsed.event === 'payout_address.changed') {
      expect(parsed.data.to).toBe('0xabc')
    }
  })

  it('narrows charge.canceled to the full Charge data shape', () => {
    const payload = {
      id: 'evt_3',
      event: 'charge.canceled',
      createdAt: '2026-01-01T00:00:00.000Z',
      data: { id: 'ch_1', status: 'canceled', canceledAt: '2026-01-01T00:00:00.000Z' },
    }
    const body = JSON.stringify(payload)
    const parsed = constructWebhookEvent(body, sign(body), SECRET)
    expect(parsed.event).toBe('charge.canceled')
    if (parsed.event === 'charge.canceled') {
      expect(parsed.data.status).toBe('canceled')
    }
  })

  it('narrows auth.email_changed to its own smaller data shape', () => {
    const payload = {
      id: 'evt_4',
      event: 'auth.email_changed',
      createdAt: '2026-01-01T00:00:00.000Z',
      data: { userId: 'usr_1', previousEmail: 'old@example.com', newEmail: 'new@example.com' },
    }
    const body = JSON.stringify(payload)
    const parsed = constructWebhookEvent(body, sign(body), SECRET)
    expect(parsed.event).toBe('auth.email_changed')
    if (parsed.event === 'auth.email_changed') {
      expect(parsed.data.newEmail).toBe('new@example.com')
    }
  })

  it('throws InvalidWebhookSignatureError on a bad signature', () => {
    const body = JSON.stringify(chargePayload)
    expect(() => constructWebhookEvent(body, sign(body, 'wrong-secret'), SECRET)).toThrow(
      InvalidWebhookSignatureError,
    )
  })

  it('rejects a payload missing required envelope fields even with a valid signature', () => {
    const body = JSON.stringify({ event: 'charge.confirmed' })
    expect(() => constructWebhookEvent(body, sign(body), SECRET)).toThrow()
  })

  it('throws WebhookTimestampToleranceError for a validly signed but stale delivery — the replay case M4 closes', () => {
    const body = JSON.stringify(chargePayload)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400 // past the 300s default tolerance
    expect(() => constructWebhookEvent(body, sign(body, SECRET, oldTimestamp), SECRET)).toThrow(
      WebhookTimestampToleranceError,
    )
  })

  it('accepts a delivery within a custom tolerance window', () => {
    const body = JSON.stringify(chargePayload)
    const timestamp = Math.floor(Date.now() / 1000) - 400
    const parsed = constructWebhookEvent(body, sign(body, SECRET, timestamp), SECRET, {
      toleranceSeconds: 500,
    })
    expect(parsed.event).toBe('charge.confirmed')
  })
})

describe('createWebhooksClient().categories', () => {
  const categories = createWebhooksClient({ baseUrl: 'https://api.example.com' }).categories

  it('lists charge.confirmed under payments', () => {
    expect(categories.payments).toContain('charge.confirmed')
  })

  it('lists auth.suspicious_activity under security', () => {
    expect(categories.security).toContain('auth.suspicious_activity')
  })

  it('lists the self-service account-change events under security', () => {
    expect(categories.security).toContain('auth.password_changed')
    expect(categories.security).toContain('auth.email_change_requested')
    expect(categories.security).toContain('auth.email_changed')
  })

  it('lists charge.canceled and charge.paid_after_cancel under payments', () => {
    expect(categories.payments).toContain('charge.canceled')
    expect(categories.payments).toContain('charge.paid_after_cancel')
  })

  it('lists webhook.delivery_failed under webhooks', () => {
    expect(categories.webhooks).toContain('webhook.delivery_failed')
  })
})

describe('createWebhooksClient() CRUD', () => {
  const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }

  const FAKE_WEBHOOK: Webhook = {
    id: 'wh_1',
    environment: 'live',
    url: 'https://example.com/webhooks/klap',
    events: [],
    eventCategories: ['payments'],
    excludeEvents: [],
    isWildcard: false,
    secret: 'whsec_abc',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  const FAKE_DELIVERY: WebhookDelivery = {
    id: 'whd_1',
    webhookId: 'wh_1',
    event: 'charge.confirmed',
    status: 'delivered',
    attempts: 1,
    responseCode: 200,
    nextRetryAt: null,
    deliveredAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  beforeEach(() => {
    requestMock.mockReset()
  })

  it('create() posts the subscription config', async () => {
    requestMock.mockResolvedValue(FAKE_WEBHOOK)

    await createWebhooksClient(config).create({ url: 'https://example.com/webhooks/klap' })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/webhooks',
      body: { url: 'https://example.com/webhooks/klap' },
    })
  })

  it('list() fetches every configured webhook', async () => {
    requestMock.mockResolvedValue([FAKE_WEBHOOK])

    const result = await createWebhooksClient(config).list()

    expect(requestMock).toHaveBeenCalledWith(config, { method: 'GET', path: '/v1/webhooks' })
    expect(result).toEqual([FAKE_WEBHOOK])
  })

  it('delete() removes a webhook by id', async () => {
    requestMock.mockResolvedValue(undefined)

    await createWebhooksClient(config).delete('wh_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'DELETE',
      path: '/v1/webhooks/wh_1',
    })
  })

  it('rotateSecret() posts to the rotate-secret endpoint', async () => {
    requestMock.mockResolvedValue(FAKE_WEBHOOK)

    await createWebhooksClient(config).rotateSecret('wh_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/webhooks/wh_1/rotate-secret',
    })
  })

  it('listDeliveries() defaults the query to the default pagination limit', async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null, hasMore: false })

    await createWebhooksClient(config).listDeliveries('wh_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'GET',
      path: '/v1/webhooks/wh_1/deliveries',
      query: { limit: 20 },
    })
  })

  it('listAllDeliveries() follows cursors across pages until hasMore is false', async () => {
    const page1: PaginatedWebhookDeliveries = {
      data: [{ ...FAKE_DELIVERY, id: 'whd_1' }],
      nextCursor: 'cur_2',
      hasMore: true,
    }
    const page2: PaginatedWebhookDeliveries = {
      data: [{ ...FAKE_DELIVERY, id: 'whd_2' }],
      nextCursor: null,
      hasMore: false,
    }
    requestMock.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2)

    const ids: string[] = []
    for await (const delivery of createWebhooksClient(config).listAllDeliveries('wh_1')) {
      ids.push(delivery.id)
    }

    expect(ids).toEqual(['whd_1', 'whd_2'])
    expect(requestMock.mock.calls[1]?.[1].query).toMatchObject({ cursor: 'cur_2' })
  })

  it('retryDelivery() posts to the retry endpoint for a specific delivery', async () => {
    requestMock.mockResolvedValue(undefined)

    await createWebhooksClient(config).retryDelivery('wh_1', 'whd_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/webhooks/wh_1/deliveries/whd_1/retry',
    })
  })
})
