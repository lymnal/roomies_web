// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  HiOutlineArrowRight,
  HiOutlineBanknotes,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCheck,
  HiOutlineClipboardDocumentCheck,
  HiOutlinePlus,
  HiOutlineSparkles,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { useAuth } from '@/context/AuthContext';
import { useHousehold } from '@/context/HouseholdContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { errorMessage } from '@/lib/api-client';
import { fetchSummary } from '@/lib/services/households';
import { describePayment, planPayments } from '@/lib/settle';
import { cn, firstName, formatCurrency, isBeforeToday, relativeDay } from '@/lib/utils';
import type { DashboardSummary, Household, HouseholdSummary, RecentExpense, TaskPriority } from '@/types';
import HouseholdInfo from '@/components/dashboard/HouseholdInfo';
import MemberGrid from '@/components/dashboard/MemberGrid';
import NoHousehold from '@/components/dashboard/NoHousehold';
import InviteModal from '@/components/invitations/InviteModal';
import UserInvitationsList from '@/components/invitations/UserInvitationsList';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton, { SkeletonCard } from '@/components/ui/Skeleton';
import { FullPageSpinner } from '@/components/ui/Spinner';

const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = { URGENT: 'danger', HIGH: 'warning', MEDIUM: 'info', LOW: 'neutral' };

