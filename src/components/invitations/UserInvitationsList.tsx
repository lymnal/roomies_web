// src/components/invitations/UserInvitationsList.tsx
// Invitations addressed to the signed-in user, with accept / decline.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHousehold } from '@/context/HouseholdContext';
import { errorMessage } from '@/lib/api-client';
import { fetchMyInvitations, respondToInvitation } from '@/lib/services/invitations';
import { formatDate } from '@/lib/utils';
import type { Invitation } from '@/types';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

interface Props {
  /** Compact mode renders nothing when there are no invitations (used on the dashboard). */
  compact?: boolean;
}

export default function UserInvitationsList({ compact = false }: Props) {
  const router = useRouter();
  const { refresh, setCurrentId } = useHousehold();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      setInvitations(await fetchMyInvitations());
    } catch (err) {
      setError(errorMessage(err, 'Failed to load invitations'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (invitation: Invitation, status: 'accepted' | 'declined') => {
    setProcessingId(invitation.id);
    setError('');
    try {
      const result = await respondToInvitation(invitation.id, status);
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
      if (status === 'accepted') {
        await refresh();
        setCurrentId(result.householdId);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(errorMessage(err, `Failed to ${status === 'accepted' ? 'accept' : 'decline'} invitation`));
    } finally {
      setProcessingId(null);
    }
  };

  if (compact && !loading && invitations.length === 0 && !error) return null;

  if (loading) {
    return compact ? null : <p className="text-gray-500 dark:text-gray-400">Loading your invitations…</p>;
  }

  return (
    <div className="space-y-4">
      {!compact && <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pending invitations</h2>}
      {error && (
        <Alert kind="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {invitations.length === 0 && !compact && <p className="text-gray-500 dark:text-gray-400">You don&apos;t have any pending invitations.</p>}

      {invitations.map((invitation) => (
        <div key={invitation.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-blue-200 dark:border-blue-900">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium text-gray-900 dark:text-white">
                {invitation.inviter?.name ?? 'Someone'} invited you to join {invitation.household?.name ?? 'a household'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Role: {invitation.role} · expires {formatDate(invitation.expiresAt)}
              </p>
              {invitation.message && <p className="mt-2 text-sm italic text-gray-600 dark:text-gray-300">&ldquo;{invitation.message}&rdquo;</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" disabled={processingId !== null} onClick={() => void respond(invitation, 'declined')}>
                Decline
              </Button>
              <Button variant="primary" size="sm" isLoading={processingId === invitation.id} disabled={processingId !== null} onClick={() => void respond(invitation, 'accepted')}>
                Accept
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
