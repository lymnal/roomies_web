// src/app/api/payments/mark-complete/route.ts
// Record a direct settlement between two members (e.g. "Alex paid Sam $20"). Goes through
// create_settlement_simple so the ledger balances move.
import { NextResponse } from 'next/server';
import { withAuth, errorResponse, dbErrorResponse, readJson, requireMembership, isUuid, HttpError } from '@/lib/supabase-server';
import { roundCents } from '@/lib/utils';

interface SettlementResult {
  success: boolean;
  error?: string;
  settlement_id?: string;
}

// POST /api/payments/mark-complete { householdId, fromUserId, toUserId, amount, description? }
export const POST = withAuth(async (request, { user, supabase }) => {
  const body = await readJson(request);
  const householdId = body.householdId ?? body.household_id;
  const fromUserId = body.fromUserId ?? body.payerId;
  const toUserId = body.toUserId ?? body.payeeId;
  const amount = roundCents(typeof body.amount === 'number' ? body.amount : Number(body.amount));
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 200) : '';

  if (!isUuid(householdId)) throw new HttpError(400, 'householdId is required');
  if (!isUuid(fromUserId) || !isUuid(toUserId)) throw new HttpError(400, 'fromUserId and toUserId are required');
  if (fromUserId === toUserId) throw new HttpError(400, 'Payer and payee must be different people');
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Amount must be a positive number');

  const membership = await requireMembership(supabase, householdId, user.id);
  if (user.id !== fromUserId && user.id !== toUserId && membership.role !== 'admin') {
    throw new HttpError(403, 'You can only record payments you made or received');
  }

  const { data, error } = await supabase.rpc('create_settlement_simple', {
    p_household_id: householdId,
    p_payer_id: fromUserId,
    p_payee_id: toUserId,
    p_amount: amount,
    p_description: description || 'Settlement payment',
  });
  if (error) return dbErrorResponse(error, 'Failed to record payment');

  const result = data as SettlementResult;
  if (!result?.success) return errorResponse(result?.error ?? 'Failed to record payment', 400);

  return NextResponse.json({ message: 'Payment recorded', settlementId: result.settlement_id, amount });
});
