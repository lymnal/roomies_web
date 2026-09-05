// src/app/api/invitations/[id]/route.ts
//
// One path, two identifiers:
//   GET  /api/invitations/<token>   public  - look an invitation up from an invite link
//   POST /api/invitations/<token>   public* - accept (needs a session) or decline
//   PATCH  /api/invitations/<id>    signed-in recipient accepts/declines from the dashboard
//   DELETE /api/invitations/<id>    household admin cancels
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
  HttpError,
  type RouteContext,
} from '@/lib/supabase-server';
import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/supabase-admin';
import { INVITATION_SELECT, toInvitation, type InvitationRow } from '@/lib/serializers';
import { fetchInvitationById } from '@/lib/queries';
import type { Invitation } from '@/types';

type Params = { id: string };

/** Token lookups bypass RLS (the token *is* the secret); fall back to the session client. */
async function tokenClient(session: SupabaseClient): Promise<SupabaseClient> {
  return hasSupabaseAdmin() ? getSupabaseAdmin() : session;
}

async function findByToken(client: SupabaseClient, token: string): Promise<Invitation | null> {
  const { data, error } = await client.from('invitations').select(INVITATION_SELECT).eq('token', token).maybeSingle();
  if (error) {
    console.error('[api] invitation lookup failed:', error);
    throw new HttpError(500, 'Failed to load invitation');
  }
  return data ? toInvitation(data as unknown as InvitationRow) : null;
}

function isExpired(invitation: Invitation): boolean {
  return new Date(invitation.expiresAt).getTime() < Date.now();
}

async function markExpired(client: SupabaseClient, invitationId: string) {
  await client.from('invitations').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', invitationId);
}

/** 410 responses for invitations that can no longer be acted on, or null if it is still pending. */
async function unusableResponse(client: SupabaseClient, invitation: Invitation): Promise<NextResponse | null> {
  if (invitation.status === 'pending' && isExpired(invitation)) {
    await markExpired(client, invitation.id);
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

    const session = await createSupabaseServerClient();
    const client = await tokenClient(session);
    const invitation = await findByToken(client, token);

    if (!invitation) {
      if (!hasSupabaseAdmin()) {
        const {
          data: { user },
        } = await session.auth.getUser();
        if (!user) {
          return NextResponse.json({ error: 'Sign in to view this invitation', requiresAuth: true }, { status: 401 });
        }
      }
      return errorResponse('Invitation not found', 404);
    }

    const unusable = await unusableResponse(client, invitation);
    if (unusable) return unusable;

    return NextResponse.json(invitation);
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

    const session = await createSupabaseServerClient();
    const client = await tokenClient(session);
    const invitation = await findByToken(client, token);
    if (!invitation) return errorResponse('Invitation not found', 404);

    const unusable = await unusableResponse(client, invitation);
    if (unusable) return unusable;

    if (action === 'decline') {
      const { error } = await client
        .from('invitations')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);
      if (error) return dbErrorResponse(error, 'Failed to decline invitation');
      return NextResponse.json({ message: 'Invitation declined' });
    }

    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to accept this invitation', requiresAuth: true, email: invitation.email }, { status: 401 });
    }

    const emailMatches = (user.email ?? '').toLowerCase() === invitation.email.toLowerCase();
    if (!emailMatches && !claimWithCurrentEmail) {
      return errorResponse('This invitation was sent to a different email address', 403);
    }

    const acceptedUpdate = {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(emailMatches ? {} : { notes: `Claimed by ${user.email} (original recipient: ${invitation.email})` }),
    };

    const { data: existingMembership } = await session
      .from('household_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('household_id', invitation.householdId)
      .maybeSingle();

    if (!existingMembership) {
      const { error: joinError } = await session.from('household_members').insert({
        user_id: user.id,
        household_id: invitation.householdId,
        role: invitation.role,
      });
      if (joinError) return dbErrorResponse(joinError, 'Failed to join household');
    }

    const { error: updateError } = await client.from('invitations').update(acceptedUpdate).eq('id', invitation.id);
    if (updateError) console.error('[api] invitation accepted but status update failed:', updateError);

    return NextResponse.json({
      message: existingMembership ? 'You are already a member of this household' : 'You joined the household',
      householdId: invitation.householdId,
      householdName: invitation.household?.name ?? null,
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
  const unusable = await unusableResponse(supabase, invitation);
  if (unusable) return unusable;

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
