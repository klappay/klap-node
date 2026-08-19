import { describe, expect, it } from 'vitest'
import {
  ChargeExpiredError,
  ChargeUnderpaidError,
  InvalidWebhookSignatureError,
  KlapApiError,
  MissingBaseUrlError,
  MissingCredentialError,
  SettlementFailedError,
  WaitTimeoutError,
  WebhookTimestampToleranceError,
} from './errors'

describe('KlapApiError', () => {
  it('carries status/code/message/param and sets name+message on the Error', () => {
    const err = new KlapApiError(404, 'charge_not_found', 'No such charge', 'id')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('KlapApiError')
    expect(err.status).toBe(404)
    expect(err.code).toBe('charge_not_found')
    expect(err.message).toBe('No such charge')
    expect(err.param).toBe('id')
  })

  it('leaves param undefined when none is given', () => {
    const err = new KlapApiError(500, 'unknown_error', 'Request failed')
    expect(err.param).toBeUndefined()
  })
})

describe('ChargeExpiredError', () => {
  it('names the charge in its message', () => {
    const err = new ChargeExpiredError('ch_1')
    expect(err.name).toBe('ChargeExpiredError')
    expect(err.chargeId).toBe('ch_1')
    expect(err.message).toBe('Charge ch_1 expired before it was paid.')
  })
})

describe('ChargeUnderpaidError', () => {
  it('names the charge in its message', () => {
    const err = new ChargeUnderpaidError('ch_2')
    expect(err.name).toBe('ChargeUnderpaidError')
    expect(err.chargeId).toBe('ch_2')
    expect(err.message).toBe('Charge ch_2 expired while only partially paid.')
  })
})

describe('SettlementFailedError', () => {
  it('names the charge in its message', () => {
    const err = new SettlementFailedError('ch_3')
    expect(err.name).toBe('SettlementFailedError')
    expect(err.chargeId).toBe('ch_3')
    expect(err.message).toBe('Settlement failed for charge ch_3 after retries were exhausted.')
  })
})

describe('WaitTimeoutError', () => {
  it('reports the charge and the timeout that elapsed', () => {
    const err = new WaitTimeoutError('ch_4', 60_000)
    expect(err.name).toBe('WaitTimeoutError')
    expect(err.chargeId).toBe('ch_4')
    expect(err.timeoutMs).toBe(60_000)
    expect(err.message).toBe('Timed out after 60000ms waiting for charge ch_4.')
  })
})

describe('InvalidWebhookSignatureError', () => {
  it('has a fixed message', () => {
    const err = new InvalidWebhookSignatureError()
    expect(err.name).toBe('InvalidWebhookSignatureError')
    expect(err.message).toBe('Webhook signature verification failed.')
  })
})

describe('WebhookTimestampToleranceError', () => {
  it('reports the delivery timestamp and the tolerance window', () => {
    const err = new WebhookTimestampToleranceError(1_700_000_000, 300)
    expect(err.name).toBe('WebhookTimestampToleranceError')
    expect(err.timestamp).toBe(1_700_000_000)
    expect(err.toleranceSeconds).toBe(300)
    expect(err.message).toContain('300s tolerance')
    expect(err.message).toContain(new Date(1_700_000_000 * 1000).toISOString())
  })
})

describe('MissingCredentialError', () => {
  it('explains how to fix a missing apiKey', () => {
    const err = new MissingCredentialError('charges.create()')
    expect(err.name).toBe('MissingCredentialError')
    expect(err.message).toBe(
      'charges.create() requires an apiKey — pass it to createClient(), or call klap.setApiKey() first.',
    )
  })
})

describe('MissingBaseUrlError', () => {
  it('explains how to fix a missing baseUrl', () => {
    const err = new MissingBaseUrlError('/v1/charges')
    expect(err.name).toBe('MissingBaseUrlError')
    expect(err.message).toBe(
      '/v1/charges requires a baseUrl — pass it to createClient(), or set KLAP_BASE_URL.',
    )
  })
})
