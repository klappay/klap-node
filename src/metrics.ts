import type { MetricsQueryRequest, MetricsQueryResult } from '@klappay/types'
import { type HttpConfig, request } from './http'

export function createMetricsClient(config: HttpConfig) {
  return {
    async query(input: MetricsQueryRequest): Promise<MetricsQueryResult> {
      return request<MetricsQueryResult>(config, {
        method: 'POST',
        path: '/v1/metrics/query',
        body: input,
      })
    },
  }
}
