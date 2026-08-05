import type { MetricsQueryRequest, MetricsQueryResult } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MissingCredentialError } from './errors'
import { createMetricsClient } from './metrics'

vi.mock('./http', async () => {
  const actual = await vi.importActual<typeof import('./http')>('./http')
  return { ...actual, request: vi.fn() }
})

const { request } = await import('./http')
const requestMock = vi.mocked(request)

const QUERY: MetricsQueryRequest = {
  resource: 'charges',
  environment: 'live',
  dateRange: {
    field: 'createdAt',
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-08-01T00:00:00.000Z',
  },
  groupBy: [{ type: 'date_bucket', field: 'createdAt', granularity: 'day' }],
  metrics: [{ aggregation: 'sum', field: 'amount', alias: 'volume' }],
  filters: [{ field: 'status', operator: 'eq', value: 'confirmed' }],
}

const FAKE_RESULT: MetricsQueryResult = {
  data: [{ createdAt: '2026-07-01', volume: 4820.5 }],
  meta: {
    resource: 'charges',
    environment: 'live',
    scope: 'owner_admin',
    rowCount: 1,
    truncated: false,
  },
}

beforeEach(() => {
  requestMock.mockReset()
})

describe('createMetricsClient().query()', () => {
  it('posts the query under the resolved organization with sessionToken auth', async () => {
    requestMock.mockResolvedValue(FAKE_RESULT)
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

    const result = await createMetricsClient(config).query('org_1', QUERY)

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/organizations/org_1/metrics/query',
      body: QUERY,
      auth: 'sessionToken',
    })
    expect(result).toEqual(FAKE_RESULT)
  })

  it('falls back to the configured default organizationId', async () => {
    requestMock.mockResolvedValue(FAKE_RESULT)
    const config = {
      baseUrl: 'https://api.example.com',
      sessionToken: 'sess_1',
      organizationId: 'org_default',
    }

    await createMetricsClient(config).query(undefined, QUERY)

    expect(requestMock.mock.calls[0]?.[1].path).toBe('/v1/organizations/org_default/metrics/query')
  })

  it('throws when no organizationId is available', async () => {
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

    await expect(createMetricsClient(config).query(undefined, QUERY)).rejects.toThrow(
      MissingCredentialError,
    )
    expect(requestMock).not.toHaveBeenCalled()
  })
})
