// src/app/(dashboard)/households/[householdId]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useHousehold } from '@/context/HouseholdContext';
import { errorMessage } from '@/lib/api-client';
import { fetchHousehold } from '@/lib/services/households';
import type { Household, HouseholdRole } from '@/types';
import MemberGrid from '@/components/dashboard/MemberGrid';
import HouseholdInfo from '@/components/dashboard/HouseholdInfo';
import InviteModal from '@/components/invitations/InviteModal';
import Alert from '@/components/ui/Alert';
import { FullPageSpinner } from '@/components/ui/Spinner';

export default function HouseholdMembersPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = use(params);
  const { user } = useAuth();
  const { households, refresh } = useHousehold();
  const [household, setHousehold] = useState<Household | null>(null);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [gridKey, setGridKey] = useState(0);

  const role: HouseholdRole = households.find((h) => h.id === householdId)?.role ?? (household?.joinCode !== undefined ? 'admin' : 'member');

  useEffect(() => {
    let cancelled = false;
    fetchHousehold(householdId)
      .then((h) => {
        if (!cancelled) setHousehold(h);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Failed to load household'));
      });
    return () => {
      cancelled = true;
    };
  }, [householdId]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!household || !user) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <HouseholdInfo
        household={household}
        role={role}
        memberCount={household.members?.length ?? 0}
        onUpdated={(updated) => {
          setHousehold((prev) => (prev ? { ...prev, ...updated } : updated));
          void refresh();
        }}
      />
      <MemberGrid
        key={gridKey}
        householdId={householdId}
        currentUserId={user.id}
        viewerRole={role}
        onInvite={role === 'admin' ? () => setShowInvite(true) : undefined}
        onChanged={() => void refresh()}
      />
      {showInvite && (
        <InviteModal
          householdId={householdId}
          onClose={() => {
            setShowInvite(false);
            setGridKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
