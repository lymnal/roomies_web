// src/app/(dashboard)/expenses/page.tsx
'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { HiOutlineArrowTrendingUp, HiOutlineBanknotes, HiOutlinePlus, HiOutlineScale } from 'react-icons/hi2';
import { useAuth } from '@/context/AuthContext';
import { useHousehold } from '@/context/HouseholdContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { errorMessage } from '@/lib/api-client';
import { createExpense, deleteExpense, fetchBalances, fetchExpenses, settleShare, updateExpense } from '@/lib/services/expenses';
import { fetchMembers } from '@/lib/services/households';
import { cn, formatCurrency, todayISODate } from '@/lib/utils';
import type { Balance, Expense, ExpenseInput, HouseholdRole, Member, Split } from '@/types';
import HouseholdRequired from '@/components/dashboard/HouseholdRequired';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import ExpenseList, { type ExpenseFilter } from '@/components/expenses/ExpenseList';
import PaymentMatrix from '@/components/expenses/PaymentMatrix';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Confirm';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import Segmented from '@/components/ui/Segmented';
import Skeleton, { SkeletonCard } from '@/components/ui/Skeleton';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

export default function ExpensesPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <ExpensesGate />
    </Suspense>
  );
}

function ExpensesGate() {
  usePageTitle('Expenses');
  const { current, loading } = useHousehold();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  if (loading || !user) return <FullPageSpinner />;
  if (!current) return <HouseholdRequired feature="tracking expenses" />;

  return (
    <ExpensesView
      key={current.id}
      householdId={current.id}
      householdName={current.name}
      currentUserId={user.id}
      viewerRole={current.role}
      openNew={searchParams.get('new') === '1'}
      initialView={searchParams.get('tab') === 'settle' ? 'plan' : 'summary'}
    />
  );
}

interface ExpensesViewProps {
  householdId: string;
  householdName: string;
  currentUserId: string;
  viewerRole: HouseholdRole;
  openNew: boolean;
  initialView: 'summary' | 'plan';
}

function matchesFilter(expense: Expense, filter: ExpenseFilter, currentUserId: string): boolean {
  const mySplit = expense.splits.find((s) => s.userId === currentUserId);
  const owedShares = expense.splits.filter((s) => s.userId !== expense.paidBy);
  switch (filter) {
    case 'PAID_BY_ME':
      return expense.paidBy === currentUserId;
    case 'I_OWE':
      return expense.paidBy !== currentUserId && Boolean(mySplit) && (mySplit?.amount ?? 0) > 0 && !mySplit?.settled;
    case 'SETTLED':
      return expense.paidBy === currentUserId ? owedShares.length > 0 && owedShares.every((s) => s.settled) : Boolean(mySplit?.settled);
    default:
      return true;
  }
}

