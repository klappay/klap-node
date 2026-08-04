import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KlapApiError, MissingCredentialError } from './errors'
import { request, resolveOrganizationId } from './http'

const baseConfig = { baseUrl: 'https://api.example.com' }

describe('resolveOrganizationId', () => {
  it('prefers an explicit id over the configured default', () => {
    const config = { ...baseConfig, organizationId: 'org_default' }
    expect(resolveOrganizationId(config, 'test', 'org_explicit')).toBe('org_explicit')
  })

  it('falls back to the configured default when no explicit id is passed', () => {
    const config = { ...baseConfig, organizationId: 'org_default' }
    expect(resolveOrganizationId(config, 'test', undefined)).toBe('org_default')
  })

  it('throws MissingCredentialError when neither is set', () => {
    expect(() => resolveOrganizationId(baseConfig, 'test.method()', undefined)).toThrow(
      MissingCredentialError,
    )
  })
})

describe('request()', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds the URL from baseUrl + path with no query string when none is given', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    await request({ ...baseConfig, apiKey: 'k' }, { method: 'GET', path: '/v1/charges/ch_1' })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.com/v1/charges/ch_1')
  })

  it('appends query params, skipping any that are undefined', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    await request(
      { ...baseConfig, apiKey: 'k' },
      {
        method: 'GET',
        path: '/v1/charges',
        query: { limit: 20, cursor: undefined, status: 'pending' },
      },
    )

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string)
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.has('cursor')).toBe(false)
    expect(url.searchParams.get('status')).toBe('pending')
  })

  it('defaults to apiKey auth, sent as a Bearer token', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    await request({ ...baseConfig, apiKey: 'klap_test_key' }, { method: 'GET', path: '/v1/x' })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { headers: Record<string, string> }
    expect(init.headers.Authorization).toBe('Bearer klap_test_key')
  })

  it('throws MissingCredentialError instead of calling fetch when apiKey auth is required but absent', async () => {
    await expect(request(baseConfig, { method: 'GET', path: '/v1/x' })).rejects.toThrow(
      MissingCredentialError,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses sessionToken auth when requested', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    await request(
      { ...baseConfig, sessionToken: 'sess_abc' },
      { method: 'GET', path: '/v1/x', auth: 'sessionToken' },
    )

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { headers: Record<string, string> }
    expect(init.headers.Authorization).toBe('Bearer sess_abc')
  })

  it('throws MissingCredentialError when sessionToken auth is required but absent', async () => {
    await expect(
      request(baseConfig, { method: 'GET', path: '/v1/x', auth: 'sessionToken' }),
    ).rejects.toThrow(MissingCredentialError)
  })

  it('sends no Authorization header when auth is "none"', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    await request(baseConfig, { method: 'POST', path: '/v1/auth/login', auth: 'none' })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { headers: Record<string, string> }
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('JSON-stringifies the body when one is given, and omits it entirely when not', async () => {
    fetchMock.mockImplementation(() => new Response(JSON.stringify({}), { status: 200 }))
    await request(
      { ...baseConfig, apiKey: 'k' },
      { method: 'POST', path: '/v1/x', body: { foo: 'bar' } },
    )
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ foo: 'bar' }))

    fetchMock.mockClear()
    await request({ ...baseConfig, apiKey: 'k' }, { method: 'GET', path: '/v1/x' })
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined()
  })

  it('returns undefined for a 204 response without reading the body', async () => {
    const res = new Response(null, { status: 204 })
    const jsonSpy = vi.spyOn(res, 'json')
    fetchMock.mockResolvedValue(res)

    const result = await request(
      { ...baseConfig, apiKey: 'k' },
      { method: 'DELETE', path: '/v1/x' },
    )

    expect(result).toBeUndefined()
    expect(jsonSpy).not.toHaveBeenCalled()
  })

  it('returns the parsed JSON body on success', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'ch_1' }), { status: 200 }))
    const result = await request({ ...baseConfig, apiKey: 'k' }, { method: 'GET', path: '/v1/x' })
    expect(result).toEqual({ id: 'ch_1' })
  })

  it('throws a KlapApiError built from the parsed error payload on a non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'charge_not_found', message: 'No such charge', param: 'id' },
        }),
        { status: 404 },
      ),
    )

    const err: unknown = await request(
      { ...baseConfig, apiKey: 'k' },
      { method: 'GET', path: '/v1/charges/nope' },
    ).catch((e) => e)

    expect(err).toBeInstanceOf(KlapApiError)
    expect(err).toMatchObject({
      status: 404,
      code: 'charge_not_found',
      message: 'No such charge',
      param: 'id',
    })
  })

  it('falls back to a generic KlapApiError when the error body does not match the expected shape', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ nope: true }), { status: 500 }))

    const err: unknown = await request(
      { ...baseConfig, apiKey: 'k' },
      { method: 'GET', path: '/v1/x' },
    ).catch((e) => e)

    expect(err).toBeInstanceOf(KlapApiError)
    expect(err).toMatchObject({ status: 500, code: 'unknown_error', message: 'Request failed' })
  })

  it('logs method + URL to console.debug only when config.debug is true', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    fetchMock.mockImplementation(() => new Response(JSON.stringify({}), { status: 200 }))

    await request({ ...baseConfig, apiKey: 'k', debug: true }, { method: 'GET', path: '/v1/x' })
    expect(debugSpy).toHaveBeenCalledWith('[klap-sdk]', 'GET', 'https://api.example.com/v1/x')

    debugSpy.mockClear()
    await request({ ...baseConfig, apiKey: 'k' }, { method: 'GET', path: '/v1/x' })
    expect(debugSpy).not.toHaveBeenCalled()

    debugSpy.mockRestore()
  })

  it('aborts after the configured timeoutMs, defaulting to 30s', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
    fetchMock.mockImplementation(() => new Response(JSON.stringify({}), { status: 200 }))

    await request({ ...baseConfig, apiKey: 'k' }, { method: 'GET', path: '/v1/x' })
    expect(timeoutSpy).toHaveBeenCalledWith(30_000)

    timeoutSpy.mockClear()
    await request(
      { ...baseConfig, apiKey: 'k', timeoutMs: 5_000 },
      { method: 'GET', path: '/v1/x' },
    )
    expect(timeoutSpy).toHaveBeenCalledWith(5_000)

    timeoutSpy.mockRestore()
  })
})
