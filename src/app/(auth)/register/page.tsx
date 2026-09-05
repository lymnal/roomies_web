// src/app/(auth)/register/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { HiOutlineEnvelope } from 'react-icons/hi2';
import { supabaseClient } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input } from '@/components/ui/Field';
import { FullPageSpinner } from '@/components/ui/Spinner';

function safeCallback(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

function RegisterForm() {
  usePageTitle('Create account');
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams.get('callbackUrl'));

  const [name, setName] = useState('');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

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
    setLoading(true);
    try {
      // The profiles row is created by the on_auth_user_created trigger; nothing else to insert.
      const { data, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        setSentTo(email);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const loginHref = `/login${searchParams.get('callbackUrl') ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`;

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox">
        <EmptyState
          icon={<HiOutlineEnvelope className="h-6 w-6" />}
          title={`We sent a confirmation link to ${sentTo}`}
          description="Open it to activate your account. You can close this tab."
          action={
            <Button variant="outline" onClick={() => setSentTo('')}>
              Use a different email
            </Button>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Takes about a minute. Free for households of any size."
      footer={
        <>
          Already have an account?{' '}
          <Link href={loginHref} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleSignInButton redirectTo={callbackUrl} />
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-slate-50 px-3 text-slate-400 dark:bg-slate-950">or</span>
        </div>
      </div>
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <FormField label="Full name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Password" htmlFor="password" hint="At least 8 characters">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <FormField label="Confirm password" htmlFor="confirm-password" error={passwordMismatch ? 'Passwords do not match' : undefined}>
            <Input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} invalid={passwordMismatch} />
          </FormField>
        </div>
        <Button type="submit" size="lg" fullWidth isLoading={loading} disabled={passwordMismatch}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <RegisterForm />
    </Suspense>
  );
}
