import type { Charge, TriggerableChargeEvent } from '@klappay/types'
import { type HttpConfig, request, withApiKeyEnvFallback } from './http'

export function createSandboxClient(passedConfig: HttpConfig = {}) {
  const config = withApiKeyEnvFallback(passedConfig, 'KLAP_SANDBOX_API_KEY')
  const trigger = (
    chargeId: string,
    event: TriggerableChargeEvent,
    amount?: number,
  ): Promise<Charge> =>
    request<Charge>(config, {
      method: 'POST',
      path: `/v1/sandbox/charges/${encodeURIComponent(chargeId)}/trigger`,
      body: { event, amount },
    })

  return {
    trigger,
    confirm: (chargeId: string): Promise<Charge> => trigger(chargeId, 'charge.confirmed'),
    partiallyPay: (chargeId: string, amount?: number): Promise<Charge> =>
      trigger(chargeId, 'charge.partially_paid', amount),
    overpay: (chargeId: string, amount?: number): Promise<Charge> =>
      trigger(chargeId, 'charge.overpaid', amount),
    expire: (chargeId: string): Promise<Charge> => trigger(chargeId, 'charge.expired'),
    underpay: (chargeId: string): Promise<Charge> => trigger(chargeId, 'charge.underpaid'),
    settle: (chargeId: string): Promise<Charge> => trigger(chargeId, 'charge.settled'),
    failSettlement: (chargeId: string): Promise<Charge> =>
      trigger(chargeId, 'charge.settlement_failed'),
    releaseEscrow: (chargeId: string): Promise<Charge> =>
      trigger(chargeId, 'charge.escrow_released'),
  }
}
