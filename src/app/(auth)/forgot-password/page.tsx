// src/app/(auth)/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HiOutlineEnvelope } from 'react-icons/hi2';
import { supabaseClient } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import AuthLayout from '@/components/auth/AuthLayout';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input } from '@/components/ui/Field';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  usePageTitle('Reset password');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (resetError) throw resetError;
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing your request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <Link href="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
      Back to sign in
    </Link>
  );

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox" footer={footer}>
        <EmptyState
          icon={<HiOutlineEnvelope className="h-6 w-6" />}
          title="Reset link sent"
          description={`If ${sentTo} has an account, a link to choose a new password is on its way. Check your spam folder too.`}
          action={
            <Button variant="outline" onClick={() => setSentTo('')}>
              Try another email
            </Button>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send you a link to choose a new one." footer={footer}>
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </FormField>
        <Button type="submit" size="lg" fullWidth isLoading={isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
