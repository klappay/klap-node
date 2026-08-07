import type { AuthResponse, MessageResponse, SelfUser } from '@klappay/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthClient } from './auth'

vi.mock('./http', () => ({ request: vi.fn() }))

const { request } = await import('./http')
const requestMock = vi.mocked(request)

const config = { baseUrl: 'https://api.example.com' }

const FAKE_AUTH_RESPONSE: AuthResponse = {
  token: 'jwt_token',
  user: { id: 'usr_1', email: 'a@example.com', name: null, emailVerifiedAt: null },
}

const FAKE_MESSAGE: MessageResponse = { message: 'ok' }

beforeEach(() => {
  requestMock.mockReset()
})

describe('createAuthClient()', () => {
  it('signup() posts to /auth/signup with no auth required', async () => {
    requestMock.mockResolvedValue(FAKE_AUTH_RESPONSE)
    const result = await createAuthClient(config).signup({
      email: 'a@example.com',
      password: 'password123',
    })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/auth/signup',
      body: { email: 'a@example.com', password: 'password123' },
      auth: 'none',
    })
    expect(result).toEqual(FAKE_AUTH_RESPONSE)
  })

  it('login() posts to /auth/login with no auth required', async () => {
    requestMock.mockResolvedValue(FAKE_AUTH_RESPONSE)
    await createAuthClient(config).login({ email: 'a@example.com', password: 'password123' })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/auth/login',
      body: { email: 'a@example.com', password: 'password123' },
      auth: 'none',
    })
  })

  it('logout() posts to /auth/logout with sessionToken auth and no body', async () => {
    requestMock.mockResolvedValue(undefined)
    await createAuthClient(config).logout()

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/auth/logout',
      auth: 'sessionToken',
    })
  })

  it('verifyEmail() posts the token as the body with no auth required', async () => {
    requestMock.mockResolvedValue(FAKE_MESSAGE)
    await createAuthClient(config).verifyEmail('verify_token')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/auth/verify-email',
      body: { token: 'verify_token' },
      auth: 'none',
    })
  })

  it('resendVerificationEmail() posts with sessionToken auth and no body', async () => {
    requestMock.mockResolvedValue(FAKE_MESSAGE)
    await createAuthClient(config).resendVerificationEmail()

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/auth/resend-verification',
      auth: 'sessionToken',
    })
  })

  it('forgotPassword() posts to /auth/forgot-password with no auth required', async () => {
    requestMock.mockResolvedValue(FAKE_MESSAGE)
    await createAuthClient(config).forgotPassword({ email: 'a@example.com' })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/auth/forgot-password',
      body: { email: 'a@example.com' },
      auth: 'none',
    })
  })

  it('resetPassword() posts to /auth/reset-password with no auth required', async () => {
    requestMock.mockResolvedValue(FAKE_MESSAGE)
    await createAuthClient(config).resetPassword({
      token: 'reset_token',
      newPassword: 'newpassword123',
    })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/auth/reset-password',
      body: { token: 'reset_token', newPassword: 'newpassword123' },
      auth: 'none',
    })
  })

  it('updateName() patches /auth/me with sessionToken auth', async () => {
    const FAKE_SELF_USER: SelfUser = {
      id: 'usr_1',
      email: 'a@example.com',
      name: 'Ada',
      emailVerifiedAt: null,
    }
    requestMock.mockResolvedValue(FAKE_SELF_USER)

    const result = await createAuthClient(config).updateName({ name: 'Ada' })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'PATCH',
      path: '/v1/auth/me',
      body: { name: 'Ada' },
      auth: 'sessionToken',
    })
    expect(result).toEqual(FAKE_SELF_USER)
  })

  it('changePassword() posts to /auth/change-password with sessionToken auth and returns a fresh AuthResponse', async () => {
    requestMock.mockResolvedValue(FAKE_AUTH_RESPONSE)

    const result = await createAuthClient(config).changePassword({
      currentPassword: 'oldpassword123',
      newPassword: 'newpassword123',
    })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/auth/change-password',
      body: { currentPassword: 'oldpassword123', newPassword: 'newpassword123' },
      auth: 'sessionToken',
    })
    expect(result).toEqual(FAKE_AUTH_RESPONSE)
  })

  it('changeEmail() posts to /auth/change-email with sessionToken auth', async () => {
    requestMock.mockResolvedValue(FAKE_MESSAGE)

    await createAuthClient(config).changeEmail({
      currentPassword: 'password123',
      newEmail: 'new@example.com',
    })

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/auth/change-email',
      body: { currentPassword: 'password123', newEmail: 'new@example.com' },
      auth: 'sessionToken',
    })
  })

  it('confirmEmailChange() posts the token as the body with no auth required', async () => {
    requestMock.mockResolvedValue(FAKE_MESSAGE)

    await createAuthClient(config).confirmEmailChange('change_token')

    expect(requestMock).toHaveBeenCalledWith(config, {
      method: 'POST',
      path: '/v1/auth/confirm-email-change',
      body: { token: 'change_token' },
      auth: 'none',
    })
  })
})
