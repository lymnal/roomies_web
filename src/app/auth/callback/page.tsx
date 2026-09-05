// src/app/auth/callback/page.tsx
// OAuth and email-confirmation links land here with ?code=...; exchange it for a session and move on.
// The profiles row is created by the on_auth_user_created database trigger.
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase';
import Logo from '@/components/ui/Logo';
import Spinner from '@/components/ui/Spinner';

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50 dark:bg-slate-950">
      <Logo size="lg" className="text-slate-900 dark:text-white" />
      <Spinner size="md" />
      <p className="text-sm text-slate-500 dark:text-slate-400">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950" />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
