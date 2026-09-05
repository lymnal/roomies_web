// src/components/invitations/InviteModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { HiOutlineArrowPath, HiOutlineClipboardDocument, HiOutlineClock, HiOutlineEnvelope, HiOutlineKey } from 'react-icons/hi2';
import { errorMessage } from '@/lib/api-client';
import { fetchHousehold, regenerateJoinCode } from '@/lib/services/households';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Segmented from '@/components/ui/Segmented';
import Skeleton from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import InvitationForm from './InvitationForm';
import PendingInvitations from './PendingInvitations';

interface InviteModalProps {
  householdId: string;
  onClose: () => void;
}

type Tab = 'invite' | 'code' | 'pending';

export default function InviteModal({ householdId, onClose }: InviteModalProps) {
  const [tab, setTab] = useState<Tab>('invite');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <Modal open onClose={onClose} title="Invite roommates" description="Send a personal link, or share the join code. Either way they land in this household.">
      <Segmented
        ariaLabel="Invitation method"
        value={tab}
        onChange={setTab}
        className="mb-5"
        options={[
          { value: 'invite', label: 'Send a link', icon: <HiOutlineEnvelope className="h-4 w-4" /> },
          { value: 'code', label: 'Join code', icon: <HiOutlineKey className="h-4 w-4" /> },
          { value: 'pending', label: 'Pending', icon: <HiOutlineClock className="h-4 w-4" /> },
        ]}
      />
      {tab === 'invite' && <InvitationForm householdId={householdId} onInviteSent={() => setRefreshTrigger((n) => n + 1)} onCancel={onClose} />}
      {tab === 'code' && <JoinCodePanel householdId={householdId} />}
      {tab === 'pending' && <PendingInvitations key={refreshTrigger} householdId={householdId} onRefresh={() => setRefreshTrigger((n) => n + 1)} />}
    </Modal>
  );
}

function JoinCodePanel({ householdId }: { householdId: string }) {
  const toast = useToast();
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchHousehold(householdId)
      .then((household) => {
        if (!cancelled) setCode(household.joinCode ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Failed to load the join code'));
      });
    return () => {
      cancelled = true;
    };
  }, [householdId]);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Join code copied');
    } catch {
      toast.error('Could not copy', 'Select the code and copy it by hand.');
    }
  };

  const rotate = async () => {
    setRotating(true);
    setError('');
    try {
      const { joinCode } = await regenerateJoinCode(householdId);
      setCode(joinCode);
      toast.success('New join code ready', 'The old code no longer works.');
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate a new code'));
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert kind="error">{error}</Alert>}
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Roommates enter this code on their Roomies dashboard under <span className="font-medium">Join with a code</span> and become members instantly.
      </p>
      <div className="rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 p-6 text-center dark:border-brand-800 dark:bg-brand-900/20">
        {code === undefined ? (
          <Skeleton className="mx-auto h-10 w-44" />
        ) : (
          <p className="font-mono text-3xl font-semibold tracking-[0.35em] text-slate-900 dark:text-white">{code ?? '——'}</p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button fullWidth leftIcon={<HiOutlineClipboardDocument className="h-4 w-4" />} onClick={() => void copy()} disabled={!code}>
          Copy code
        </Button>
        <Button fullWidth variant="outline" leftIcon={<HiOutlineArrowPath className="h-4 w-4" />} onClick={() => void rotate()} isLoading={rotating}>
          {code ? 'Generate a new code' : 'Generate code'}
        </Button>
      </div>
    </div>
  );
}
