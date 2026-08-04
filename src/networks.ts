import type { Capabilities } from '@klappay/types'
import { type HttpConfig, request } from './http'

export function createNetworksClient(config: HttpConfig) {
  return {
    /**
     * The live `(token, network)` capability matrix for the calling key's
     * own environment — the exact same lookup `POST /v1/charges`
     * validates `acceptedPayments` against, so a pair listed here is
     * always safe to submit. Build a payment-method picker from this
     * instead of hardcoding the matrix client-side.
     */
    async get(): Promise<Capabilities> {
      return request<Capabilities>(config, { method: 'GET', path: '/v1/networks' })
    },
  }
}
