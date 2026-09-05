// src/app/api/invitations/[id]/route.ts
//
// One path, two identifiers:
//   GET  /api/invitations/<token>   public - look an invitation up from an invite link
//   POST /api/invitations/<token>   public - decline; accept needs a session
//   PATCH  /api/invitations/<id>    signed-in recipient accepts/declines from the dashboard
//   DELETE /api/invitations/<id>    household admin cancels
//
// The token flows run through SECURITY DEFINER functions (the token is the secret), so the web
// server never needs the service-role key.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseServerClient,
  withAuthParams,
  errorResponse,
  dbErrorResponse,
  handleRouteError,
  readJson,
  requireMembership,
  requireUuid,
  isUuid,
  type RouteContext,
} from '@/lib/supabase-server';
import { INVITATION_SELECT, toInvitation, type InvitationRow } from '@/lib/serializers';
import { fetchInvitationById } from '@/lib/queries';
import type { Invitation } from '@/types';

type Params = { id: string };

interface TokenInvitation {
  id: string;
  email: string;
  household_id: string;
  role: 'admin' | 'member';
  status: Invitation['status'];
  message: string | null;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  household: { id: string; name: string; address: string | null } | null;
  inviter: { id: string; name: string | null; email: string | null; avatar_url: string | null } | null;
}

function fromToken(row: TokenInvitation): Invitation {
  return {
    id: row.id,
    email: row.email,
    householdId: row.household_id,
    role: row.role,
    status: row.status,
    message: row.message,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    household: row.household,
    inviter: row.inviter
      ? { id: row.inviter.id, name: row.inviter.name?.trim() || 'Unknown', email: row.inviter.email, avatar: row.inviter.avatar_url }
      : null,
  };
}

async function lookupByToken(supabase: SupabaseClient, token: string): Promise<Invitation | null | NextResponse> {
  const { data, error } = await supabase.rpc('get_invitation_by_token', { p_token: token });
  if (error) return dbErrorResponse(error, 'Failed to load invitation');
  return data ? fromToken(data as TokenInvitation) : null;
}

/** 410 for invitations that can no longer be acted on, or null while still pending. */
function unusableResponse(invitation: Invitation): NextResponse | null {
  if (invitation.status === 'pending' && new Date(invitation.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: 'This invitation has expired', status: 'expired' }, { status: 410 });
  }
  if (invitation.status !== 'pending') {
    const label = invitation.status === 'rejected' ? 'declined' : invitation.status;
    return NextResponse.json({ error: `This invitation has already been ${label}`, status: invitation.status }, { status: 410 });
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET by token (public)
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext<Params>) {
  try {
    const { id: token } = await context.params;
    if (!isUuid(token)) return errorResponse('Invalid invitation link', 400);

    const supabase = await createSupabaseServerClient();
    const result = await lookupByToken(supabase, token);
    if (result instanceof NextResponse) return result;
    if (!result) return errorResponse('Invitation not found', 404);

    return unusableResponse(result) ?? NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

// ---------------------------------------------------------------------------
// POST by token: { action: 'accept' | 'decline', claimWithCurrentEmail?: boolean }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const { id: token } = await context.params;
    if (!isUuid(token)) return errorResponse('Invalid invitation link', 400);

    const body = await readJson(request);
    const action = body.action === 'accept' || body.action === 'decline' ? body.action : null;
    if (!action) return errorResponse('action must be accept or decline', 400);
    const claimWithCurrentEmail = body.claimWithCurrentEmail === true;

    const supabase = await createSupabaseServerClient();

    if (action === 'accept') {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const existing = await lookupByToken(supabase, token);
        const email = existing && !(existing instanceof NextResponse) ? existing.email : undefined;
        return NextResponse.json({ error: 'Sign in to accept this invitation', requiresAuth: true, email }, { status: 401 });
      }
    }

    const { data, error } = await supabase.rpc('respond_to_invitation_by_token', {
      p_token: token,
      p_action: action,
      p_claim: claimWithCurrentEmail,
    });
    if (error) return dbErrorResponse(error, 'Failed to respond to invitation');

    const result = data as { status: string; household_id?: string; household_name?: string | null; already_member?: boolean };
    if (result.status === 'rejected') {
      return NextResponse.json({ message: 'Invitation declined' });
    }
    return NextResponse.json({
      message: result.already_member ? 'You are already a member of this household' : 'You joined the household',
      householdId: result.household_id,
      householdName: result.household_name ?? null,
      redirectTo: '/dashboard',
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH by id (signed-in recipient): { status: 'accepted' | 'declined' }
// ---------------------------------------------------------------------------
export const PATCH = withAuthParams<Params>(async (request, { user, supabase, params }) => {
  const invitationId = requireUuid(params.id, 'Invitation id');
  const body = await readJson(request);
  const raw = typeof body.status === 'string' ? body.status.toLowerCase() : '';
  const status = raw === 'accepted' ? 'accepted' : raw === 'declined' || raw === 'rejected' ? 'rejected' : null;
  if (!status) return errorResponse('status must be accepted or declined', 400);

  const invitation = await fetchInvitationById(supabase, invitationId);
  if (!invitation) return errorResponse('Invitation not found', 404);
  if ((user.email ?? '').toLowerCase() !== invitation.email.toLowerCase()) {
    return errorResponse('You can only respond to invitations sent to you', 403);
  }
  const unusable = unusableResponse(invitation);
  if (unusable) {
    if (invitation.status === 'pending') {
      await supabase.from('invitations').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', invitationId);
    }
    return unusable;
  }

  if (status === 'accepted') {
    const { data: existingMembership } = await supabase
      .from('household_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('household_id', invitation.householdId)
      .maybeSingle();
    if (!existingMembership) {
      const { error: joinError } = await supabase.from('household_members').insert({
        user_id: user.id,
        household_id: invitation.householdId,
        role: invitation.role,
      });
      if (joinError) return dbErrorResponse(joinError, 'Failed to join household');
    }
  }

  const { data, error } = await supabase
    .from('invitations')
    .update({
      status,
      accepted_at: status === 'accepted' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invitationId)
    .select(INVITATION_SELECT)
    .maybeSingle();
  if (error) return dbErrorResponse(error, 'Failed to update invitation');

  return NextResponse.json({
    message: status === 'accepted' ? 'Invitation accepted' : 'Invitation declined',
    invitation: data ? toInvitation(data as unknown as InvitationRow) : invitation,
    householdId: invitation.householdId,
    redirectTo: '/dashboard',
  });
});

// ---------------------------------------------------------------------------
// DELETE by id (household admin cancels)
// ---------------------------------------------------------------------------
export const DELETE = withAuthParams<Params>(async (_request, { user, supabase, params }) => {
  const invitationId = requireUuid(params.id, 'Invitation id');
  const invitation = await fetchInvitationById(supabase, invitationId);
  if (!invitation) return errorResponse('Invitation not found', 404);
  await requireMembership(supabase, invitation.householdId, user.id, { admin: true });

  const { error } = await supabase.from('invitations').delete().eq('id', invitationId);
  if (error) return dbErrorResponse(error, 'Failed to cancel invitation');
  return NextResponse.json({ message: 'Invitation cancelled', id: invitationId });
});
