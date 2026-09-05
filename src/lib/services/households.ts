// src/lib/services/households.ts — client-side calls for households and members
import { apiFetch } from '@/lib/api-client';
import type { DashboardSummary, Household, HouseholdRole, HouseholdSummary, Member } from '@/types';

export function fetchHouseholds(): Promise<HouseholdSummary[]> {
  return apiFetch<HouseholdSummary[]>('/api/households');
}

export function createHousehold(input: { name: string; address?: string }): Promise<Household> {
  return apiFetch<Household>('/api/households', { method: 'POST', json: input });
}

export function joinHousehold(code: string): Promise<{ householdId: string; household: Household | null }> {
  return apiFetch('/api/households/join', { method: 'POST', json: { code } });
}

export function fetchHousehold(householdId: string): Promise<Household> {
  return apiFetch<Household>(`/api/households/${householdId}`);
}

export function updateHousehold(householdId: string, input: { name?: string; address?: string | null }): Promise<Household> {
  return apiFetch<Household>(`/api/households/${householdId}`, { method: 'PATCH', json: input });
}

export function deleteHousehold(householdId: string): Promise<{ message: string }> {
  return apiFetch(`/api/households/${householdId}`, { method: 'DELETE' });
}

export function fetchMembers(householdId: string): Promise<Member[]> {
  return apiFetch<Member[]>(`/api/households/${householdId}/members`);
}

export function updateMemberRole(householdId: string, userId: string, role: HouseholdRole): Promise<Member> {
  return apiFetch<Member>(`/api/households/${householdId}/members?userId=${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    json: { role },
  });
}

export function removeMember(householdId: string, userId: string): Promise<{ message: string }> {
  return apiFetch(`/api/households/${householdId}/members?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export function fetchSummary(householdId: string): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>(`/api/households/${householdId}/summary`);
}

export function regenerateJoinCode(householdId: string): Promise<{ joinCode: string }> {
  return apiFetch(`/api/households/${householdId}/join-code`, { method: 'POST' });
}
