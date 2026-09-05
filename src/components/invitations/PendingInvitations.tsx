// src/components/invitations/PendingInvitations.tsx
// A household's outstanding invitations (admin view) with copy-link and cancel.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { HiOutlineClipboardDocument, HiOutlineEnvelope, HiOutlineTrash } from 'react-icons/hi2';
import { errorMessage } from '@/lib/api-client';
import { cancelInvitation, fetchHouseholdInvitations } from '@/lib/services/invitations';
import { relativeDay } from '@/lib/utils';
import type { Invitation } from '@/types';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Confirm';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface PendingInvitationsProps {
  householdId: string;
  onRefresh?: () => void;
}

export default function PendingInvitations({ householdId, onRefresh }: PendingInvitationsProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

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
      toast.success('Invitation link copied', `Send it to ${invitation.email}.`);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const cancel = async (invitation: Invitation) => {
    const ok = await confirm({
      title: `Cancel the invitation for ${invitation.email}?`,
      description: 'Their link stops working immediately. You can always invite them again.',
      confirmLabel: 'Cancel invitation',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(invitation.id);
    setError('');
    try {
      await cancelInvitation(invitation.id);
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
      onRefresh?.();
      toast.success('Invitation cancelled');
    } catch (err) {
      setError(errorMessage(err, 'Failed to cancel invitation'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <SkeletonList rows={2} />;

  return (
    <div className="space-y-3">
      {error && (
        <Alert kind="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {invitations.length === 0 ? (
        <EmptyState compact icon={<HiOutlineEnvelope className="h-6 w-6" />} title="No pending invitations" description="Links you create show up here until they are accepted." />
      ) : (
        <ul className="space-y-2">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <HiOutlineEnvelope className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{invitation.email}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {invitation.role} · sent {relativeDay(invitation.createdAt)} · expires {relativeDay(invitation.expiresAt)}
                </p>
                {invitation.message && <p className="mt-1 truncate text-xs italic text-slate-500 dark:text-slate-400">&ldquo;{invitation.message}&rdquo;</p>}
              </div>
              <Button size="icon" variant="outline" aria-label={`Copy invitation link for ${invitation.email}`} disabled={!invitation.token} onClick={() => void copyLink(invitation)}>
                <HiOutlineClipboardDocument className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Cancel invitation for ${invitation.email}`}
                className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30"
                isLoading={busyId === invitation.id}
                disabled={busyId !== null}
                onClick={() => void cancel(invitation)}
              >
                <HiOutlineTrash className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
