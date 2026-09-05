// src/app/api/expenses/[id]/route.ts
import { NextResponse } from 'next/server';
import { withAuthParams, errorResponse, dbErrorResponse, readJson, requireUuid } from '@/lib/supabase-server';
import { fetchExpense } from '@/lib/queries';
import { parseExpenseInput } from '@/lib/validation';

type Params = { id: string };

// GET /api/expenses/[id]
export const GET = withAuthParams<Params>(async (_request, { supabase, params }) => {
  const expenseId = requireUuid(params.id, 'Expense id');
  // RLS only returns expenses from households the caller belongs to.
  const expense = await fetchExpense(supabase, expenseId);
  if (!expense) return errorResponse('Expense not found', 404);
  return NextResponse.json(expense);
});

// PATCH /api/expenses/[id] - edit; previous ledger entries are reversed and re-posted
export const PATCH = withAuthParams<Params>(async (request, { user, supabase, params }) => {
  const expenseId = requireUuid(params.id, 'Expense id');
  const current = await fetchExpense(supabase, expenseId);
  if (!current) return errorResponse('Expense not found', 404);

  const body = await readJson(request);
  const input = parseExpenseInput(
    { ...body, householdId: current.householdId },
    { householdId: current.householdId, paidBy: current.paidBy, date: current.date }
  );

  const { error } = await supabase.rpc('web_update_expense', {
    p_expense_id: expenseId,
    p_description: input.title,
    p_amount: input.amount,
    p_date: input.date,
    p_paid_by: input.paidBy,
    p_splits: input.splits.map((s) => ({ user_id: s.userId, amount: s.amount })),
  });
  if (error) return dbErrorResponse(error, 'Failed to update expense');

  const updated = await fetchExpense(supabase, expenseId);
  if (!updated) return errorResponse('Expense was updated but could not be loaded', 500);
  void user;
  return NextResponse.json(updated);
});

// PUT behaves like PATCH so older clients keep working.
export const PUT = PATCH;

// DELETE /api/expenses/[id]
export const DELETE = withAuthParams<Params>(async (_request, { supabase, params }) => {
  const expenseId = requireUuid(params.id, 'Expense id');
  const { error } = await supabase.rpc('web_delete_expense', { p_expense_id: expenseId });
  if (error) return dbErrorResponse(error, 'Failed to delete expense');
  return NextResponse.json({ message: 'Expense deleted', id: expenseId });
});
