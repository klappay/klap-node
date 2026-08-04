import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { InvalidWebhookSignatureError, WebhookTimestampToleranceError } from './errors'
import { constructWebhookEvent, createWebhooksClient, verifyWebhookSignature } from './webhooks'

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

  it('lists webhook.delivery_failed under webhooks', () => {
    expect(categories.webhooks).toContain('webhook.delivery_failed')
  })
})
