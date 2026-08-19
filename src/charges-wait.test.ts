import type { Charge, TriggerableChargeEvent } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChargesClient } from './charges'
import {
  ChargeExpiredError,
  ChargeUnderpaidError,
  SettlementFailedError,
  WaitTimeoutError,
} from './errors'

vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>()
  return { ...actual, request: vi.fn() }
})
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
  apiKeyId: null,
  txHash: null,
  externalRef: null,
  source: null,
  metadata: null,
  redirectUrl: null,
  checkoutUrl: null,
  splitRecipients: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-01T01:00:00.000Z',
  confirmedAt: null,
  settledAt: null,
  lastActivityAt: '2026-01-01T00:00:00.000Z',
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

describe('KlapCharge.refresh()', () => {
  const configNoApiKey = { baseUrl: 'https://api.example.com' }

  beforeEach(() => {
    requestMock.mockReset()
  })

  it('re-fetches the charge by id', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(configNoApiKey).get('ch_fake')

    requestMock.mockResolvedValueOnce({ ...FAKE_CHARGE, status: 'confirmed' })
    const refreshed = await charge.refresh()

    expect(requestMock).toHaveBeenLastCalledWith(configNoApiKey, {
      method: 'GET',
      path: '/v1/charges/ch_fake',
    })
    expect(refreshed.status).toBe('confirmed')
    expect(refreshed.waitForConfirmation).toBeTypeOf('function')
  })
})

