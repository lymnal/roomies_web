// src/lib/services/invitations.ts — client-side calls for invitations
import { apiFetch } from '@/lib/api-client';
import type { HouseholdRole, Invitation } from '@/types';

export function fetchMyInvitations(): Promise<Invitation[]> {
  return apiFetch<Invitation[]>('/api/invitations?status=pending');
}

export function fetchHouseholdInvitations(householdId: string): Promise<Invitation[]> {
  return apiFetch<Invitation[]>(`/api/invitations?householdId=${encodeURIComponent(householdId)}&status=pending`);
}

export interface CreateInvitationResult {
  invitation: Invitation;
  invitationLink: string;
  emailSent: boolean;
}

export function createInvitation(input: {
  householdId: string;
  email: string;
  role: HouseholdRole;
  message?: string;
}): Promise<CreateInvitationResult> {
  return apiFetch<CreateInvitationResult>('/api/invitations', { method: 'POST', json: input });
}

export function respondToInvitation(
  invitationId: string,
  status: 'accepted' | 'declined'
): Promise<{ message: string; householdId: string; redirectTo: string }> {
  return apiFetch(`/api/invitations/${invitationId}`, { method: 'PATCH', json: { status } });
}

export function cancelInvitation(invitationId: string): Promise<{ message: string }> {
  return apiFetch(`/api/invitations/${invitationId}`, { method: 'DELETE' });
}

export function fetchInvitationByToken(token: string): Promise<Invitation> {
  return apiFetch<Invitation>(`/api/invitations/${encodeURIComponent(token)}`);
}

export interface TokenResponse {
  message: string;
  householdId?: string;
  householdName?: string | null;
  redirectTo?: string;
  requiresAuth?: boolean;
  email?: string;
}

export function respondByToken(
  token: string,
  action: 'accept' | 'decline',
  claimWithCurrentEmail = false
): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(`/api/invitations/${encodeURIComponent(token)}`, {
    method: 'POST',
    json: { action, claimWithCurrentEmail },
  });
}
