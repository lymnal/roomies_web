// src/app/(auth)/reset-password/page.tsx
// Landing page for the password-reset email. Supabase redirects here with ?code=...; exchanging
// the code creates a session, after which the password can be changed.
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase';
import Alert from '@/components/ui/Alert';
import { FullPageSpinner } from '@/components/ui/Spinner';

const inputClass =
  'relative block w-full rounded-md border-0 py-3 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-700 dark:bg-gray-800 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 px-4';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const prepare = async () => {
      try {
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!cancelled) {
          if (session) setReady(true);
          else setError('This reset link is invalid or has expired. Please request a new one.');
        }
      } catch {
        if (!cancelled) setError('This reset link is invalid or has expired. Please request a new one.');
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    void prepare();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabaseClient.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) return <FullPageSpinner />;

  return (
    <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-blue-600 dark:text-blue-400">Roomies</h1>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Choose a new password</h2>
        </div>

        {error && (
          <Alert kind="error">
            {error}{' '}
            <Link href="/forgot-password" className="underline">
              Request a new link
            </Link>
          </Alert>
        )}

        {success ? (
          <Alert kind="success">Your password has been updated. Taking you to your dashboard…</Alert>
        ) : (
          ready && (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="password" className="sr-only">
                    New password
                  </label>
                  <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="New password" />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="sr-only">
                    Confirm password
                  </label>
                  <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Confirm new password" />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full justify-center rounded-md bg-blue-600 py-3 px-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Updating…' : 'Update password'}
              </button>
              <p className="text-center text-sm">
                <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                  Back to login
                </Link>
              </p>
            </form>
          )
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
