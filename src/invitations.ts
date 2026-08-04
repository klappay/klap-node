import type {
  AcceptInvitationInput,
  AuthResponse,
  Invitation,
  InviteUserInput,
} from '@klappay/types'
import { type HttpConfig, request, resolveOrganizationId } from './http'

export function createInvitationsClient(config: HttpConfig) {
  return {
    async invite(organizationId: string | undefined, input: InviteUserInput): Promise<Invitation> {
      const id = resolveOrganizationId(config, 'invitations.invite()', organizationId)
      return request<Invitation>(config, {
        method: 'POST',
        path: `/v1/organizations/${id}/invitations`,
        body: input,
        auth: 'sessionToken',
      })
    },

    async revoke(organizationId: string | undefined, invitationId: string): Promise<void> {
      const id = resolveOrganizationId(config, 'invitations.revoke()', organizationId)
      return request<void>(config, {
        method: 'DELETE',
        path: `/v1/organizations/${id}/invitations/${invitationId}`,
        auth: 'sessionToken',
      })
    },

    async accept(input: AcceptInvitationInput): Promise<AuthResponse> {
      return request<AuthResponse>(config, {
        method: 'POST',
        path: '/v1/invitations/accept',
        body: input,
        auth: 'none',
      })
    },
  }
}
