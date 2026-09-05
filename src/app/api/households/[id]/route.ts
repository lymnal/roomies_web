// src/app/api/households/[id]/route.ts
import { NextResponse } from 'next/server';
import {
  withAuthParams,
  errorResponse,
  dbErrorResponse,
  readJson,
  requireMembership,
  requireUuid,
  HttpError,
} from '@/lib/supabase-server';
import { HOUSEHOLD_SELECT, toHousehold, type HouseholdRow } from '@/lib/serializers';
import { countRows, fetchHouseholdWithMembers } from '@/lib/queries';

type Params = { id: string };

// GET /api/households/[id] - household details with members
export const GET = withAuthParams<Params>(async (_request, { user, supabase, params }) => {
  const householdId = requireUuid(params.id, 'Household id');
  const membership = await requireMembership(supabase, householdId, user.id);
  const household = await fetchHouseholdWithMembers(supabase, householdId, membership.role);
  if (!household) return errorResponse('Household not found', 404);
  return NextResponse.json(household);
});

// PATCH /api/households/[id] - rename / change address (admins only)
export const PATCH = withAuthParams<Params>(async (request, { user, supabase, params }) => {
  const householdId = requireUuid(params.id, 'Household id');
  await requireMembership(supabase, householdId, user.id, { admin: true });

  const body = await readJson(request);
  const update: { name?: string; address?: string | null; updated_at: string } = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new HttpError(400, 'Household name cannot be empty');
    if (name.length > 100) throw new HttpError(400, 'Household name must be 100 characters or fewer');
    update.name = name;
  }
  if (body.address !== undefined) {
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    if (address.length > 200) throw new HttpError(400, 'Address must be 200 characters or fewer');
    update.address = address || null;
  }
  if (update.name === undefined && update.address === undefined) {
    throw new HttpError(400, 'Nothing to update');
  }

  const { data, error } = await supabase
    .from('households')
    .update(update)
    .eq('id', householdId)
    .select(HOUSEHOLD_SELECT)
    .maybeSingle();
  if (error) return dbErrorResponse(error, 'Failed to update household');
  if (!data) return errorResponse('Household not found', 404);
  return NextResponse.json(toHousehold(data as unknown as HouseholdRow, 'admin'));
});

// PUT behaves like PATCH so older clients keep working.
export const PUT = PATCH;

// DELETE /api/households/[id] - only an admin who is the last remaining member may delete
export const DELETE = withAuthParams<Params>(async (_request, { user, supabase, params }) => {
  const householdId = requireUuid(params.id, 'Household id');
  await requireMembership(supabase, householdId, user.id, { admin: true });

  const memberCount = await countRows(supabase, 'household_members', { household_id: householdId });
  if (memberCount > 1) {
    return errorResponse(
      `This household still has ${memberCount} members. Remove the other members before deleting it.`,
      400
    );
  }

  // Members, expenses, splits, settlements, ledger entries, tasks, messages and invitations cascade.
  const { error } = await supabase.from('households').delete().eq('id', householdId);
  if (error) return dbErrorResponse(error, 'Failed to delete household');
  return NextResponse.json({ message: 'Household deleted', id: householdId });
});
