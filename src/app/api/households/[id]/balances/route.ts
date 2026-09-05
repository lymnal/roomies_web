// src/app/api/households/[id]/balances/route.ts
import { NextResponse } from 'next/server';
import { withAuthParams, dbErrorResponse, requireMembership, requireUuid } from '@/lib/supabase-server';
import { toBalance, type BalanceRow } from '@/lib/serializers';

type Params = { id: string };

// GET /api/households/[id]/balances - ledger balances (expenses and settlements) per member
export const GET = withAuthParams<Params>(async (_request, { user, supabase, params }) => {
  const householdId = requireUuid(params.id, 'Household id');
  await requireMembership(supabase, householdId, user.id);

  const { data, error } = await supabase.rpc('get_household_balances_simple', { p_household_id: householdId });
  if (error) return dbErrorResponse(error, 'Failed to fetch balances');

  const balances = ((data ?? []) as BalanceRow[]).map(toBalance).sort((a, b) => b.net - a.net);
  return NextResponse.json(balances);
});
