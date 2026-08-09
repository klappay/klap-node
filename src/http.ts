import { ErrorPayloadSchema } from '@klappay/types'
import { KlapApiError, MissingCredentialError } from './errors'

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

export type HttpConfig = {
  baseUrl: string
  apiKey?: string
  debug?: boolean
  /** Aborts a request after this many ms. Default 30s — the `waitFor*()` methods use their own `AbortSignal` and are unaffected. */
  timeoutMs?: number
}

type QueryValue = string | number | boolean | undefined

export type RequestOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  query?: Record<string, QueryValue>
  /** Default `'json'`. Set to `'text'` for a non-JSON success response (e.g. raw SVG). Error responses are always JSON regardless. */
  responseType?: 'json' | 'text'
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path, baseUrl)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

function resolveAuthHeader(config: HttpConfig, options: RequestOptions): string {
  if (!config.apiKey) throw new MissingCredentialError(options.path)
  return `Bearer ${config.apiKey}`
}

export async function request<T>(config: HttpConfig, options: RequestOptions): Promise<T> {
  const authHeader = resolveAuthHeader(config, options)
  const url = buildUrl(config.baseUrl, options.path, options.query)

  if (config.debug) console.debug('[klap-sdk]', options.method, url)

  const res = await fetch(url, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS),
  })

  if (res.status === 204) return undefined as T

  if (!res.ok) {
    const data = (await res.json()) as unknown
    const parsed = ErrorPayloadSchema.safeParse(data)
    const error = parsed.success ? parsed.data.error : undefined
    throw new KlapApiError(
      res.status,
      error?.code ?? 'unknown_error',
      error?.message ?? 'Request failed',
      error?.param,
    )
  }

  if (options.responseType === 'text') return (await res.text()) as T

  return (await res.json()) as T
}
