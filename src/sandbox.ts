import type { Charge, NonChargeTriggerableEvent, TriggerableChargeEvent } from '@klappay/types'
import { type HttpConfig, request } from './http'

export function createSandboxClient(config: HttpConfig) {
  const trigger = (
    chargeId: string,
    event: TriggerableChargeEvent,
    amount?: number,
  ): Promise<Charge> =>
    request<Charge>(config, {
      method: 'POST',
      path: `/v1/sandbox/charges/${chargeId}/trigger`,
      body: { event, amount },
    })

  const triggerEvent = (event: NonChargeTriggerableEvent): Promise<void> =>
    request<void>(config, {
      method: 'POST',
      path: '/v1/sandbox/events/trigger',
      body: { event },
    })

  return {
    trigger,
    confirm: (chargeId: string) => trigger(chargeId, 'charge.confirmed'),
    partiallyPay: (chargeId: string, amount?: number) =>
      trigger(chargeId, 'charge.partially_paid', amount),
    overpay: (chargeId: string, amount?: number) => trigger(chargeId, 'charge.overpaid', amount),
    expire: (chargeId: string) => trigger(chargeId, 'charge.expired'),
    underpay: (chargeId: string) => trigger(chargeId, 'charge.underpaid'),
    settle: (chargeId: string) => trigger(chargeId, 'charge.settled'),
    failSettlement: (chargeId: string) => trigger(chargeId, 'charge.settlement_failed'),
    triggerEvent,
  }
}
