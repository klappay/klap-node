export { createClient } from './client'
export type { CreateClientOptions, KlapClient } from './client'

export { createChargesClient } from './charges'
export type { ListChargesFilter } from './charges'
export type { CheckedCharge, KlapCharge, WaitOptions } from './charges-wait'

export { createWebhooksClient, verifyWebhookSignature, constructWebhookEvent } from './webhooks'

export { createMetricsClient } from './metrics'
export { createSandboxClient } from './sandbox'
export { createDistributionsClient } from './distributions'
export { createNetworksClient } from './networks'
export { createRecipientsClient } from './recipients'
export { streamSSEEvents } from './sse'
export type { SSEEvent } from './sse'

export {
  KlapApiError,
  ChargeExpiredError,
  ChargeUnderpaidError,
  SettlementFailedError,
  WaitTimeoutError,
  InvalidWebhookSignatureError,
  WebhookTimestampToleranceError,
  MissingCredentialError,
  MissingBaseUrlError,
} from './errors'
