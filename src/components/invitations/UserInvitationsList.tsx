// src/components/invitations/UserInvitationsList.tsx
// Invitations addressed to the signed-in user, with accept / decline.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineEnvelopeOpen } from 'react-icons/hi2';
import { useHousehold } from '@/context/HouseholdContext';
import { errorMessage } from '@/lib/api-client';
import { fetchMyInvitations, respondToInvitation } from '@/lib/services/invitations';
import { relativeDay } from '@/lib/utils';
import type { Invitation } from '@/types';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface Props {
  /** Compact mode renders nothing when there are no invitations (used on the dashboard). */
  compact?: boolean;
}

export default function UserInvitationsList({ compact = false }: Props) {
  const router = useRouter();
  const toast = useToast();
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
        toast.success(`Welcome to ${invitation.household?.name ?? 'your new household'}`);
        await refresh();
        setCurrentId(result.householdId);
        router.push('/dashboard');
      } else {
        toast.info('Invitation declined');
      }
    } catch (err) {
      setError(errorMessage(err, `Failed to ${status === 'accepted' ? 'accept' : 'decline'} invitation`));
    } finally {
      setProcessingId(null);
    }
  };

  if (compact && !loading && invitations.length === 0 && !error) return null;
  if (loading) return compact ? null : <SkeletonList rows={2} />;

  return (
    <div className="space-y-3">
      {error && (
        <Alert kind="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {invitations.length === 0 && !compact && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <EmptyState icon={<HiOutlineEnvelopeOpen className="h-6 w-6" />} title="No pending invitations" description="When a roommate invites you to their household, it shows up here." />
        </div>
      )}

      {invitations.map((invitation) => {
        const inviter = invitation.inviter?.name ?? 'Someone';
        const householdName = invitation.household?.name ?? 'a household';
        return (
          <div
            key={invitation.id}
            className="flex flex-col gap-4 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-teal-50 p-4 shadow-card animate-slide-up sm:flex-row sm:items-center dark:border-brand-900 dark:from-brand-950/40 dark:to-teal-950/30"
          >
            <Avatar src={invitation.inviter?.avatar} name={inviter} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-900 dark:text-white">
                <span className="font-semibold">{inviter}</span> invited you to join <span className="font-semibold">{householdName}</span>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Badge tone={invitation.role === 'admin' ? 'purple' : 'neutral'}>{invitation.role}</Badge>
                <span>Expires {relativeDay(invitation.expiresAt)}</span>
              </p>
              {invitation.message && <p className="mt-2 text-sm italic text-slate-600 dark:text-slate-300">&ldquo;{invitation.message}&rdquo;</p>}
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <Button variant="outline" size="sm" disabled={processingId !== null} onClick={() => void respond(invitation, 'declined')}>
                Decline
              </Button>
              <Button size="sm" isLoading={processingId === invitation.id} disabled={processingId !== null} onClick={() => void respond(invitation, 'accepted')}>
                Accept
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
