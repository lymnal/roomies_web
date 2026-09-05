// src/components/invitations/PendingInvitations.tsx
// A household's outstanding invitations (admin view) with copy-link and cancel.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { cancelInvitation, fetchHouseholdInvitations } from '@/lib/services/invitations';
import { formatDate } from '@/lib/utils';
import type { Invitation } from '@/types';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

interface PendingInvitationsProps {
  householdId: string;
  onRefresh?: () => void;
}

export default function PendingInvitations({ householdId, onRefresh }: PendingInvitationsProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      setInvitations(await fetchHouseholdInvitations(householdId));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load invitations'));
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLink = async (invitation: Invitation) => {
    if (!invitation.token) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite?token=${invitation.token}`);
      setCopiedId(invitation.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  const cancel = async (invitation: Invitation) => {
    if (!window.confirm(`Cancel the invitation for ${invitation.email}?`)) return;
    setBusyId(invitation.id);
    setError('');
    try {
      await cancelInvitation(invitation.id);
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
      onRefresh?.();
    } catch (err) {
      setError(errorMessage(err, 'Failed to cancel invitation'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="py-4 text-center text-gray-500 dark:text-gray-400">Loading invitations…</div>;

  return (
    <div className="space-y-4">
      {error && (
        <Alert kind="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {invitations.length === 0 ? (
        <div className="py-4 text-center text-gray-500 dark:text-gray-400">No pending invitations</div>
      ) : (
        invitations.map((invitation) => (
          <div key={invitation.id} className="p-4 bg-white dark:bg-gray-800 rounded-md shadow border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">{invitation.email}</h3>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <p>Role: {invitation.role}</p>
                  <p>Sent: {formatDate(invitation.createdAt, true)}</p>
                  <p>Expires: {formatDate(invitation.expiresAt)}</p>
                </div>
                {invitation.message && <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm italic text-gray-600 dark:text-gray-300">&ldquo;{invitation.message}&rdquo;</div>}
              </div>
              <div className="flex sm:flex-col gap-2">
                <Button size="sm" variant="outline" disabled={!invitation.token} onClick={() => void copyLink(invitation)}>
                  {copiedId === invitation.id ? 'Copied' : 'Copy link'}
                </Button>
                <Button size="sm" variant="danger" isLoading={busyId === invitation.id} disabled={busyId !== null} onClick={() => void cancel(invitation)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
