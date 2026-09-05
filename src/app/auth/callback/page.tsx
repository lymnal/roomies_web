// src/app/auth/callback/page.tsx
// OAuth and email-confirmation links land here with ?code=...; exchange it for a session and move on.
// The profiles row is created by the on_auth_user_created database trigger.
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase';
import { FullPageSpinner } from '@/components/ui/Spinner';

function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const next = safeNext(searchParams.get('next'));
      const code = searchParams.get('code');
      if (searchParams.get('error')) {
        router.replace('/login?error=callback_error');
        return;
      }
      try {
        if (code) {
          const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        router.replace(session ? next : '/login?error=verification_failed');
        router.refresh();
      } catch (error) {
        console.error('Auth callback failed:', error);
        router.replace('/login?error=callback_error');
      }
    };
    void run();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Roomies</h1>
        <p className="text-gray-600 dark:text-gray-400">Signing you in…</p>
        <FullPageSpinner />
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
