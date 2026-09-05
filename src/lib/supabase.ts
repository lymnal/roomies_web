// src/lib/supabase.ts
// Browser-side Supabase client. Cookie-based (via @supabase/ssr) so that the session created in the
// browser is visible to the middleware, Server Components and Route Handlers.
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill it in.'
  );
}

/** Singleton browser client. @supabase/ssr memoises it per page, so importing this is cheap. */
export const supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
