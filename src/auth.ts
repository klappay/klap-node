import type {
  AuthResponse,
  ChangeEmailInput,
  ChangeNameInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  MessageResponse,
  ResetPasswordInput,
  SelfUser,
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

    async updateName(input: ChangeNameInput): Promise<SelfUser> {
      return request<SelfUser>(config, {
        method: 'PATCH',
        path: '/v1/auth/me',
        body: input,
        auth: 'sessionToken',
      })
    },

    /** Returns a fresh session token — the old one goes stale immediately once the password changes. */
    async changePassword(input: ChangePasswordInput): Promise<AuthResponse> {
      return request<AuthResponse>(config, {
        method: 'POST',
        path: '/v1/auth/change-password',
        body: input,
        auth: 'sessionToken',
      })
    },

    /** Sends a confirmation token to your *current* email address — pass it to `confirmEmailChange()` to complete the change. */
    async changeEmail(input: ChangeEmailInput): Promise<MessageResponse> {
      return request<MessageResponse>(config, {
        method: 'POST',
        path: '/v1/auth/change-email',
        body: input,
        auth: 'sessionToken',
      })
    },

    async confirmEmailChange(token: string): Promise<MessageResponse> {
      return request<MessageResponse>(config, {
        method: 'POST',
        path: '/v1/auth/confirm-email-change',
        body: { token },
        auth: 'none',
      })
    },
  }
}
