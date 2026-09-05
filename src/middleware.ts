import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Pages that work without a session. Prefix matches only on a '/' boundary. */
const PUBLIC_PAGES = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/auth/callback', '/invite'];

function isPublicPath(pathname: string, method: string): boolean {
  if (PUBLIC_PAGES.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }
  // Invitation links are opened by people who may not have an account yet:
  // GET looks the invitation up by token, POST accepts/declines it.
  if (/^\/api\/invitations\/[^/]+$/.test(pathname) && (method === 'GET' || method === 'POST')) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getUser() validates the session with Supabase Auth and refreshes expired tokens
  // (the refreshed cookies are written to `response` through setAll above).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublicPath(pathname, request.method)) {
    if (pathname.startsWith('/api/')) {
      const apiResponse = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      response.cookies.getAll().forEach((cookie) => apiResponse.cookies.set(cookie));
      return apiResponse;
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');
    const target = request.nextUrl.clone();
    target.search = '';
    if (callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
      const [path, query] = callbackUrl.split('?');
      target.pathname = path;
      target.search = query ? `?${query}` : '';
    } else {
      target.pathname = '/dashboard';
    }
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
