import type { MetricsQueryRequest, MetricsQueryResult } from '@klappay/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMetricsClient } from './metrics'

vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>()
  return { ...actual, request: vi.fn() }
})

const { request } = await import('./http')
const requestMock = vi.mocked(request)

const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }

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
    rowCount: 1,
    truncated: false,
  },
}

beforeEach(() => {
  requestMock.mockReset()
})

describe('createMetricsClient().query()', () => {
  it('posts the query to the metrics endpoint with apiKey auth', async () => {
    requestMock.mockResolvedValue(FAKE_RESULT)

    const result = await createMetricsClient(config).query(QUERY)

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/metrics/query',
      body: QUERY,
    })
    expect(result).toEqual(FAKE_RESULT)
  })
})

describe('createMetricsClient() env fallback', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to KLAP_METRICS_API_KEY when apiKey is omitted', async () => {
    vi.stubEnv('KLAP_METRICS_API_KEY', 'klap_env_key')
    requestMock.mockResolvedValue(FAKE_RESULT)

    await createMetricsClient({ baseUrl: 'https://api.example.com' }).query(QUERY)

    expect(requestMock.mock.calls[0]?.[0]).toMatchObject({ apiKey: 'klap_env_key' })
  })

  it('prefers an explicit apiKey over KLAP_METRICS_API_KEY', async () => {
    vi.stubEnv('KLAP_METRICS_API_KEY', 'klap_env_key')
    requestMock.mockResolvedValue(FAKE_RESULT)

    await createMetricsClient({
      baseUrl: 'https://api.example.com',
      apiKey: 'klap_explicit',
    }).query(QUERY)

    expect(requestMock.mock.calls[0]?.[0]).toMatchObject({ apiKey: 'klap_explicit' })
  })
})
