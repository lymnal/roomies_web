// src/app/api/households/join/route.ts
import { NextResponse } from 'next/server';
import { withAuth, dbErrorResponse, readJson, HttpError } from '@/lib/supabase-server';
import { fetchHouseholdWithMembers } from '@/lib/queries';

// POST /api/households/join { code } - join a household with its invite code
export const POST = withAuth(async (request, { supabase }) => {
  const body = await readJson(request);
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{4,12}$/.test(code)) throw new HttpError(400, 'Enter the join code your roommate shared with you');

  const { data: householdId, error } = await supabase.rpc('join_household_by_code', { p_code: code });
  if (error) {
    if (error.code === 'P0002') return NextResponse.json({ error: 'That join code is not valid' }, { status: 404 });
    return dbErrorResponse(error, 'Failed to join household');
  }

  const household = await fetchHouseholdWithMembers(supabase, householdId as string, 'member');
  return NextResponse.json({ householdId, household });
});
