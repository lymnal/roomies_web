// src/app/api/payments/[id]/route.ts
// Settle (or un-settle) one share of an expense. The RPC records a settlement + ledger entries so
// balances move; un-settling records the refund.
import { NextResponse } from 'next/server';
import { withAuthParams, errorResponse, dbErrorResponse, readJson, requireUuid } from '@/lib/supabase-server';

type Params = { id: string };

interface SettleResult {
  id: string;
  settled: boolean;
  settled_at: string | null;
  settlement_id: string | null;
  changed: boolean;
}

// PATCH /api/payments/[id] { status: 'COMPLETED' | 'PENDING' }
export const PATCH = withAuthParams<Params>(async (request, { supabase, params }) => {
  const splitId = requireUuid(params.id, 'Payment id');
  const body = await readJson(request);
  const status = typeof body.status === 'string' ? body.status.toUpperCase() : '';
  if (status !== 'COMPLETED' && status !== 'PENDING') {
    return errorResponse('status must be COMPLETED or PENDING', 400);
  }

  const { data, error } = await supabase.rpc('web_settle_split', { p_split_id: splitId, p_settled: status === 'COMPLETED' });
  if (error) return dbErrorResponse(error, 'Failed to update payment');

  const result = data as SettleResult;
  return NextResponse.json({
    id: result.id,
    status: result.settled ? 'COMPLETED' : 'PENDING',
    settled: result.settled,
    settledAt: result.settled_at,
    settlementId: result.settlement_id,
    changed: result.changed,
  });
});

// PUT behaves like PATCH so older clients keep working.
export const PUT = PATCH;
