import { ErrorPayloadSchema } from '@klappay/types'
import { KlapApiError, MissingBaseUrlError, MissingCredentialError } from './errors'

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

export type HttpConfig = {
  /** Falls back to `process.env.KLAP_BASE_URL` when omitted. */
  baseUrl?: string
  apiKey?: string
  debug?: boolean
  /** Aborts a request after this many ms. Default 30s — the `waitFor*()` methods use their own `AbortSignal` and are unaffected. */
  timeoutMs?: number
}

export function withApiKeyEnvFallback(passedConfig: HttpConfig, envVar: string): HttpConfig {
  return {
    ...passedConfig,
    // getter, not a plain merge — keeps klap.setApiKey()'s mutation of the shared config visible here
    get apiKey() {
      return passedConfig.apiKey ?? process.env[envVar]
    },
  }
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

function resolveBaseUrl(config: HttpConfig, options: RequestOptions): string {
  const baseUrl = config.baseUrl ?? process.env.KLAP_BASE_URL
  if (!baseUrl) throw new MissingBaseUrlError(options.path)
  return baseUrl
}

export async function request<T>(config: HttpConfig, options: RequestOptions): Promise<T> {
  const authHeader = resolveAuthHeader(config, options)
  const url = buildUrl(resolveBaseUrl(config, options), options.path, options.query)

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
    const data: unknown = await res.json().catch(() => undefined)
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
