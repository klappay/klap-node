import type { AuthResponse, Invitation } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MissingCredentialError } from './errors'
import { createInvitationsClient } from './invitations'

vi.mock('./http', async () => {
  const actual = await vi.importActual<typeof import('./http')>('./http')
  return { ...actual, request: vi.fn() }
})

const { request } = await import('./http')
const requestMock = vi.mocked(request)

const FAKE_INVITATION: Invitation = {
  id: 'inv_1',
  organizationId: 'org_1',
  email: 'new@example.com',
  role: 'member',
  invitedByUserId: 'usr_1',
  expiresAt: '2026-01-08T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const FAKE_AUTH_RESPONSE: AuthResponse = {
  token: 'jwt_token',
  user: { id: 'usr_2', email: 'new@example.com', name: null, emailVerifiedAt: null },
}

beforeEach(() => {
  requestMock.mockReset()
})

describe('createInvitationsClient().invite()', () => {
  it('scopes to the given organization, defaults role omitted, uses sessionToken auth', async () => {
    requestMock.mockResolvedValue(FAKE_INVITATION)
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

    await createInvitationsClient(config).invite('org_1', { email: 'new@example.com' })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/organizations/org_1/invitations',
      body: { email: 'new@example.com' },
      auth: 'sessionToken',
    })
  })

  it('falls back to the configured default organizationId', async () => {
    requestMock.mockResolvedValue(FAKE_INVITATION)
    const config = {
      baseUrl: 'https://api.example.com',
      sessionToken: 'sess_1',
      organizationId: 'org_default',
    }

    await createInvitationsClient(config).invite(undefined, { email: 'x@example.com' })

    expect(requestMock.mock.calls[0]?.[1].path).toBe('/v1/organizations/org_default/invitations')
  })

  it('throws when no organizationId is available', async () => {
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }
    await expect(
      createInvitationsClient(config).invite(undefined, { email: 'x@example.com' }),
    ).rejects.toThrow(MissingCredentialError)
    expect(requestMock).not.toHaveBeenCalled()
  })
})

describe('createInvitationsClient().revoke()', () => {
  it('deletes the invitation under the resolved organization', async () => {
    requestMock.mockResolvedValue(undefined)
    const config = { baseUrl: 'https://api.example.com', sessionToken: 'sess_1' }

    await createInvitationsClient(config).revoke('org_1', 'inv_1')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'DELETE',
      path: '/v1/organizations/org_1/invitations/inv_1',
      auth: 'sessionToken',
    })
  })
})

describe('createInvitationsClient().accept()', () => {
  it('posts to the public accept endpoint with no auth and no organization needed', async () => {
    requestMock.mockResolvedValue(FAKE_AUTH_RESPONSE)
    const config = { baseUrl: 'https://api.example.com' }

    const result = await createInvitationsClient(config).accept({ token: 'invite_token' })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/invitations/accept',
      body: { token: 'invite_token' },
      auth: 'none',
    })
    expect(result).toEqual(FAKE_AUTH_RESPONSE)
  })
})
