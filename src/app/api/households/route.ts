// src/app/api/households/route.ts
import { NextResponse } from 'next/server';
import { withAuth, errorResponse, dbErrorResponse, readJson, HttpError } from '@/lib/supabase-server';
import { HOUSEHOLD_SELECT, one, toHousehold, type HouseholdRow } from '@/lib/serializers';
import { countRows, fetchHouseholdWithMembers } from '@/lib/queries';
import type { HouseholdRole, HouseholdSummary } from '@/types';

interface MembershipRow {
  role: string;
  joined_at: string;
  household: HouseholdRow | HouseholdRow[] | null;
}

// GET /api/households - every household the user belongs to, with a few counts
export const GET = withAuth(async (_request, { user, supabase }) => {
  const { data, error } = await supabase
    .from('household_members')
    .select(`role, joined_at, household:households!household_id(${HOUSEHOLD_SELECT})`)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  if (error) return dbErrorResponse(error, 'Failed to fetch households');

  const summaries: HouseholdSummary[] = await Promise.all(
    ((data ?? []) as unknown as MembershipRow[])
      .map((row) => ({ row, household: one(row.household) }))
      .filter((x): x is { row: MembershipRow; household: HouseholdRow } => Boolean(x.household))
      .map(async ({ row, household }) => {
        const role: HouseholdRole = row.role === 'admin' ? 'admin' : 'member';
        const [memberCount, expenseCount, taskCount, messageCount] = await Promise.all([
          countRows(supabase, 'household_members', { household_id: household.id }),
          countRows(supabase, 'expenses', { household_id: household.id }),
          countRows(supabase, 'tasks', { household_id: household.id }, (q) => q.in('status', ['PENDING', 'IN_PROGRESS'])),
          countRows(supabase, 'messages', { household_id: household.id }),
        ]);
        return {
          ...toHousehold(household, role),
          role,
          joinedAt: row.joined_at,
          memberCount,
          expenseCount,
          taskCount,
          messageCount,
        };
      })
  );

  return NextResponse.json(summaries);
});

// POST /api/households - create a household; the creator becomes its admin
export const POST = withAuth(async (request, { supabase }) => {
  const body = await readJson(request);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!name) throw new HttpError(400, 'Household name is required');
  if (name.length > 100) throw new HttpError(400, 'Household name must be 100 characters or fewer');
  if (address.length > 200) throw new HttpError(400, 'Address must be 200 characters or fewer');

  const { data: householdId, error } = await supabase.rpc('web_create_household', {
    p_name: name,
    p_address: address || null,
  });
  if (error) return dbErrorResponse(error, 'Failed to create household');

  const household = await fetchHouseholdWithMembers(supabase, householdId as string, 'admin');
  if (!household) return errorResponse('Household was created but could not be loaded', 500);
  return NextResponse.json(household, { status: 201 });
});