export default function DashboardPage() {
  usePageTitle('Home');
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

  return <DashboardContent key={current.id} household={current} />;
}

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function DashboardContent({ household }: { household: HouseholdSummary }) {
  const { user } = useAuth();
  const { refresh: refreshHouseholds } = useHousehold();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [membersKey, setMembersKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setError('');
      setSummary(await fetchSummary(household.id));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load your household'));
    }
  }, [household.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleHouseholdUpdated = (updated: Household) => {
    setSummary((prev) => (prev ? { ...prev, household: { ...prev.household, ...updated } } : prev));
    void refreshHouseholds();
  };

  const isAdmin = household.role === 'admin';
  const displayName = (user?.user_metadata?.name as string | undefined) || '';
  const first = firstName(displayName);

  if (error) {
    return (
      <Alert kind="error">
        {error}{' '}
        <button type="button" className="font-medium underline" onClick={() => void load()}>
          Retry
        </button>
      </Alert>
    );
  }
  if (!summary || !user) return <DashboardSkeleton />;

  return (
    <div className="animate-fade-in space-y-6">
      <UserInvitationsList compact />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {timeGreeting()}
            {first ? `, ${first}` : ''}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/tasks?new=1" variant="outline" leftIcon={<HiOutlineClipboardDocumentCheck className="h-4 w-4" />}>
            New task
          </ButtonLink>
          <ButtonLink href="/expenses?new=1" leftIcon={<HiOutlinePlus className="h-4 w-4" />}>
            Add expense
          </ButtonLink>
        </div>
      </header>

      <GettingStarted household={household} hasExpense={summary.recentExpenses.length > 0} onInvite={isAdmin ? () => setShowInvite(true) : undefined} />

      <BalanceHero summary={summary} currentUserId={user.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          href="/tasks"
          icon={<HiOutlineClipboardDocumentCheck className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300"
          label="Your open tasks"
          value={String(summary.myOpenTaskCount)}
          hint={summary.myOpenTaskCount === 0 ? 'Nothing assigned to you' : 'Assigned to you'}
        />
        <StatTile
          href="/expenses"
          icon={<HiOutlineBanknotes className="h-5 w-5" />}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
          label="Spent this month"
          value={formatCurrency(summary.monthSpend)}
          hint="Across the whole household"
        />
        <StatTile
          href="/chat"
          icon={<HiOutlineChatBubbleLeftRight className="h-5 w-5" />}
          tone="bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"
          label="Messages today"
          value={String(summary.messagesToday)}
          hint={summary.messagesToday === 0 ? 'Quiet so far' : 'In the household chat'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RecentExpenses expenses={summary.recentExpenses} currentUserId={user.id} />
          <MemberGrid
            key={membersKey}
            householdId={household.id}
            currentUserId={user.id}
            viewerRole={summary.role}
            onInvite={isAdmin ? () => setShowInvite(true) : undefined}
            onChanged={() => {
              void load();
              void refreshHouseholds();
            }}
          />
        </div>
        <div className="space-y-6">
          <UpcomingTasks tasks={summary.upcomingTasks} />
          <HouseholdInfo household={summary.household} role={summary.role} memberCount={summary.memberCount} onUpdated={handleHouseholdUpdated} />
        </div>
      </div>

      {showInvite && (
        <InviteModal
          householdId={household.id}
          onClose={() => {
            setShowInvite(false);
            setMembersKey((k) => k + 1);
            void refreshHouseholds();
          }}
        />
      )}
    </div>
  );
}

function GettingStarted({ household, hasExpense, onInvite }: { household: HouseholdSummary; hasExpense: boolean; onInvite?: () => void }) {
  const storageKey = `roomies.gettingStarted.${household.id}`;
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(storageKey) === '1');
    } catch {
      setHidden(false);
    }
  }, [storageKey]);

  const steps = [
    {
      key: 'members',
      label: 'Invite your roommates',
      hint: 'Share a link or the join code',
      done: household.memberCount > 1,
      action: onInvite ? (
        <Button size="xs" variant="outline" onClick={onInvite}>
          Invite
        </Button>
      ) : (
        <ButtonLink size="xs" variant="outline" href={`/households/${household.id}`}>
          Members
        </ButtonLink>
      ),
    },
    {
      key: 'expense',
      label: 'Add your first expense',
      hint: 'Rent, groceries, the internet bill',
      done: hasExpense || household.expenseCount > 0,
      action: (
        <ButtonLink size="xs" variant="outline" href="/expenses?new=1">
          Add
        </ButtonLink>
      ),
    },
    {
      key: 'task',
      label: 'Create a task',
      hint: 'Chores, errands, anything shared',
      done: household.taskCount > 0,
      action: (
        <ButtonLink size="xs" variant="outline" href="/tasks?new=1">
          Create
        </ButtonLink>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  if (hidden || doneCount === steps.length) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(storageKey, '1');
    } catch {
      // Private mode: the checklist simply returns next visit.
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
            <HiOutlineSparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Get {household.name} set up</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {doneCount} of {steps.length} done
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide checklist"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <HiOutlineXMark className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.key}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3',
              step.done ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-800'
            )}
          >
            <span
              className={cn(
                'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2',
                step.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'
              )}
            >
              {step.done && <HiOutlineCheck className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-sm font-medium text-slate-900 dark:text-white', step.done && 'text-slate-500 line-through dark:text-slate-400')}>{step.label}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{step.hint}</span>
            </span>
            {!step.done && step.action}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BalanceHero({ summary, currentUserId }: { summary: DashboardSummary; currentUserId: string }) {
  const net = summary.myBalance;
  const plan = useMemo(() => planPayments(summary.balances).filter((p) => p.from === currentUserId || p.to === currentUserId), [summary.balances, currentUserId]);
  const settled = Math.abs(net) < 0.005;
  const label = settled ? 'All settled up' : net > 0 ? 'You are owed' : 'You owe';
  const pending = summary.myPendingShares;
  const hint = settled
    ? 'Nothing owed in either direction. Nice.'
    : pending.count > 0
      ? `${pending.count} unpaid share${pending.count === 1 ? '' : 's'} totalling ${formatCurrency(pending.total)}`
      : 'Straight from the household ledger.';

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-600 to-teal-600 p-6 text-white shadow-pop sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-teal-300/20 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/75">{label}</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">{settled ? formatCurrency(0) : formatCurrency(Math.abs(net))}</p>
          <p className="mt-2 text-sm text-white/80">{hint}</p>
          {plan.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {plan.slice(0, 3).map((payment) => {
                const other = payment.from === currentUserId ? { name: payment.toName, avatar: payment.toAvatar } : { name: payment.fromName, avatar: payment.fromAvatar };
                return (
                  <li
                    key={`${payment.from}-${payment.to}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white/15 py-1 pl-1 pr-3 text-xs font-medium ring-1 ring-inset ring-white/25 backdrop-blur"
                  >
                    <Avatar src={other.avatar} name={other.name} size={22} />
                    {describePayment(payment, currentUserId, formatCurrency)}
                  </li>
                );
              })}
              {plan.length > 3 && <li className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-inset ring-white/25">+{plan.length - 3} more</li>}
            </ul>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {!settled && (
            <Link
              href="/expenses?tab=settle"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white px-4 text-sm font-medium text-brand-700 shadow-sm transition hover:bg-brand-50"
            >
              Settle up
            </Link>
          )}
          <Link
            href="/expenses"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white/15 px-4 text-sm font-medium text-white ring-1 ring-inset ring-white/30 transition hover:bg-white/25"
          >
            All expenses <HiOutlineArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatTile({ href, icon, tone, label, value, hint }: { href: string; icon: React.ReactNode; tone: string; label: string; value: string; hint?: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop dark:border-slate-800 dark:bg-slate-900"
    >
      <span className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', tone)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-500 dark:text-slate-400">{label}</span>
        <span className="block text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</span>
        {hint && <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
      </span>
      <HiOutlineArrowRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600" />
    </Link>
  );
}

function RecentExpenses({ expenses, currentUserId }: { expenses: RecentExpense[]; currentUserId: string }) {
  return (
    <Card
      title="Recent expenses"
      actions={
        <Link href="/expenses" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
          See all
        </Link>
      }
      noPadding
    >
      {expenses.length === 0 ? (
        <EmptyState
          compact
          icon={<HiOutlineBanknotes className="h-6 w-6" />}
          title="No expenses yet"
          description="Log the first shared purchase and balances appear here."
          action={
            <ButtonLink href="/expenses?new=1" size="sm" leftIcon={<HiOutlinePlus className="h-4 w-4" />}>
              Add expense
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {expenses.map((expense) => {
            const isPayer = expense.paidBy === currentUserId;
            return (
              <li key={expense.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar src={expense.paidByAvatar} name={expense.paidByName} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{expense.title}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {isPayer ? 'You' : expense.paidByName} paid · {relativeDay(expense.date)} · {expense.splitCount} {expense.splitCount === 1 ? 'person' : 'people'}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(expense.amount)}</p>
                  {isPayer ? (
                    <p className="text-xs text-slate-400">you paid</p>
                  ) : expense.myShare === null ? (
                    <p className="text-xs text-slate-400">not involved</p>
                  ) : expense.mySettled ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">settled</p>
                  ) : (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">you owe {formatCurrency(expense.myShare)}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function UpcomingTasks({ tasks }: { tasks: DashboardSummary['upcomingTasks'] }) {
  return (
    <Card
      title="Up next"
      description="Open tasks, soonest first"
      actions={
        <Link href="/tasks" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
          All tasks
        </Link>
      }
      noPadding
    >
      {tasks.length === 0 ? (
        <EmptyState
          compact
          icon={<HiOutlineClipboardDocumentCheck className="h-6 w-6" />}
          title="Nothing due"
          description="Enjoy the calm, or plan the next chore."
          action={
            <ButtonLink href="/tasks?new=1" size="sm" variant="outline">
              New task
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {tasks.map((task) => {
            const overdue = isBeforeToday(task.dueDate);
            return (
              <li key={task.id} className="flex items-start gap-3 px-5 py-3">
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
                    overdue ? 'bg-rose-500' : task.priority === 'URGENT' ? 'bg-rose-400' : task.priority === 'HIGH' ? 'bg-amber-400' : 'bg-brand-400'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{task.title}</p>
                  <p className={cn('text-xs', overdue ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400')}>
                    {task.assigneeName ?? 'Unassigned'}
                    {task.dueDate ? ` · ${overdue ? 'overdue, ' : ''}${relativeDay(task.dueDate)}` : ''}
                  </p>
                </div>
                {(task.priority === 'URGENT' || task.priority === 'HIGH') && <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority.toLowerCase()}</Badge>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
        <SkeletonCard lines={4} />
      </div>
    </div>
  );
}
