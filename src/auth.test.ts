import type { AuthResponse, MessageResponse } from '@klappay/types'
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
})
