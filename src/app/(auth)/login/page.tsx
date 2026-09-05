// src/app/(auth)/login/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Field';
import { FullPageSpinner } from '@/components/ui/Spinner';

function safeCallback(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

function Divider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200 dark:border-slate-800" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wider">
        <span className="bg-slate-50 px-3 text-slate-400 dark:bg-slate-950">or</span>
      </div>
    </div>
  );
}

function LoginForm() {
  usePageTitle('Sign in');
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams.get('callbackUrl'));
  const urlError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    urlError === 'callback_error' ? 'We could not complete sign-in. Please try again.' : urlError === 'verification_failed' ? 'Email verification failed or the link expired.' : ''
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError('Invalid email or password');
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const registerHref = `/register${searchParams.get('callbackUrl') ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your household."
      footer={
        <>
          New to Roomies?{' '}
          <Link href={registerHref} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleSignInButton redirectTo={callbackUrl} />
      <Divider />
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </FormField>
        <FormField
          label={
            <span className="flex items-center justify-between">
              <span>Password</span>
              <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                Forgot password?
              </Link>
            </span>
          }
          htmlFor="password"
        >
          <Input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </FormField>
        <Button type="submit" size="lg" fullWidth isLoading={loading}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <LoginForm />
    </Suspense>
  );
}
