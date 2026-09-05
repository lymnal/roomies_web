// src/app/(dashboard)/tasks/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useHousehold } from '@/context/HouseholdContext';
import { errorMessage } from '@/lib/api-client';
import { fetchMembers } from '@/lib/services/households';
import type { Member } from '@/types';
import TasksClientPage from '@/components/tasks/TasksClientPage';
import Alert from '@/components/ui/Alert';
import { FullPageSpinner } from '@/components/ui/Spinner';

export default function TasksPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <TasksGate />
    </Suspense>
  );
}

function TasksGate() {
  const { current, loading } = useHousehold();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');

  const householdId = current?.id ?? null;

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    setMembers(null);
    fetchMembers(householdId)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Failed to load household members'));
      });
    return () => {
      cancelled = true;
    };
  }, [householdId]);

  if (loading || !user) return <FullPageSpinner />;
  if (!current) {
    return (
      <Alert kind="info">
        You are not in a household yet.{' '}
        <Link href="/dashboard" className="underline">
          Create or join one
        </Link>{' '}
        to start assigning tasks.
      </Alert>
    );
  }
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!members) return <FullPageSpinner />;

  return <TasksClientPage key={current.id} householdId={current.id} members={members} currentUserId={user.id} viewerRole={current.role} openNew={searchParams.get('new') === '1'} />;
}
