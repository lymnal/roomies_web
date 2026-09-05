// src/components/dashboard/MemberGrid.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineEllipsisHorizontal, HiOutlineUserPlus } from 'react-icons/hi2';
import { errorMessage } from '@/lib/api-client';
import { fetchMembers, removeMember, updateMemberRole } from '@/lib/services/households';
import { fetchBalances } from '@/lib/services/expenses';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { Balance, HouseholdRole, Member } from '@/types';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/Confirm';
import Menu, { type MenuItem } from '@/components/ui/Menu';
import { SkeletonList } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface MemberGridProps {
  householdId: string;
  currentUserId: string;
  viewerRole: HouseholdRole;
  onInvite?: () => void;
  onChanged?: () => void;
}

export default function MemberGrid({ householdId, currentUserId, viewerRole, onInvite, onChanged }: MemberGridProps) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
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
    try {
      await updateMemberRole(householdId, member.userId, role);
      await load();
      onChanged?.();
      toast.success(role === 'admin' ? `${member.name} is now an admin` : `${member.name} is now a member`);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update role'));
    } finally {
      setBusyUserId(null);
    }
  };

  const remove = async (member: Member) => {
    const isSelf = member.userId === currentUserId;
    const ok = await confirm({
      title: isSelf ? 'Leave this household?' : `Remove ${member.name}?`,
      description: isSelf
        ? 'You lose access to its expenses, tasks and chat. Expenses you paid stay in the ledger.'
        : `${member.name} loses access to the household. Their expenses stay in the ledger.`,
      confirmLabel: isSelf ? 'Leave household' : 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyUserId(member.userId);
    try {
      await removeMember(householdId, member.userId);
      if (isSelf) {
        toast.success('You left the household');
        onChanged?.();
        router.push('/dashboard');
        router.refresh();
        return;
      }
      await load();
      onChanged?.();
      toast.success(`${member.name} removed`);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to remove member'));
    } finally {
      setBusyUserId(null);
    }
  };

  const isAdmin = viewerRole === 'admin';

  const menuFor = (member: Member): MenuItem[] => {
    const isSelf = member.userId === currentUserId;
    const items: MenuItem[] = [];
    if (isAdmin && !isSelf) {
      items.push({
        label: member.role === 'admin' ? 'Make member' : 'Make admin',
        onSelect: () => void changeRole(member, member.role === 'admin' ? 'member' : 'admin'),
      });
      items.push({ label: 'Remove from household', tone: 'danger', onSelect: () => void remove(member) });
    } else if (isSelf) {
      items.push({ label: 'Leave household', tone: 'danger', onSelect: () => void remove(member) });
    }
    return items;
  };

  return (
    <Card
      title="Members"
      description={loading ? 'Loading…' : `${members.length} ${members.length === 1 ? 'person' : 'people'} share this home`}
      actions={
        onInvite && (
          <Button size="sm" leftIcon={<HiOutlineUserPlus className="h-4 w-4" />} onClick={onInvite}>
            Invite
          </Button>
        )
      }
      noPadding
    >
      {error && (
        <div className="px-5 pt-4">
          <Alert kind="error" onDismiss={() => setError('')}>
            {error}
          </Alert>
        </div>
      )}

      {loading ? (
        <SkeletonList rows={3} className="p-5" />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {members.map((member) => {
            const balance = balances[member.userId];
            const isSelf = member.userId === currentUserId;
            const busy = busyUserId === member.userId;
            const items = menuFor(member);
            return (
              <li key={member.id} className={cn('flex items-center gap-3 px-5 py-3 transition-opacity', busy && 'opacity-60')}>
                <Avatar src={member.avatar} name={member.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{member.name}</p>
                    {isSelf && <Badge tone="brand">You</Badge>}
                    {member.role === 'admin' && <Badge tone="purple">Admin</Badge>}
                  </div>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {member.email}
                    {member.joinedAt ? ` · joined ${formatDate(member.joinedAt)}` : ''}
                  </p>
                </div>
                {balance && (
                  <p
                    className={cn(
                      'hidden flex-shrink-0 text-sm font-medium tabular-nums sm:block',
                      balance.net > 0.004 ? 'text-emerald-600 dark:text-emerald-400' : balance.net < -0.004 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                    )}
                  >
                    {balance.net > 0.004 ? `+${formatCurrency(balance.net)}` : balance.net < -0.004 ? `−${formatCurrency(-balance.net)}` : 'settled'}
                  </p>
                )}
                {items.length > 0 && (
                  <Menu
                    ariaLabel={`Actions for ${member.name}`}
                    items={items}
                    trigger={() => (
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                        <HiOutlineEllipsisHorizontal className="h-5 w-5" />
                      </span>
                    )}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
