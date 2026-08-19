export class KlapApiError extends Error {
  readonly code: string
  readonly status: number
  readonly param?: string

  constructor(status: number, code: string, message: string, param?: string) {
    super(message)
    this.name = 'KlapApiError'
    this.status = status
    this.code = code
    this.param = param
  }
}

export class ChargeExpiredError extends Error {
  readonly chargeId: string

  constructor(chargeId: string) {
    super(`Charge ${chargeId} expired before it was paid.`)
    this.name = 'ChargeExpiredError'
    this.chargeId = chargeId
  }
}

export class ChargeUnderpaidError extends Error {
  readonly chargeId: string

  constructor(chargeId: string) {
    super(`Charge ${chargeId} expired while only partially paid.`)
    this.name = 'ChargeUnderpaidError'
    this.chargeId = chargeId
  }
}

export class SettlementFailedError extends Error {
  readonly chargeId: string

  constructor(chargeId: string) {
    super(`Settlement failed for charge ${chargeId} after retries were exhausted.`)
    this.name = 'SettlementFailedError'
    this.chargeId = chargeId
  }
}

export class WaitTimeoutError extends Error {
  readonly chargeId: string
  readonly timeoutMs: number

  constructor(chargeId: string, timeoutMs: number) {
    super(`Timed out after ${timeoutMs}ms waiting for charge ${chargeId}.`)
    this.name = 'WaitTimeoutError'
    this.chargeId = chargeId
    this.timeoutMs = timeoutMs
  }
}

export class InvalidWebhookSignatureError extends Error {
  constructor() {
    super('Webhook signature verification failed.')
    this.name = 'InvalidWebhookSignatureError'
  }
}

export class WebhookTimestampToleranceError extends Error {
  readonly timestamp: number
  readonly toleranceSeconds: number

  constructor(timestamp: number, toleranceSeconds: number) {
    super(
      `Webhook timestamp (${new Date(timestamp * 1000).toISOString()}) is outside the ${toleranceSeconds}s tolerance window — possible replay of an old delivery.`,
    )
    this.name = 'WebhookTimestampToleranceError'
    this.timestamp = timestamp
    this.toleranceSeconds = toleranceSeconds
  }
}

export class MissingCredentialError extends Error {
  constructor(context: string) {
    super(
      `${context} requires an apiKey — pass it to createClient(), or call klap.setApiKey() first.`,
    )
    this.name = 'MissingCredentialError'
  }
}

export class MissingBaseUrlError extends Error {
  constructor(context: string) {
    super(`${context} requires a baseUrl — pass it to createClient(), or set KLAP_BASE_URL.`)
    this.name = 'MissingBaseUrlError'
  }
}
