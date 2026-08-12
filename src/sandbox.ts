import type { Charge, TriggerableChargeEvent } from '@klappay/types'
import { type HttpConfig, request } from './http'

export function createSandboxClient(config: HttpConfig) {
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
  }
}
