// src/app/invite/page.tsx
// Landing page for invitation links (/invite?token=...). Works without a session for viewing and
// declining; accepting requires signing in (or up) first.
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase';
import { ApiError, errorMessage } from '@/lib/api-client';
import { fetchInvitationByToken, respondByToken } from '@/lib/services/invitations';
import type { Invitation } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { FullPageSpinner } from '@/components/ui/Spinner';

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-6 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md">{children}</div>
    </div>
  );
}

function InvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [showClaimConfirmation, setShowClaimConfirmation] = useState(false);

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
      setShowClaimConfirmation(false);
    }
  };

  const decline = async () => {
    if (!token || !window.confirm('Decline this invitation?')) return;
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
      <Panel>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sign in to continue</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">You need an account to accept this invitation.</p>
          {invitation?.email && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              It was sent to <span className="font-medium">{invitation.email}</span>.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <Link href={`/login?callbackUrl=${encodeURIComponent(returnTo)}`} className="w-full flex justify-center py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
            Sign in
          </Link>
          <Link
            href={`/register?email=${encodeURIComponent(invitation?.email ?? '')}&callbackUrl=${encodeURIComponent(returnTo)}`}
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Create account
          </Link>
        </div>
      </Panel>
    );
  }

  if (error || !invitation) {
    return (
      <Panel>
        <div className="text-center">
          <h2 className="text-xl font-medium text-gray-900 dark:text-white">Invitation unavailable</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{error || 'This invitation may have expired or been withdrawn.'}</p>
        </div>
        <p className="text-center">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
            Return home
          </Link>
        </p>
      </Panel>
    );
  }

  const emailMismatch = Boolean(sessionEmail && sessionEmail.toLowerCase() !== invitation.email.toLowerCase());

  return (
    <Panel>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Roomies</h1>
        <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">You&apos;ve been invited</h2>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 p-5 rounded-lg space-y-4">
        <div className="flex items-center gap-4">
          <Avatar src={invitation.inviter?.avatar} name={invitation.inviter?.name ?? 'Roommate'} size={56} />
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{invitation.inviter?.name ?? 'A roommate'}</h3>
            {invitation.inviter?.email && <p className="text-sm text-gray-600 dark:text-gray-300">{invitation.inviter.email}</p>}
            <p className="text-sm text-gray-500 dark:text-gray-300">invited you to join</p>
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{invitation.household?.name ?? 'a household'}</h3>
          {invitation.household?.address && <p className="text-gray-600 dark:text-gray-400 mt-1">{invitation.household.address}</p>}
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
            Role: <span className="font-medium capitalize">{invitation.role}</span>
          </p>
        </div>
        {invitation.message && (
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 italic">&ldquo;{invitation.message}&rdquo;</div>
        )}
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      {emailMismatch && (
        <Alert kind="warning">
          You are signed in as {sessionEmail}, but this invitation was sent to {invitation.email}.
          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              className="text-sm underline"
              onClick={async () => {
                await supabaseClient.auth.signOut();
                window.location.reload();
              }}
            >
              Sign out
            </button>
            <button type="button" className="text-sm font-medium underline" onClick={() => setShowClaimConfirmation(true)}>
              Use this account anyway
            </button>
          </div>
        </Alert>
      )}

      <div className="flex gap-4">
        <Button variant="outline" fullWidth onClick={() => void decline()} disabled={processing}>
          Decline
        </Button>
        <Button variant="primary" fullWidth onClick={() => void accept(false)} isLoading={processing} disabled={processing || emailMismatch}>
          Accept
        </Button>
      </div>

      {showClaimConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Link this invitation to your account?</h3>
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              The invitation for <strong>{invitation.email}</strong> will be accepted by <strong>{sessionEmail}</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowClaimConfirmation(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void accept(true)} isLoading={processing}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

export default function InvitationPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <InvitationContent />
    </Suspense>
  );
}