describe('waitForConfirmation() via polling (no apiKey configured)', () => {
  const configNoApiKey = { baseUrl: 'https://api.example.com' }

  beforeEach(() => {
    requestMock.mockReset()
  })

  it('resolves once a poll sees status: confirmed, reporting every intermediate status', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(configNoApiKey).get('ch_fake')

    requestMock
      .mockResolvedValueOnce({ ...FAKE_CHARGE, status: 'pending' })
      .mockResolvedValueOnce({ ...FAKE_CHARGE, status: 'confirmed' })

    const onStatusChange = vi.fn()
    const result = await charge.waitForConfirmation({ pollIntervalMs: 5, onStatusChange })

    expect(result.status).toBe('confirmed')
    expect(onStatusChange).toHaveBeenCalledTimes(2)
  })

  it('defaults to a 2s poll interval when none is given', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(configNoApiKey).get('ch_fake')

    requestMock
      .mockResolvedValueOnce({ ...FAKE_CHARGE, status: 'pending' })
      .mockResolvedValueOnce({ ...FAKE_CHARGE, status: 'confirmed' })

    vi.useFakeTimers()
    try {
      const promise = charge.waitForConfirmation({})
      await vi.advanceTimersByTimeAsync(2_000)
      const result = await promise
      expect(result.status).toBe('confirmed')
    } finally {
      vi.useRealTimers()
    }
  })

  it('throws ChargeExpiredError if the charge expires before confirming', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(configNoApiKey).get('ch_fake')
    requestMock.mockResolvedValueOnce({ ...FAKE_CHARGE, status: 'expired' })

    await expect(charge.waitForConfirmation({ pollIntervalMs: 5 })).rejects.toThrow(
      ChargeExpiredError,
    )
  })

  it('throws ChargeUnderpaidError if the charge expires while only partially paid', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(configNoApiKey).get('ch_fake')
    requestMock.mockResolvedValueOnce({ ...FAKE_CHARGE, status: 'underpaid' })

    await expect(charge.waitForConfirmation({ pollIntervalMs: 5 })).rejects.toThrow(
      ChargeUnderpaidError,
    )
  })

  it('throws WaitTimeoutError once the deadline passes with no terminal status', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(configNoApiKey).get('ch_fake')
    requestMock.mockResolvedValue(FAKE_CHARGE) // always pending

    await expect(charge.waitForConfirmation({ pollIntervalMs: 5, timeoutMs: 12 })).rejects.toThrow(
      WaitTimeoutError,
    )
  })

  it('rejects immediately, without waiting out the interval, if the signal is already aborted by the time the wait between polls begins', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(configNoApiKey).get('ch_fake')

    const controller = new AbortController()
    requestMock.mockImplementationOnce(async () => {
      controller.abort()
      return FAKE_CHARGE // still pending -> check() proceeds to sleep() with an already-aborted signal
    })

    await expect(
      charge.waitForConfirmation({ signal: controller.signal, pollIntervalMs: 5 }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('waitForSettlement() via polling (no apiKey configured)', () => {
  const configNoApiKey = { baseUrl: 'https://api.example.com' }

  beforeEach(() => {
    requestMock.mockReset()
  })

  it('keeps polling while settlementStatus is still pending, then resolves on completed', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(configNoApiKey).get('ch_fake')

    requestMock
      .mockResolvedValueOnce({ ...FAKE_CHARGE, settlementStatus: 'pending' })
      .mockResolvedValueOnce({ ...FAKE_CHARGE, settlementStatus: 'completed' })

    const result = await charge.waitForSettlement({ pollIntervalMs: 5 })
    expect(result.settlementStatus).toBe('completed')
  })

  it('throws SettlementFailedError once a poll sees settlementStatus: failed', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(configNoApiKey).get('ch_fake')
    requestMock.mockResolvedValueOnce({ ...FAKE_CHARGE, settlementStatus: 'failed' })

    await expect(charge.waitForSettlement({ pollIntervalMs: 5 })).rejects.toThrow(
      SettlementFailedError,
    )
  })
})

describe('waitFor() via polling (no apiKey configured)', () => {
  const configNoApiKey = { baseUrl: 'https://api.example.com' }

  beforeEach(() => {
    requestMock.mockReset()
  })

  it.each([
    ['charge.confirmed', { status: 'confirmed' }],
    ['charge.partially_paid', { status: 'partially_paid' }],
    ['charge.expired', { status: 'expired' }],
    ['charge.underpaid', { status: 'underpaid' }],
    ['charge.settled', { settlementStatus: 'completed' }],
    ['charge.settlement_failed', { settlementStatus: 'failed' }],
    ['charge.overpaid', { isOverpaid: true }],
  ] as [TriggerableChargeEvent, Partial<Charge>][])(
    'resolves for %s once the matching field changes',
    async (event, patch) => {
      requestMock.mockResolvedValueOnce(FAKE_CHARGE)
      const charge = await createChargesClient(configNoApiKey).get('ch_fake')
      requestMock.mockResolvedValueOnce({ ...FAKE_CHARGE, ...patch })

      const result = await charge.waitFor(event, { pollIntervalMs: 5 })
      expect(result).toMatchObject(patch)
    },
  )
})

describe('waitForConfirmation() via the live SSE stream (apiKey configured)', () => {
  beforeEach(() => {
    requestMock.mockReset()
    streamMock.mockReset()
  })

  it('resolves from the stream without ever falling back to polling', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(config).get('ch_fake')
    requestMock.mockClear()

    streamMock.mockImplementation(async function* () {
      yield { ...FAKE_CHARGE, status: 'pending' }
      yield { ...FAKE_CHARGE, status: 'confirmed' }
    })

    const onStatusChange = vi.fn()
    const result = await charge.waitForConfirmation({ onStatusChange })

    expect(result.status).toBe('confirmed')
    expect(onStatusChange).toHaveBeenCalledTimes(2)
    expect(requestMock).not.toHaveBeenCalled()
  })

  it('falls back to polling if the stream ends without producing a terminal event', async () => {
    requestMock.mockResolvedValueOnce(FAKE_CHARGE)
    const charge = await createChargesClient(config).get('ch_fake')
    requestMock.mockClear()

    streamMock.mockImplementation(async function* () {})
    requestMock.mockResolvedValueOnce({ ...FAKE_CHARGE, status: 'confirmed' })

    const result = await charge.waitForConfirmation({ pollIntervalMs: 5 })

    expect(result.status).toBe('confirmed')
    expect(requestMock).toHaveBeenCalled()
  })
})
