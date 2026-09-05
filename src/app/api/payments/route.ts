// src/app/api/payments/route.ts
// "Payments" are the caller's shares of other people's expenses (expense_splits rows).
import { NextResponse } from 'next/server';
import { withAuth, dbErrorResponse, isUuid } from '@/lib/supabase-server';
import { one, type ProfileRow } from '@/lib/serializers';

interface ShareRow {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number | string;
  settled: boolean | null;
  settled_at: string | null;
  created_at: string;
  expense:
    | {
        id: string;
        description: string;
        amount: number | string;
        date: string;
        household_id: string;
        paid_by: string;
        paid_by_user: ProfileRow | ProfileRow[] | null;
      }
    | null;
}

// GET /api/payments?status=pending|completed&householdId=...
export const GET = withAuth(async (request, { user, supabase }) => {
  const params = request.nextUrl.searchParams;
  const status = params.get('status')?.toLowerCase() ?? null;
  const householdId = params.get('householdId') ?? params.get('household_id');

  let query = supabase
    .from('expense_splits')
    .select(
      `id, expense_id, user_id, amount, settled, settled_at, created_at,
       expense:expenses!inner(id, description, amount, date, household_id, paid_by, paid_by_user:profiles!paid_by(id, name, avatar_url))`
    )
    .eq('user_id', user.id)
    .neq('expense.paid_by', user.id)
    .order('settled', { ascending: true })
    .order('created_at', { ascending: false });

  if (status === 'pending') query = query.eq('settled', false);
  if (status === 'completed' || status === 'settled') query = query.eq('settled', true);
  if (isUuid(householdId)) query = query.eq('expense.household_id', householdId);

  const { data, error } = await query;
  if (error) return dbErrorResponse(error, 'Failed to fetch payments');

  const payments = ((data ?? []) as unknown as ShareRow[]).map((row) => {
    const payer = one(row.expense?.paid_by_user ?? null);
    return {
      id: row.id,
      expenseId: row.expense_id,
      userId: row.user_id,
      amount: Number(row.amount),
      status: row.settled ? 'COMPLETED' : 'PENDING',
      date: row.settled_at,
      createdAt: row.created_at,
      expense: row.expense
        ? {
            id: row.expense.id,
            title: row.expense.description,
            amount: Number(row.expense.amount),
            date: row.expense.date,
            householdId: row.expense.household_id,
            paidBy: row.expense.paid_by,
            paidByName: payer?.name ?? 'Unknown',
          }
        : null,
    };
  });

  return NextResponse.json(payments);
});
