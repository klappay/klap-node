import type { Charge, TriggerableChargeEvent } from '@klappay/types'
import {
  ChargeCanceledError,
  ChargeExpiredError,
  ChargeUnderpaidError,
  SettlementFailedError,
  WaitTimeoutError,
} from './errors'
import { type HttpConfig, request } from './http'
import { streamChargeEvents } from './sse'

const DEFAULT_TIMEOUT_MS = 60 * 60_000
const DEFAULT_POLL_INTERVAL_MS = 2_000
const MAX_POLL_INTERVAL_MS = 15_000
const POLL_BACKOFF_FACTOR = 1.5

export type WaitOptions = {
  timeoutMs?: number
  pollIntervalMs?: number
  onStatusChange?: (charge: Charge) => void
  /** Cancels the wait early — same pattern as `fetch`. Rejects with the signal's own `reason` (an `AbortError` `DOMException` by default). Does not cancel an in-flight status check already sent to the API; it takes effect on the next check or during the wait between checks. */
  signal?: AbortSignal
}

export type KlapCharge = Charge & {
  refresh(): Promise<KlapCharge>
  waitForConfirmation(options?: WaitOptions): Promise<KlapCharge>
  waitForSettlement(options?: WaitOptions): Promise<KlapCharge>
  waitFor(event: TriggerableChargeEvent, options?: WaitOptions): Promise<KlapCharge>
}

type WaitCheckResult = { done: true; result: Charge } | { done: false }

const EVENT_CHECKS: Record<TriggerableChargeEvent, (charge: Charge) => WaitCheckResult> = {
  'charge.confirmed': (c) =>
    c.status === 'confirmed' ? { done: true, result: c } : { done: false },
  'charge.partially_paid': (c) =>
    c.status === 'partially_paid' ? { done: true, result: c } : { done: false },
  'charge.expired': (c) => (c.status === 'expired' ? { done: true, result: c } : { done: false }),
  'charge.underpaid': (c) =>
    c.status === 'underpaid' ? { done: true, result: c } : { done: false },
  'charge.settled': (c) =>
    c.settlementStatus === 'completed' ? { done: true, result: c } : { done: false },
  'charge.settlement_failed': (c) =>
    c.settlementStatus === 'failed' ? { done: true, result: c } : { done: false },
  'charge.overpaid': (c) => (c.isOverpaid ? { done: true, result: c } : { done: false }),
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const timeoutId = setTimeout(
      () => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      },
      Math.max(ms, 0),
    )
    const onAbort = () => {
      clearTimeout(timeoutId)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function pollOrStreamUntil(
  config: HttpConfig,
  chargeId: string,
  options: WaitOptions,
  check: (charge: Charge) => WaitCheckResult,
): Promise<KlapCharge> {
  options.signal?.throwIfAborted()

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const deadline = Date.now() + timeoutMs

  const viaSse = await waitViaSse(config, chargeId, deadline, options, check)
  if (viaSse) return wrapCharge(config, viaSse)

  options.signal?.throwIfAborted()
  return waitViaPolling(config, chargeId, deadline, timeoutMs, options, check)
}

async function waitViaSse(
  config: HttpConfig,
  chargeId: string,
  deadline: number,
  options: WaitOptions,
  check: (charge: Charge) => WaitCheckResult,
): Promise<Charge | null> {
  if (!config.apiKey) return null

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), Math.max(deadline - Date.now(), 0))
  const onExternalAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', onExternalAbort, { once: true })
  const iterator = streamChargeEvents(config, `/v1/charges/${chargeId}/events`, controller.signal)

  try {
    for (;;) {
      let next: IteratorResult<Charge>
      try {
        next = await iterator.next()
      } catch {
        options.signal?.throwIfAborted()
        return null
      }
      if (next.done) {
        options.signal?.throwIfAborted()
        return null
      }

      options.onStatusChange?.(next.value)
      const outcome = check(next.value)
      if (outcome.done) return outcome.result
    }
  } finally {
    clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', onExternalAbort)
    controller.abort()
  }
}

async function waitViaPolling(
  config: HttpConfig,
  chargeId: string,
  deadline: number,
  timeoutMs: number,
  options: WaitOptions,
  check: (charge: Charge) => WaitCheckResult,
): Promise<KlapCharge> {
  let intervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS

  for (;;) {
    options.signal?.throwIfAborted()
    const charge = await request<Charge>(config, { method: 'GET', path: `/v1/charges/${chargeId}` })
    options.onStatusChange?.(charge)

    const outcome = check(charge)
    if (outcome.done) return wrapCharge(config, outcome.result)

    if (Date.now() >= deadline) throw new WaitTimeoutError(chargeId, timeoutMs)

    await sleep(Math.min(intervalMs, deadline - Date.now()), options.signal)
    intervalMs = Math.min(intervalMs * POLL_BACKOFF_FACTOR, MAX_POLL_INTERVAL_MS)
  }
}

export function wrapCharge(config: HttpConfig, charge: Charge): KlapCharge {
  return {
    ...charge,
    async refresh() {
      const fresh = await request<Charge>(config, {
        method: 'GET',
        path: `/v1/charges/${charge.id}`,
      })
      return wrapCharge(config, fresh)
    },
    waitForConfirmation(options = {}) {
      return pollOrStreamUntil(config, charge.id, options, (c) => {
        if (c.status === 'confirmed') return { done: true, result: c }
        if (c.status === 'expired') throw new ChargeExpiredError(charge.id)
        if (c.status === 'underpaid') throw new ChargeUnderpaidError(charge.id)
        if (c.status === 'canceled') throw new ChargeCanceledError(charge.id)
        return { done: false }
      })
    },
    waitForSettlement(options = {}) {
      return pollOrStreamUntil(config, charge.id, options, (c) => {
        if (c.settlementStatus === 'completed') return { done: true, result: c }
        if (c.settlementStatus === 'failed') throw new SettlementFailedError(charge.id)
        return { done: false }
      })
    },
    waitFor(event, options = {}) {
      return pollOrStreamUntil(config, charge.id, options, EVENT_CHECKS[event])
    },
  }
}
