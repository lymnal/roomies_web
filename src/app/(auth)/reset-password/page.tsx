// src/app/(auth)/reset-password/page.tsx
// Landing page for the password-reset email. Supabase redirects here with ?code=...; exchanging
// the code creates a session, after which the password can be changed.
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import AuthLayout from '@/components/auth/AuthLayout';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Field';
import { FullPageSpinner } from '@/components/ui/Spinner';

function ResetPasswordForm() {
  usePageTitle('Choose a new password');
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
          else setError('This reset link is invalid or has expired.');
        }
      } catch {
        if (!cancelled) setError('This reset link is invalid or has expired.');
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
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) return <FullPageSpinner />;

  return (
    <AuthLayout
      title="Choose a new password"
      footer={
        <Link href="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Back to sign in
        </Link>
      }
    >
      {error && (
        <Alert kind="error" className="mb-5">
          {error}{' '}
          <Link href="/forgot-password" className="font-medium underline">
            Request a new link
          </Link>
        </Alert>
      )}
      {success ? (
        <Alert kind="success">Your password has been updated. Taking you to your dashboard…</Alert>
      ) : (
        ready && (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <FormField label="New password" htmlFor="password" hint="At least 8 characters">
              <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>
            <FormField label="Confirm new password" htmlFor="confirm-password">
              <Input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </FormField>
            <Button type="submit" size="lg" fullWidth isLoading={isSubmitting}>
              Update password
            </Button>
          </form>
        )
      )}
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
