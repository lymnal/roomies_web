// src/lib/supabase-server.ts
// Shared utilities for Route Handlers and Server Components.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

// ============================================================================
// Client creation
// ============================================================================

/** Supabase client bound to the request cookies (getAll/setAll pattern required by Next.js 15). */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components cannot set cookies; the middleware refreshes the session instead.
          }
        },
      },
    }
  );
}

// ============================================================================
// Errors and responses
// ============================================================================

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

export function errorResponse(message: string, status = 500, details?: unknown): NextResponse {
  return NextResponse.json(details === undefined ? { error: message } : { error: message, details }, { status });
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Map Postgres / PostgREST errors to HTTP statuses. Our RPCs raise readable messages with
 * conventional SQLSTATEs (28000 auth, 42501 forbidden, P0002 not found, P0001 validation).
 */
export function dbErrorResponse(error: PostgrestLikeError, fallback = 'Database error'): NextResponse {
  const message = error.message || fallback;
  switch (error.code) {
    case '28000':
      return errorResponse(message, 401);
    case '42501':
      return errorResponse(message, 403);
    case 'P0002':
    case 'PGRST116':
      return errorResponse(message, 404);
    case 'P0003':
      return errorResponse(message, 410);
    case '23505':
      return errorResponse(message, 409);
    case 'P0001':
    case '22P02':
    case '23502':
    case '23503':
    case '23514':
      return errorResponse(message, 400);
    default:
      console.error('[api] database error:', error);
      return errorResponse(fallback, 500);
  }
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return errorResponse(error.message, error.status, error.details);
  }
  console.error('[api] unhandled error:', error);
  return errorResponse('Internal server error', 500);
}

export async function readJson<T = Record<string, unknown>>(request: NextRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function requireUuid(value: unknown, label: string): string {
  if (!isUuid(value)) throw new HttpError(400, `${label} must be a valid id`);
  return value;
}

// ============================================================================
// Auth wrappers
// ============================================================================

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
}

export type RouteContext<P> = { params: Promise<P> };

type AuthenticatedHandler = (request: NextRequest, ctx: AuthContext) => Promise<NextResponse>;
type AuthenticatedHandlerWithParams<P> = (request: NextRequest, ctx: AuthContext & { params: P }) => Promise<NextResponse>;

async function authenticate(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { user, supabase };
}

/**
 * Wraps a route handler with authentication (401 when there is no valid session) and uniform
 * error handling (HttpError → its status, anything else → 500).
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const ctx = await authenticate();
      if (!ctx) return errorResponse('Unauthorized', 401);
      return await handler(request, ctx);
    } catch (error) {
      return handleRouteError(error);
    }
  };
}

/** Same as withAuth for dynamic routes; params are awaited for you. */
export function withAuthParams<P>(handler: AuthenticatedHandlerWithParams<P>) {
  return async (request: NextRequest, context: RouteContext<P>): Promise<NextResponse> => {
    try {
      const ctx = await authenticate();
      if (!ctx) return errorResponse('Unauthorized', 401);
      const params = await context.params;
      return await handler(request, { ...ctx, params });
    } catch (error) {
      return handleRouteError(error);
    }
  };
}

// ============================================================================
// Household access
// ============================================================================

export type HouseholdRole = 'admin' | 'member';

export interface Membership {
  user_id: string;
  household_id: string;
  role: HouseholdRole;
}

export async function getMembership(
  supabase: SupabaseClient,
  householdId: string,
  userId: string
): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id, household_id, role')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) {
    console.error('[api] membership check failed:', error);
    throw new HttpError(500, 'Failed to verify household membership');
  }
  return (data as Membership | null) ?? null;
}

/** Throws 403 unless the user belongs to the household (and is an admin, when required). */
export async function requireMembership(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  options: { admin?: boolean } = {}
): Promise<Membership> {
  const membership = await getMembership(supabase, householdId, userId);
  if (!membership) throw new HttpError(403, 'You are not a member of this household');
  if (options.admin && membership.role !== 'admin') {
    throw new HttpError(403, 'Only household admins can perform this action');
  }
  return membership;
}

/** The household the user joined most recently, or null. */
export async function getUserCurrentHousehold(
  supabase: SupabaseClient,
  userId: string
): Promise<{ household_id: string; role: HouseholdRole } | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as { household_id: string; role: HouseholdRole };
}
