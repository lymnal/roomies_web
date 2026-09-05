// src/app/api/households/[id]/members/route.ts
import { NextResponse } from 'next/server';
import {
  withAuthParams,
  errorResponse,
  dbErrorResponse,
  readJson,
  requireMembership,
  requireUuid,
  isUuid,
  HttpError,
} from '@/lib/supabase-server';
import { MEMBER_SELECT, toMember, type MemberRow } from '@/lib/serializers';
import { parseRole } from '@/lib/validation';
import { countRows } from '@/lib/queries';

type Params = { id: string };

// GET /api/households/[id]/members
export const GET = withAuthParams<Params>(async (_request, { user, supabase, params }) => {
  const householdId = requireUuid(params.id, 'Household id');
  await requireMembership(supabase, householdId, user.id);

  const { data, error } = await supabase
    .from('household_members')
    .select(MEMBER_SELECT)
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true });
  if (error) return dbErrorResponse(error, 'Failed to fetch household members');

  return NextResponse.json(((data ?? []) as unknown as MemberRow[]).map(toMember));
});

// PATCH /api/households/[id]/members?userId=... { role } - change a member's role (admins only)
export const PATCH = withAuthParams<Params>(async (request, { user, supabase, params }) => {
  const householdId = requireUuid(params.id, 'Household id');
  const targetUserId = request.nextUrl.searchParams.get('userId');
  if (!isUuid(targetUserId)) throw new HttpError(400, 'userId query parameter is required');

  await requireMembership(supabase, householdId, user.id, { admin: true });
  const body = await readJson(request);
  const role = parseRole(body.role);

  if (targetUserId === user.id && role !== 'admin') {
    const adminCount = await countRows(supabase, 'household_members', { household_id: householdId, role: 'admin' });
    if (adminCount <= 1) throw new HttpError(400, 'Make someone else an admin before stepping down');
  }

  const { data, error } = await supabase
    .from('household_members')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('user_id', targetUserId)
    .eq('household_id', householdId)
    .select(MEMBER_SELECT)
    .maybeSingle();
  if (error) return dbErrorResponse(error, 'Failed to update member role');
  if (!data) return errorResponse('That person is not a member of this household', 404);
  return NextResponse.json(toMember(data as unknown as MemberRow));
});

// DELETE /api/households/[id]/members?userId=... - remove a member (admins) or leave (self)
export const DELETE = withAuthParams<Params>(async (request, { user, supabase, params }) => {
  const householdId = requireUuid(params.id, 'Household id');
  const targetUserId = request.nextUrl.searchParams.get('userId') ?? user.id;
  if (!isUuid(targetUserId)) throw new HttpError(400, 'userId must be a valid id');

  const membership = await requireMembership(supabase, householdId, user.id);
  const isSelf = targetUserId === user.id;
  if (!isSelf && membership.role !== 'admin') {
    throw new HttpError(403, 'Only household admins can remove other members');
  }

  const { data: target, error: targetError } = await supabase
    .from('household_members')
    .select('id, role')
    .eq('user_id', targetUserId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (targetError) return dbErrorResponse(targetError, 'Failed to look up member');
  if (!target) return errorResponse('That person is not a member of this household', 404);

  if (target.role === 'admin') {
    const adminCount = await countRows(supabase, 'household_members', { household_id: householdId, role: 'admin' });
    if (adminCount <= 1) {
      return errorResponse(
        isSelf
          ? 'You are the only admin. Make someone else an admin (or delete the household) before leaving.'
          : 'Cannot remove the last admin. Make someone else an admin first.',
        400
      );
    }
  }

  const { error } = await supabase.from('household_members').delete().eq('id', target.id);
  if (error) return dbErrorResponse(error, 'Failed to remove member');
  return NextResponse.json({ message: isSelf ? 'You left the household' : 'Member removed', userId: targetUserId });
});
