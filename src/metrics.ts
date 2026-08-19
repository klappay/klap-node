import type { MetricsQueryRequest, MetricsQueryResult } from '@klappay/types'
import { type HttpConfig, request, withApiKeyEnvFallback } from './http'

export function createMetricsClient(passedConfig: HttpConfig = {}) {
  const config = withApiKeyEnvFallback(passedConfig, 'KLAP_METRICS_API_KEY')
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
