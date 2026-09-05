// src/app/api/households/[id]/join-code/route.ts
import { NextResponse } from 'next/server';
import { withAuthParams, dbErrorResponse, requireMembership, requireUuid } from '@/lib/supabase-server';

type Params = { id: string };

// POST /api/households/[id]/join-code - rotate the join code (admins only)
export const POST = withAuthParams<Params>(async (_request, { user, supabase, params }) => {
  const householdId = requireUuid(params.id, 'Household id');
  await requireMembership(supabase, householdId, user.id, { admin: true });

  const { data, error } = await supabase.rpc('web_regenerate_join_code', { p_household_id: householdId });
  if (error) return dbErrorResponse(error, 'Failed to regenerate join code');
  return NextResponse.json({ joinCode: data as string });
});
