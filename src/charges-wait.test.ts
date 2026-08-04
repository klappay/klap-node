import type { Charge } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChargesClient } from './charges'

vi.mock('./http', () => ({ request: vi.fn() }))
vi.mock('./sse', () => ({ streamChargeEvents: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)
const { streamChargeEvents } = await import('./sse')
const streamMock = vi.mocked(streamChargeEvents)

const FAKE_CHARGE: Charge = {
  id: 'ch_fake',
  amount: 10,
  amountReceived: null,
  isOverpaid: false,
  currency: 'USD',
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  paidWith: [],
  address: '0xabc',
  status: 'pending',
  settlementStatus: null,
  environment: 'test',
  txHash: null,
  externalRef: null,
  source: null,
  metadata: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-01T01:00:00.000Z',
  confirmedAt: null,
  settledAt: null,
}

const config = { baseUrl: 'https://api.example.com', apiKey: 'klap_test_key' }

describe('waitForConfirmation() with an AbortSignal', () => {
  const configNoApiKey = { baseUrl: 'https://api.example.com' }

  beforeEach(() => {
    requestMock.mockReset()
    streamMock.mockReset()
  })

  it('rejects immediately, with no API call, if the signal is already aborted', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(configNoApiKey).get('ch_fake')
    requestMock.mockClear()

    const controller = new AbortController()
    controller.abort()

    await expect(charge.waitForConfirmation({ signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(requestMock).not.toHaveBeenCalled()
  })

  it('rejects as soon as the signal aborts during the wait between polls, without waiting a full interval', async () => {
    requestMock.mockResolvedValue(FAKE_CHARGE) // always 'pending' — check() never resolves on its own
    const charge = await createChargesClient(configNoApiKey).get('ch_fake')

    const controller = new AbortController()
    const promise = charge.waitForConfirmation({
      signal: controller.signal,
      pollIntervalMs: 10 * 60_000,
    })
    promise.catch(() => {})

    await new Promise((resolve) => setTimeout(resolve, 20))
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('propagates the abort instead of silently falling back to polling when the live stream is cancelled', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(config).get('ch_fake') // `config` has an apiKey — takes the SSE path
    requestMock.mockClear()

    streamMock.mockImplementation(async function* (_config, _path, signal) {
      await new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason))
      })
    })

    const controller = new AbortController()
    const promise = charge.waitForConfirmation({ signal: controller.signal })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(requestMock).not.toHaveBeenCalled()
  })
})
