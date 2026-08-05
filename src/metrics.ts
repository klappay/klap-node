import type { MetricsQueryRequest, MetricsQueryResult } from '@klappay/types'
import { type HttpConfig, request, resolveOrganizationId } from './http'

export function createMetricsClient(config: HttpConfig) {
  return {
    async query(
      organizationId: string | undefined,
      input: MetricsQueryRequest,
    ): Promise<MetricsQueryResult> {
      const id = resolveOrganizationId(config, 'metrics.query()', organizationId)
      return request<MetricsQueryResult>(config, {
        method: 'POST',
        path: `/v1/organizations/${id}/metrics/query`,
        body: input,
        auth: 'sessionToken',
      })
    },
  }
}
