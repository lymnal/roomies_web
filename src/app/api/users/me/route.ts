// src/app/api/users/me/route.ts
import { NextResponse } from 'next/server';
import { withAuth, errorResponse, dbErrorResponse, readJson, HttpError } from '@/lib/supabase-server';
import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/supabase-admin';
import { one } from '@/lib/serializers';
import { countRows } from '@/lib/queries';

interface MembershipRow {
  household_id: string;
  role: string;
  joined_at: string;
  household: { id: string; name: string; address: string | null; created_at: string } | { id: string; name: string; address: string | null; created_at: string }[] | null;
}

// GET /api/users/me - profile, households and a couple of stats
export const GET = withAuth(async (_request, { user, supabase }) => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, phone, created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) return dbErrorResponse(profileError, 'Failed to fetch profile');
  if (!profile) return errorResponse('Profile not found', 404);

  const [{ data: memberships, error: membershipsError }, expensesPaid, sharesOwed] = await Promise.all([
    supabase
      .from('household_members')
      .select('household_id, role, joined_at, household:households!household_id(id, name, address, created_at)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false }),
    countRows(supabase, 'expenses', { paid_by: user.id }),
    countRows(supabase, 'expense_splits', { user_id: user.id, settled: false }),
  ]);
  if (membershipsError) return dbErrorResponse(membershipsError, 'Failed to fetch households');

  return NextResponse.json({
    id: profile.id,
    name: profile.name,
    email: profile.email ?? user.email ?? null,
    avatar: profile.avatar_url ?? null,
    phone: profile.phone ?? null,
    createdAt: profile.created_at ?? user.created_at,
    statistics: { expensesPaid, unsettledShares: sharesOwed },
    households: ((memberships ?? []) as unknown as MembershipRow[])
      .map((m) => {
        const household = one(m.household);
        return household
          ? {
              id: household.id,
              name: household.name,
              address: household.address,
              createdAt: household.created_at,
              joinedAt: m.joined_at,
              role: m.role === 'admin' ? 'admin' : 'member',
            }
          : null;
      })
      .filter(Boolean),
  });
});

// PATCH /api/users/me { name?, phone? } - update the profile (avatar is uploaded client-side)
export const PATCH = withAuth(async (request, { user, supabase }) => {
  const body = await readJson(request);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new HttpError(400, 'Name cannot be empty');
    if (name.length > 100) throw new HttpError(400, 'Name must be 100 characters or fewer');
    update.name = name;
  }
  if (body.phone !== undefined) {
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (phone.length > 30) throw new HttpError(400, 'Phone must be 30 characters or fewer');
    update.phone = phone || null;
  }
  if (Object.keys(update).length === 1) throw new HttpError(400, 'Nothing to update');

  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)
    .select('id, name, email, avatar_url, phone')
    .maybeSingle();
  if (error) return dbErrorResponse(error, 'Failed to update profile');

  if (update.name) {
    // Keep auth metadata in sync so the sidebar (which reads user_metadata) matches.
    await supabase.auth.updateUser({ data: { name: update.name } });
  }
  return NextResponse.json({ id: data?.id, name: data?.name, email: data?.email, avatar: data?.avatar_url ?? null, phone: data?.phone ?? null });
});

// DELETE /api/users/me - delete the account.
// Financial history (splits, settlements, ledger rows) references the profile with NO ACTION, so a
// hard delete is impossible once the user has any. Instead: the database function detaches the user
// from households and anonymises the profile, then GoTrue soft-deletes the auth user (credentials
// scrubbed, cannot sign in again). The soft delete needs the service-role key.
export const DELETE = withAuth(async (_request, { user, supabase }) => {
  if (!hasSupabaseAdmin()) {
    return errorResponse('Account deletion is not configured on this server (SUPABASE_SERVICE_ROLE_KEY missing)', 501);
  }

  const { error } = await supabase.rpc('web_prepare_account_deletion');
  if (error) return dbErrorResponse(error, 'Failed to delete your account');

  const { error: deleteError } = await getSupabaseAdmin().auth.admin.deleteUser(user.id, true);
  if (deleteError) {
    console.error('[api] soft-deleting auth user failed:', deleteError);
    return errorResponse('Your profile was anonymised but the sign-in record could not be removed. Please contact support.', 500);
  }

  await supabase.auth.signOut();
  return NextResponse.json({ message: 'Your account has been deleted' });
});