function ExpensesView({ householdId, householdName, currentUserId, viewerRole, openNew, initialView }: ExpensesViewProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(openNew);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExpenseFilter>('ALL');

  const load = useCallback(async () => {
    try {
      setError('');
      const [expenseList, memberList, balanceList] = await Promise.all([fetchExpenses(householdId), fetchMembers(householdId), fetchBalances(householdId)]);
      setExpenses(expenseList);
      setMembers(memberList);
      setBalances(balanceList);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load expenses'));
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const net = balances.find((b) => b.userId === currentUserId)?.net ?? 0;
    const monthKey = todayISODate().slice(0, 7);
    const monthTotal = expenses.filter((e) => e.date.startsWith(monthKey)).reduce((sum, e) => sum + e.amount, 0);
    const unpaid = expenses.flatMap((e) => e.splits.filter((s) => s.userId === currentUserId && e.paidBy !== currentUserId && !s.settled && s.amount > 0));
    return { net, monthTotal, unpaidCount: unpaid.length, unpaidTotal: unpaid.reduce((sum, s) => sum + s.amount, 0) };
  }, [balances, expenses, currentUserId]);

  const counts = useMemo(
    () => ({
      ALL: expenses.length,
      PAID_BY_ME: expenses.filter((e) => matchesFilter(e, 'PAID_BY_ME', currentUserId)).length,
      I_OWE: expenses.filter((e) => matchesFilter(e, 'I_OWE', currentUserId)).length,
      SETTLED: expenses.filter((e) => matchesFilter(e, 'SETTLED', currentUserId)).length,
    }),
    [expenses, currentUserId]
  );

  const visible = useMemo(() => expenses.filter((e) => matchesFilter(e, filter, currentUserId)), [expenses, filter, currentUserId]);

  const openForm = (expense: Expense | null) => {
    setEditing(expense);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (input: ExpenseInput) => {
    if (editing) {
      await updateExpense(editing.id, input);
      toast.success('Expense updated', 'The ledger was corrected.');
    } else {
      await createExpense(input);
      toast.success('Expense added', `${input.title} · ${formatCurrency(input.amount)}`);
    }
    closeForm();
    await load();
  };

  const handleDelete = async (expense: Expense) => {
    const ok = await confirm({
      title: `Delete "${expense.title}"?`,
      description: `${formatCurrency(expense.amount)} comes off everyone's balance. The ledger keeps a reversal entry.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(expense.id);
    try {
      await deleteExpense(expense.id);
      await load();
      toast.success('Expense deleted');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete expense'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSettle = async (split: Split, settled: boolean) => {
    setBusyId(split.id);
    try {
      await settleShare(split.id, settled);
      await load();
      toast.success(settled ? 'Marked as paid' : 'Marked as unpaid');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update payment'));
    } finally {
      setBusyId(null);
    }
  };

  const canManage = (expense: Expense) => viewerRole === 'admin' || expense.paidBy === currentUserId || expense.createdBy === currentUserId;

  if (loading) return <ExpensesSkeleton />;

  const netLabel = stats.net > 0.004 ? 'You are owed' : stats.net < -0.004 ? 'You owe' : 'Your balance';

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow={householdName}
        title="Expenses"
        description="Every shared cost, who paid, and who still owes."
        actions={
          <Button leftIcon={<HiOutlinePlus className="h-4 w-4" />} onClick={() => openForm(null)}>
            Add expense
          </Button>
        }
      />

      {error && (
        <Alert kind="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<HiOutlineScale className="h-5 w-5" />}
          tone={stats.net > 0.004 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' : stats.net < -0.004 ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}
          label={netLabel}
          value={formatCurrency(Math.abs(stats.net))}
          hint={Math.abs(stats.net) < 0.005 ? 'All settled up' : 'From the ledger'}
        />
        <StatCard icon={<HiOutlineArrowTrendingUp className="h-5 w-5" />} tone="bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" label="This month" value={formatCurrency(stats.monthTotal)} hint="Household total" />
        <StatCard
          icon={<HiOutlineBanknotes className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300"
          label="Your unpaid shares"
          value={String(stats.unpaidCount)}
          hint={stats.unpaidCount > 0 ? `${formatCurrency(stats.unpaidTotal)} to pay` : 'Nothing outstanding'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Segmented
            ariaLabel="Filter expenses"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: 'All', count: counts.ALL },
              { value: 'PAID_BY_ME', label: 'You paid', count: counts.PAID_BY_ME },
              { value: 'I_OWE', label: 'You owe', count: counts.I_OWE },
              { value: 'SETTLED', label: 'Settled', count: counts.SETTLED },
            ]}
          />
          <ExpenseList
            expenses={visible}
            filter={filter}
            currentUserId={currentUserId}
            busyId={busyId}
            canManage={canManage}
            onEdit={(expense) => openForm(expense)}
            onDelete={(expense) => void handleDelete(expense)}
            onSettle={(split, settled) => void handleSettle(split, settled)}
            onAdd={() => openForm(null)}
          />
        </div>
        <div>
          <PaymentMatrix householdId={householdId} balances={balances} currentUserId={currentUserId} initialView={initialView} onSettled={load} />
        </div>
      </div>

      <Modal
        open={showForm}
        onClose={closeForm}
        title={editing ? 'Edit expense' : 'Add expense'}
        description={editing ? 'Changes post a correction to the ledger.' : 'Split it now and balances update instantly.'}
        size="lg"
      >
        {showForm && (
          <ExpenseForm key={editing?.id ?? 'new'} expense={editing} members={members} householdId={householdId} currentUserId={currentUserId} onSubmit={handleSubmit} onCancel={closeForm} />
        )}
      </Modal>
    </div>
  );
}

function StatCard({ icon, tone, label, value, hint }: { icon: React.ReactNode; tone: string; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <span className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', tone)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
        {hint && <p className="truncate text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

function ExpensesSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-10 w-72 rounded-xl" />
          <SkeletonCard lines={6} />
        </div>
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}
