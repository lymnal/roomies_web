// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useHousehold } from '@/context/HouseholdContext';
import { errorMessage } from '@/lib/api-client';
import { fetchSummary } from '@/lib/services/households';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { DashboardSummary, Household } from '@/types';
import HouseholdInfo from '@/components/dashboard/HouseholdInfo';
import MemberGrid from '@/components/dashboard/MemberGrid';
import NoHousehold from '@/components/dashboard/NoHousehold';
import InviteModal from '@/components/invitations/InviteModal';
import UserInvitationsList from '@/components/invitations/UserInvitationsList';
import Alert from '@/components/ui/Alert';
import Card from '@/components/ui/Card';
import { FullPageSpinner } from '@/components/ui/Spinner';

export default function DashboardPage() {
  const { current, loading, error, refresh, setCurrentId } = useHousehold();

  if (loading) return <FullPageSpinner />;
  if (error) return <Alert kind="error">{error}</Alert>;

  if (!current) {
    return (
      <NoHousehold
        onJoined={async (householdId) => {
          await refresh();
          setCurrentId(householdId);
        }}
      />
    );
  }

  return <DashboardContent householdId={current.id} />;
}

function StatTile({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 h-full">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}

function DashboardContent({ householdId }: { householdId: string }) {
  const { user } = useAuth();
  const { refresh: refreshHouseholds } = useHousehold();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [membersKey, setMembersKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setError('');
      setSummary(await fetchSummary(householdId));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load your household'));
    }
  }, [householdId]);

  useEffect(() => {
    setSummary(null);
    void load();
  }, [load]);

  const handleHouseholdUpdated = (household: Household) => {
    setSummary((prev) => (prev ? { ...prev, household: { ...prev.household, ...household } } : prev));
    void refreshHouseholds();
  };

  if (error) {
    return (
      <Alert kind="error">
        {error}{' '}
        <button type="button" className="underline" onClick={() => void load()}>
          Retry
        </button>
      </Alert>
    );
  }
  if (!summary || !user) return <FullPageSpinner />;

  const balanceLabel = summary.myBalance > 0 ? 'You are owed' : summary.myBalance < 0 ? 'You owe' : 'All settled';
  const balanceHint = summary.myPendingShares.count > 0 ? `${summary.myPendingShares.count} share${summary.myPendingShares.count === 1 ? '' : 's'} to pay (${formatCurrency(summary.myPendingShares.total)})` : 'No unpaid shares';

  return (
    <div className="space-y-6">
      <UserInvitationsList compact />

      <HouseholdInfo household={summary.household} role={summary.role} memberCount={summary.memberCount} onUpdated={handleHouseholdUpdated} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={balanceLabel} value={formatCurrency(Math.abs(summary.myBalance))} hint={balanceHint} href="/expenses" />
        <StatTile label="Your open tasks" value={String(summary.myOpenTaskCount)} hint="Assigned to you" href="/tasks" />
        <StatTile label="Messages today" value={String(summary.messagesToday)} href="/chat" />
        <StatTile label="Members" value={String(summary.memberCount)} href={`/households/${householdId}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/expenses?new=1" className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-blue-50 dark:hover:bg-gray-700 transition font-medium text-gray-900 dark:text-white">
              + Add expense
            </Link>
            <Link href="/tasks?new=1" className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-green-50 dark:hover:bg-gray-700 transition font-medium text-gray-900 dark:text-white">
              + Create task
            </Link>
            {summary.role === 'admin' && (
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-purple-50 dark:hover:bg-gray-700 transition font-medium text-gray-900 dark:text-white"
              >
                + Invite roommate
              </button>
            )}
          </div>

          <MemberGrid key={membersKey} householdId={householdId} currentUserId={user.id} viewerRole={summary.role} onInvite={summary.role === 'admin' ? () => setShowInviteModal(true) : undefined} onChanged={() => void load()} />
        </div>

        <Card title="Upcoming tasks">
          {summary.upcomingTasks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nothing due. Enjoy the calm.</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {summary.upcomingTasks.map((task) => (
                <li key={task.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {task.assigneeName ?? 'Unassigned'}
                      {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      task.priority === 'URGENT'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : task.priority === 'HIGH'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {task.priority.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/tasks" className="mt-3 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
            All tasks →
          </Link>
        </Card>
      </div>

      {showInviteModal && (
        <InviteModal
          householdId={householdId}
          onClose={() => {
            setShowInviteModal(false);
            setMembersKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
