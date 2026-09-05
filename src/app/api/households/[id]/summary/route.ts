// src/app/api/households/[id]/summary/route.ts
import { NextResponse } from 'next/server';
import { withAuthParams, errorResponse, dbErrorResponse, requireMembership, requireUuid } from '@/lib/supabase-server';
import { HOUSEHOLD_SELECT, one, toBalance, toHousehold, type BalanceRow, type HouseholdRow, type ProfileRow } from '@/lib/serializers';
import { countRows } from '@/lib/queries';
import type { DashboardSummary } from '@/types';

type Params = { id: string };

interface PendingShareRow {
  amount: number | string;
}

interface UpcomingTaskRow {
  id: string;
  title: string;
  due_date: string | null;
  priority: DashboardSummary['upcomingTasks'][number]['priority'];
  status: DashboardSummary['upcomingTasks'][number]['status'];
  assignee: ProfileRow | ProfileRow[] | null;
}

// GET /api/households/[id]/summary - the numbers the dashboard shows
export const GET = withAuthParams<Params>(async (_request, { user, supabase, params }) => {
  const householdId = requireUuid(params.id, 'Household id');
  const membership = await requireMembership(supabase, householdId, user.id);

  const { data: householdRow, error: householdError } = await supabase
    .from('households')
    .select(HOUSEHOLD_SELECT)
    .eq('id', householdId)
    .maybeSingle();
  if (householdError) return dbErrorResponse(householdError, 'Failed to load household');
  if (!householdRow) return errorResponse('Household not found', 404);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [memberCount, pendingShares, myOpenTaskCount, upcoming, messagesToday, balances] = await Promise.all([
    countRows(supabase, 'household_members', { household_id: householdId }),
    supabase
      .from('expense_splits')
      .select('amount, expense:expenses!inner(household_id, paid_by)')
      .eq('user_id', user.id)
      .eq('settled', false)
      .eq('expense.household_id', householdId)
      .neq('expense.paid_by', user.id),
    countRows(supabase, 'tasks', { household_id: householdId, assignee_id: user.id }, (q) =>
      q.in('status', ['PENDING', 'IN_PROGRESS'])
    ),
    supabase
      .from('tasks')
      .select('id, title, due_date, priority, status, assignee:profiles!tasks_assignee_id_fkey(id, name, avatar_url)')
      .eq('household_id', householdId)
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(5),
    countRows(supabase, 'messages', { household_id: householdId }, (q) => q.gte('created_at', startOfToday.toISOString())),
    supabase.rpc('get_household_balances_simple', { p_household_id: householdId }),
  ]);

  const shares = ((pendingShares.data ?? []) as unknown as PendingShareRow[]).map((s) => Number(s.amount));
  const myBalance = ((balances.data ?? []) as BalanceRow[]).map(toBalance).find((b) => b.userId === user.id)?.net ?? 0;

  const summary: DashboardSummary = {
    household: toHousehold(householdRow as unknown as HouseholdRow, membership.role),
    role: membership.role,
    memberCount,
    myBalance,
    myPendingShares: {
      count: shares.length,
      total: Math.round(shares.reduce((sum, a) => sum + a, 0) * 100) / 100,
    },
    myOpenTaskCount,
    upcomingTasks: ((upcoming.data ?? []) as unknown as UpcomingTaskRow[]).map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.due_date,
      priority: t.priority,
      status: t.status,
      assigneeName: one(t.assignee)?.name ?? null,
    })),
    messagesToday,
  };

  return NextResponse.json(summary);
});
