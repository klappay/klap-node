import { describe, expect, it } from 'vitest'
import * as sdk from './index'

describe('package public exports', () => {
  it('exposes every resource factory and the top-level createClient', () => {
    expect(sdk.createClient).toBeTypeOf('function')
    expect(sdk.createChargesClient).toBeTypeOf('function')
    expect(sdk.createWebhooksClient).toBeTypeOf('function')
    expect(sdk.verifyWebhookSignature).toBeTypeOf('function')
    expect(sdk.constructWebhookEvent).toBeTypeOf('function')
    expect(sdk.createMetricsClient).toBeTypeOf('function')
    expect(sdk.createSandboxClient).toBeTypeOf('function')
    expect(sdk.createDistributionsClient).toBeTypeOf('function')
    expect(sdk.createNetworksClient).toBeTypeOf('function')
    expect(sdk.createRecipientsClient).toBeTypeOf('function')
    expect(sdk.streamSSEEvents).toBeTypeOf('function')
    expect(sdk.isChargeEvent).toBeTypeOf('function')
    expect(sdk.isConfirmationProgressEvent).toBeTypeOf('function')
  })

  it('exposes every error class', () => {
    expect(sdk.KlapApiError).toBeTypeOf('function')
    expect(sdk.ChargeExpiredError).toBeTypeOf('function')
    expect(sdk.ChargeUnderpaidError).toBeTypeOf('function')
    expect(sdk.SettlementFailedError).toBeTypeOf('function')
    expect(sdk.WaitTimeoutError).toBeTypeOf('function')
    expect(sdk.InvalidWebhookSignatureError).toBeTypeOf('function')
    expect(sdk.WebhookTimestampToleranceError).toBeTypeOf('function')
    expect(sdk.MissingCredentialError).toBeTypeOf('function')
  })
})
