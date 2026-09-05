// src/app/invite/page.tsx
// Landing page for invitation links (/invite?token=...). Works without a session for viewing and
// declining; accepting requires signing in (or up) first.
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HiOutlineExclamationTriangle, HiOutlineMapPin } from 'react-icons/hi2';
import { supabaseClient } from '@/lib/supabase';
import { ApiError, errorMessage } from '@/lib/api-client';
import { fetchInvitationByToken, respondByToken } from '@/lib/services/invitations';
import { usePageTitle } from '@/hooks/usePageTitle';
import { relativeDay } from '@/lib/utils';
import type { Invitation } from '@/types';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import { useConfirm } from '@/components/ui/Confirm';
import Logo from '@/components/ui/Logo';
import { FullPageSpinner } from '@/components/ui/Spinner';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.16),transparent_60%)]" />
      <div className="relative w-full max-w-md animate-slide-up rounded-2xl border border-slate-200 bg-white p-8 shadow-pop dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex justify-center">
          <Logo size="md" className="text-slate-900 dark:text-white" />
        </div>
        {children}
      </div>
    </div>
  );
}

function InvitationContent() {
  usePageTitle('Invitation');
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const returnTo = `/invite?token=${token ?? ''}`;

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email ?? null));
  }, []);

  useEffect(() => {
    if (!token) {
      setError('This invitation link is missing its token.');
      setLoading(false);
      return;
    }
    fetchInvitationByToken(token)
      .then(setInvitation)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) setNeedsSignIn(true);
        else setError(errorMessage(err, 'Failed to load invitation'));
      })
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async (claimWithCurrentEmail: boolean) => {
    if (!token) return;
    setProcessing(true);
    setError('');
    try {
      const result = await respondByToken(token, 'accept', claimWithCurrentEmail);
      if (result.requiresAuth) {
        setNeedsSignIn(true);
        return;
      }
      router.push(result.redirectTo ?? '/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setNeedsSignIn(true);
      else setError(errorMessage(err, 'Failed to accept invitation'));
    } finally {
      setProcessing(false);
    }
  };

  const claim = async () => {
    if (!invitation) return;
    const ok = await confirm({
      title: 'Accept with this account?',
      description: (
        <>
          The invitation was sent to <strong>{invitation.email}</strong>. It will be accepted by <strong>{sessionEmail}</strong> instead.
        </>
      ),
      confirmLabel: 'Accept with this account',
    });
    if (ok) await accept(true);
  };

  const decline = async () => {
    if (!token) return;
    const ok = await confirm({ title: 'Decline this invitation?', description: 'The person who invited you can send a new one later.', confirmLabel: 'Decline', tone: 'danger' });
    if (!ok) return;
    setProcessing(true);
    setError('');
    try {
      await respondByToken(token, 'decline');
      router.push('/');
    } catch (err) {
      setError(errorMessage(err, 'Failed to decline invitation'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <FullPageSpinner />;

  if (needsSignIn) {
    return (
      <Frame>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Sign in to continue</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">You need an account to accept this invitation.</p>
          {invitation?.email && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              It was sent to <span className="font-medium text-slate-700 dark:text-slate-200">{invitation.email}</span>.
            </p>
          )}
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <ButtonLink href={`/login?callbackUrl=${encodeURIComponent(returnTo)}`} size="lg" fullWidth>
            Sign in
          </ButtonLink>
          <ButtonLink href={`/register?email=${encodeURIComponent(invitation?.email ?? '')}&callbackUrl=${encodeURIComponent(returnTo)}`} variant="outline" size="lg" fullWidth>
            Create an account
          </ButtonLink>
        </div>
      </Frame>
    );
  }

  if (error || !invitation) {
    return (
      <Frame>
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
            <HiOutlineExclamationTriangle className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">Invitation unavailable</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error || 'This invitation may have expired or been withdrawn.'}</p>
        </div>
        <div className="mt-6">
          <ButtonLink href="/" variant="outline" fullWidth>
            Return home
          </ButtonLink>
        </div>
      </Frame>
    );
  }

  const emailMismatch = Boolean(sessionEmail && sessionEmail.toLowerCase() !== invitation.email.toLowerCase());
  const inviterName = invitation.inviter?.name ?? 'A roommate';

  return (
    <Frame>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">You&apos;re invited</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Join {invitation.household?.name ?? 'a household'}</h1>
        {invitation.household?.address && (
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <HiOutlineMapPin className="h-4 w-4" /> {invitation.household.address}
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
        <Avatar src={invitation.inviter?.avatar} name={inviterName} size={44} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{inviterName}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            invited you as <Badge tone={invitation.role === 'admin' ? 'purple' : 'neutral'}>{invitation.role}</Badge>
          </p>
        </div>
      </div>

      {invitation.message && <blockquote className="mt-4 border-l-2 border-brand-300 pl-3 text-sm italic text-slate-600 dark:border-brand-700 dark:text-slate-300">&ldquo;{invitation.message}&rdquo;</blockquote>}

      {error && (
        <Alert kind="error" className="mt-4">
          {error}
        </Alert>
      )}

      {emailMismatch && (
        <Alert kind="warning" className="mt-4">
          You are signed in as {sessionEmail}, but this invitation was sent to {invitation.email}.
          <div className="mt-2 flex flex-wrap justify-end gap-3">
            <Button
              variant="link"
              onClick={async () => {
                await supabaseClient.auth.signOut();
                window.location.reload();
              }}
            >
              Sign out
            </Button>
            <Button variant="link" onClick={() => void claim()}>
              Use this account anyway
            </Button>
          </div>
        </Alert>
      )}

      <div className="mt-6 flex gap-3">
        <Button variant="outline" size="lg" fullWidth onClick={() => void decline()} disabled={processing}>
          Decline
        </Button>
        <Button size="lg" fullWidth onClick={() => void accept(false)} isLoading={processing} disabled={processing || emailMismatch}>
          Accept
        </Button>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">Expires {relativeDay(invitation.expiresAt)}</p>
    </Frame>
  );
}

export default function InvitationPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <InvitationContent />
    </Suspense>
  );
}
