// src/components/dashboard/MemberGrid.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorMessage } from '@/lib/api-client';
import { fetchMembers, removeMember, updateMemberRole } from '@/lib/services/households';
import { fetchBalances } from '@/lib/services/expenses';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Balance, HouseholdRole, Member } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';

interface MemberGridProps {
  householdId: string;
  currentUserId: string;
  viewerRole: HouseholdRole;
  onInvite?: () => void;
  onChanged?: () => void;
}

export default function MemberGrid({ householdId, currentUserId, viewerRole, onInvite, onChanged }: MemberGridProps) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [balances, setBalances] = useState<Record<string, Balance>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [memberList, balanceList] = await Promise.all([fetchMembers(householdId), fetchBalances(householdId).catch(() => [] as Balance[])]);
      setMembers(memberList);
      setBalances(Object.fromEntries(balanceList.map((b) => [b.userId, b])));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load household members'));
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const changeRole = async (member: Member, role: HouseholdRole) => {
    setBusyUserId(member.userId);
    setError('');
    try {
      await updateMemberRole(householdId, member.userId, role);
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err, 'Failed to update role'));
    } finally {
      setBusyUserId(null);
    }
  };

  const remove = async (member: Member) => {
    const isSelf = member.userId === currentUserId;
    const ok = window.confirm(isSelf ? 'Leave this household?' : `Remove ${member.name} from the household?`);
    if (!ok) return;
    setBusyUserId(member.userId);
    setError('');
    try {
      await removeMember(householdId, member.userId);
      if (isSelf) {
        router.push('/dashboard');
        router.refresh();
        return;
      }
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err, 'Failed to remove member'));
    } finally {
      setBusyUserId(null);
    }
  };

  const isAdmin = viewerRole === 'admin';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Household members</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </p>
        </div>
        {onInvite && (
          <button type="button" onClick={onInvite} className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
            + Invite
          </button>
        )}
      </div>

      {error && (
        <div className="px-6 pt-4">
          <Alert kind="error" onDismiss={() => setError('')}>
            {error}
          </Alert>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Spinner />
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {members.map((member) => {
            const balance = balances[member.userId];
            const isSelf = member.userId === currentUserId;
            const busy = busyUserId === member.userId;
            return (
              <li key={member.id} className="px-6 py-4 flex items-center gap-4">
                <Avatar src={member.avatar} name={member.name} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {member.name}
                      {isSelf && <span className="text-gray-400"> (you)</span>}
                    </h4>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        member.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      }`}
                    >
                      {member.role}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {member.email}
                    {member.joinedAt ? ` · joined ${formatDate(member.joinedAt)}` : ''}
                  </p>
                  {balance && (
                    <p className={`mt-1 text-xs ${balance.net > 0 ? 'text-green-600 dark:text-green-400' : balance.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {balance.net > 0 ? `Is owed ${formatCurrency(balance.net)}` : balance.net < 0 ? `Owes ${formatCurrency(-balance.net)}` : 'Settled up'}
                    </p>
                  )}
                </div>
                {(isAdmin || isSelf) && (
                  <div className="flex items-center gap-2 text-xs flex-shrink-0">
                    {isAdmin && !isSelf && (
                      <button type="button" disabled={busy} onClick={() => void changeRole(member, member.role === 'admin' ? 'member' : 'admin')} className="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
                        {member.role === 'admin' ? 'Make member' : 'Make admin'}
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => void remove(member)} className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
                      {isSelf ? 'Leave' : 'Remove'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
