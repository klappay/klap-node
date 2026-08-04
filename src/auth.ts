import type {
  AuthResponse,
  ForgotPasswordInput,
  LoginInput,
  MessageResponse,
  ResetPasswordInput,
  SignupInput,
} from '@klappay/types'
import { type HttpConfig, request } from './http'

export function createAuthClient(config: HttpConfig) {
  return {
    async signup(input: SignupInput): Promise<AuthResponse> {
      return request<AuthResponse>(config, {
        method: 'POST',
        path: '/v1/auth/signup',
        body: input,
        auth: 'none',
      })
    },

    async login(input: LoginInput): Promise<AuthResponse> {
      return request<AuthResponse>(config, {
        method: 'POST',
        path: '/v1/auth/login',
        body: input,
        auth: 'none',
      })
    },

    async logout(): Promise<void> {
      return request<void>(config, {
        method: 'POST',
        path: '/v1/auth/logout',
        auth: 'sessionToken',
      })
    },

    async verifyEmail(token: string): Promise<MessageResponse> {
      return request<MessageResponse>(config, {
        method: 'POST',
        path: '/v1/auth/verify-email',
        body: { token },
        auth: 'none',
      })
    },

    async resendVerificationEmail(): Promise<MessageResponse> {
      return request<MessageResponse>(config, {
        method: 'POST',
        path: '/v1/auth/resend-verification',
        auth: 'sessionToken',
      })
    },

    async forgotPassword(input: ForgotPasswordInput): Promise<MessageResponse> {
      return request<MessageResponse>(config, {
        method: 'POST',
        path: '/v1/auth/forgot-password',
        body: input,
        auth: 'none',
      })
    },

    async resetPassword(input: ResetPasswordInput): Promise<MessageResponse> {
      return request<MessageResponse>(config, {
        method: 'POST',
        path: '/v1/auth/reset-password',
        body: input,
        auth: 'none',
      })
    },
  }
}
