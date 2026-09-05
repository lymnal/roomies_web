// src/lib/queries.ts
// Server-side read helpers shared by several routes. RLS still applies to the client passed in.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  EXPENSE_SELECT,
  HOUSEHOLD_SELECT,
  INVITATION_SELECT,
  MEMBER_SELECT,
  TASK_SELECT,
  toExpense,
  toHousehold,
  toInvitation,
  toTask,
  type ExpenseRow,
  type HouseholdRow,
  type InvitationRow,
  type TaskRow,
} from '@/lib/serializers';
import { HttpError, type HouseholdRole } from '@/lib/supabase-server';
import type { Expense, Household, Invitation, Task } from '@/types';

export async function fetchExpense(supabase: SupabaseClient, expenseId: string): Promise<Expense | null> {
  const { data, error } = await supabase.from('expenses').select(EXPENSE_SELECT).eq('id', expenseId).maybeSingle();
  if (error) {
    console.error('[api] fetchExpense failed:', error);
    throw new HttpError(500, 'Failed to load expense');
  }
  return data ? toExpense(data as unknown as ExpenseRow) : null;
}

export async function fetchTask(supabase: SupabaseClient, taskId: string): Promise<Task | null> {
  const { data, error } = await supabase.from('tasks').select(TASK_SELECT).eq('id', taskId).maybeSingle();
  if (error) {
    console.error('[api] fetchTask failed:', error);
    throw new HttpError(500, 'Failed to load task');
  }
  return data ? toTask(data as unknown as TaskRow) : null;
}

export async function fetchHouseholdWithMembers(
  supabase: SupabaseClient,
  householdId: string,
  viewerRole: HouseholdRole | null
): Promise<Household | null> {
  const { data, error } = await supabase
    .from('households')
    .select(`${HOUSEHOLD_SELECT}, members:household_members(${MEMBER_SELECT})`)
    .eq('id', householdId)
    .maybeSingle();
  if (error) {
    console.error('[api] fetchHousehold failed:', error);
    throw new HttpError(500, 'Failed to load household');
  }
  return data ? toHousehold(data as unknown as HouseholdRow, viewerRole) : null;
}

export async function fetchInvitationById(
  supabase: SupabaseClient,
  invitationId: string,
  options: { includeToken?: boolean } = {}
): Promise<Invitation | null> {
  const { data, error } = await supabase.from('invitations').select(INVITATION_SELECT).eq('id', invitationId).maybeSingle();
  if (error) {
    console.error('[api] fetchInvitationById failed:', error);
    throw new HttpError(500, 'Failed to load invitation');
  }
  return data ? toInvitation(data as unknown as InvitationRow, options) : null;
}

/** Exact row count with the given equality filters (head request, no payload). */
export async function countRows(
  supabase: SupabaseClient,
  table: string,
  filters: Record<string, string | boolean>,
  extra?: (q: ReturnType<ReturnType<SupabaseClient['from']>['select']>) => typeof q
): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  if (extra) query = extra(query);
  const { count, error } = await query;
  if (error) {
    console.error(`[api] count(${table}) failed:`, error);
    return 0;
  }
  return count ?? 0;
}
