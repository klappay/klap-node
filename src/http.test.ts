import { describe, expect, it } from 'vitest'
import { MissingCredentialError } from './errors'
import { resolveOrganizationId } from './http'

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
