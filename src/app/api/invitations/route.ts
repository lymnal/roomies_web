// src/app/api/invitations/route.ts
import { NextResponse } from 'next/server';
import { withAuth, errorResponse, dbErrorResponse, readJson, requireMembership, isUuid, HttpError } from '@/lib/supabase-server';
import { INVITATION_SELECT, one, toInvitation, type InvitationRow, type ProfileRow } from '@/lib/serializers';
import { parseInvitationInput } from '@/lib/validation';

const INVITATION_DAYS = 7;

function normaliseStatus(value: string | null): string {
  const status = (value ?? 'pending').toLowerCase();
  return status === 'declined' ? 'rejected' : status;
}

// GET /api/invitations?householdId=...&status=pending  (admins: a household's invitations)
// GET /api/invitations?status=pending                  (me: invitations sent to my email)
export const GET = withAuth(async (request, { user, supabase }) => {
  const params = request.nextUrl.searchParams;
  const householdId = params.get('householdId') ?? params.get('household_id');
  const status = normaliseStatus(params.get('status'));

  let query = supabase.from('invitations').select(INVITATION_SELECT).order('created_at', { ascending: false });
  let includeToken = false;

  if (householdId) {
    if (!isUuid(householdId)) return errorResponse('householdId must be a valid id', 400);
    await requireMembership(supabase, householdId, user.id, { admin: true });
    includeToken = true;
    query = query.eq('household_id', householdId);
  } else {
    if (!user.email) return NextResponse.json([]);
    query = query.eq('email', user.email.toLowerCase());
  }
  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return dbErrorResponse(error, 'Failed to fetch invitations');

  const now = Date.now();
  const invitations = ((data ?? []) as unknown as InvitationRow[])
    .map((row) => toInvitation(row, { includeToken }))
    // Expired-but-still-pending rows are cleaned up nightly; hide them in the meantime.
    .filter((inv) => !(inv.status === 'pending' && new Date(inv.expiresAt).getTime() < now));

  return NextResponse.json(invitations);
});

interface MemberEmailRow {
  user_id: string;
  user: ProfileRow | ProfileRow[] | null;
}

// POST /api/invitations - invite someone by email (admins only)
export const POST = withAuth(async (request, { user, supabase }) => {
  const body = await readJson(request);
  const input = parseInvitationInput(body);
  await requireMembership(supabase, input.householdId, user.id, { admin: true });

  // Already a member? (Profiles of fellow members are visible under RLS.)
  const { data: members, error: membersError } = await supabase
    .from('household_members')
    .select('user_id, user:profiles!user_id(id, name, email)')
    .eq('household_id', input.householdId);
  if (membersError) return dbErrorResponse(membersError, 'Failed to check household members');
  const alreadyMember = ((members ?? []) as unknown as MemberEmailRow[]).some(
    (m) => one(m.user)?.email?.toLowerCase() === input.email
  );
  if (alreadyMember) throw new HttpError(409, 'That person is already a member of this household');

  // A pending, unexpired invitation already exists?
  const { data: existing, error: existingError } = await supabase
    .from('invitations')
    .select('id')
    .eq('household_id', input.householdId)
    .eq('email', input.email)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (existingError) return dbErrorResponse(existingError, 'Failed to check existing invitations');
  if (existing) {
    return NextResponse.json(
      { error: 'An invitation has already been sent to this email for this household', invitationId: existing.id },
      { status: 409 }
    );
  }

  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      household_id: input.householdId,
      invited_by: user.id,
      email: input.email,
      role: input.role,
      message: input.message,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select(INVITATION_SELECT)
    .single();
  if (error) return dbErrorResponse(error, 'Failed to create invitation');

  const invitation = toInvitation(data as unknown as InvitationRow, { includeToken: true });
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || request.nextUrl.origin;
  const invitationLink = `${origin}/invite?token=${invitation.token}`;

  // Email delivery is not wired up; the admin shares the link directly.
  return NextResponse.json({ invitation, invitationLink, emailSent: false }, { status: 201 });
});
