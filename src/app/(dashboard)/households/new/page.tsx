// src/app/(dashboard)/households/new/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useHousehold } from '@/context/HouseholdContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import NoHousehold from '@/components/dashboard/NoHousehold';

export default function NewHouseholdPage() {
  usePageTitle('Create or join a household');
  const router = useRouter();
  const { refresh, setCurrentId } = useHousehold();

  return (
    <NoHousehold
      title="Another household?"
      onJoined={async (householdId) => {
        await refresh();
        setCurrentId(householdId);
        router.push('/dashboard');
      }}
    />
  );
}
