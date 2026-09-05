// src/app/api/expenses/route.ts
import { NextResponse } from 'next/server';
import { withAuth, errorResponse, dbErrorResponse, readJson, requireMembership, isUuid } from '@/lib/supabase-server';
import { EXPENSE_SELECT, toExpense, type ExpenseRow } from '@/lib/serializers';
import { fetchExpense } from '@/lib/queries';
import { parseExpenseInput } from '@/lib/validation';

// GET /api/expenses?household_id=... - all expenses for a household, newest first
export const GET = withAuth(async (request, { user, supabase }) => {
  const params = request.nextUrl.searchParams;
  const householdId = params.get('household_id') ?? params.get('householdId');
  if (!isUuid(householdId)) return errorResponse('household_id is required', 400);

  await requireMembership(supabase, householdId, user.id);

  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('household_id', householdId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return dbErrorResponse(error, 'Failed to fetch expenses');
  return NextResponse.json(((data ?? []) as unknown as ExpenseRow[]).map(toExpense));
});

// POST /api/expenses - create an expense with its splits and ledger entries atomically
export const POST = withAuth(async (request, { user, supabase }) => {
  const body = await readJson(request);
  const input = parseExpenseInput(body, { paidBy: user.id });
  await requireMembership(supabase, input.householdId, user.id);

  const { data: expenseId, error } = await supabase.rpc('web_create_expense', {
    p_household_id: input.householdId,
    p_description: input.title,
    p_amount: input.amount,
    p_date: input.date,
    p_paid_by: input.paidBy,
    p_splits: input.splits.map((s) => ({ user_id: s.userId, amount: s.amount })),
  });
  if (error) return dbErrorResponse(error, 'Failed to create expense');

  const expense = await fetchExpense(supabase, expenseId as string);
  if (!expense) return errorResponse('Expense was created but could not be loaded', 500);
  return NextResponse.json(expense, { status: 201 });
});
