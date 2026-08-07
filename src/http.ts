import { ErrorPayloadSchema } from '@klappay/types'
import { KlapApiError, MissingCredentialError } from './errors'

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

export type HttpConfig = {
  baseUrl: string
  apiKey?: string
  sessionToken?: string
  /** Default organization id, used by any organization-scoped method call that doesn't pass one explicitly. Mutable after construction via `klap.setOrganizationId()`. */
  organizationId?: string
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
  auth?: 'apiKey' | 'sessionToken' | 'none'
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

/**
 * Every organization-scoped method (organization/users/apiKeys/invitations,
 * except `invitations.accept()`) calls this to resolve which org id to put
 * in its request path — an explicit argument always wins, falling back to
 * `config.organizationId` (set at `createClient()` time or later via
 * `klap.setOrganizationId()`) when omitted.
 */
export function resolveOrganizationId(
  config: HttpConfig,
  context: string,
  explicit?: string,
): string {
  const organizationId = explicit ?? config.organizationId
  if (!organizationId) throw new MissingCredentialError('organizationId', context)
  return organizationId
}

function resolveAuthHeader(config: HttpConfig, options: RequestOptions): string | undefined {
  const auth = options.auth ?? 'apiKey'
  if (auth === 'none') return undefined

  if (auth === 'apiKey') {
    if (!config.apiKey) throw new MissingCredentialError('apiKey', options.path)
    return `Bearer ${config.apiKey}`
  }

  if (!config.sessionToken) throw new MissingCredentialError('sessionToken', options.path)
  return `Bearer ${config.sessionToken}`
}

export async function request<T>(config: HttpConfig, options: RequestOptions): Promise<T> {
  const authHeader = resolveAuthHeader(config, options)
  const url = buildUrl(config.baseUrl, options.path, options.query)

  if (config.debug) console.debug('[klap-sdk]', options.method, url)

  const res = await fetch(url, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
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
