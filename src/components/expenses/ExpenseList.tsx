// src/components/expenses/ExpenseList.tsx
// Expense rows with expandable shares. Money is shown from the viewer's point of view.
'use client';

import { useState } from 'react';
import { HiOutlineBanknotes, HiOutlineCheck, HiOutlineChevronDown, HiOutlineEllipsisHorizontal, HiOutlinePencilSquare, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi2';
import { cn, formatCurrency, formatDate, relativeDay } from '@/lib/utils';
import type { Expense, Split } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Menu from '@/components/ui/Menu';

export type ExpenseFilter = 'ALL' | 'PAID_BY_ME' | 'I_OWE' | 'SETTLED';

interface ExpenseListProps {
  expenses: Expense[];
  filter: ExpenseFilter;
  currentUserId: string;
  busyId: string | null;
  canManage: (expense: Expense) => boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onSettle: (split: Split, settled: boolean) => void;
  onAdd: () => void;
}

const EMPTY: Record<ExpenseFilter, { title: string; description: string }> = {
  ALL: { title: 'No expenses yet', description: 'Add the first shared cost and balances light up.' },
  PAID_BY_ME: { title: 'Nothing paid by you yet', description: 'Expenses you cover for the house show up here.' },
  I_OWE: { title: 'You owe nothing', description: 'Every share of yours is paid. Nice.' },
  SETTLED: { title: 'Nothing settled yet', description: 'Fully paid-off expenses appear here.' },
};

export default function ExpenseList({ expenses, filter, currentUserId, busyId, canManage, onEdit, onDelete, onSettle, onAdd }: ExpenseListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <EmptyState
          icon={<HiOutlineBanknotes className="h-6 w-6" />}
          title={EMPTY[filter].title}
          description={EMPTY[filter].description}
          action={
            filter === 'ALL' && (
              <Button size="sm" leftIcon={<HiOutlinePlus className="h-4 w-4" />} onClick={onAdd}>
                Add expense
              </Button>
            )
          }
        />
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      {expenses.map((expense) => {
        const isPayer = expense.paidBy === currentUserId;
        const mySplit = expense.splits.find((s) => s.userId === currentUserId);
        const owedShares = expense.splits.filter((s) => s.userId !== expense.paidBy);
        const settledCount = owedShares.filter((s) => s.settled).length;
        const expanded = expandedId === expense.id;
        const busy = busyId === expense.id;
        const iOwe = !isPayer && Boolean(mySplit) && (mySplit?.amount ?? 0) > 0 && !mySplit?.settled;
        const manageable = canManage(expense);

        const status = isPayer ? (
          <Badge tone={owedShares.length > 0 && settledCount === owedShares.length ? 'success' : 'brand'}>
            {owedShares.length === 0 ? 'Just you' : `${settledCount}/${owedShares.length} paid back`}
          </Badge>
        ) : !mySplit || mySplit.amount === 0 ? (
          <Badge tone="neutral">Not involved</Badge>
        ) : mySplit.settled ? (
          <Badge tone="success">Settled</Badge>
        ) : (
          <Badge tone="warning">You owe {formatCurrency(mySplit.amount)}</Badge>
        );

        const toggle = () => setExpandedId(expanded ? null : expense.id);

        return (
          <li key={expense.id} className={cn('transition-opacity', busy && 'opacity-60')}>
            <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <Avatar src={expense.paidByAvatar} name={expense.paidByName} size={40} />
              <button type="button" onClick={toggle} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{expense.title}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {isPayer ? 'You' : expense.paidByName} paid · {relativeDay(expense.date)} · {expense.splits.length} {expense.splits.length === 1 ? 'person' : 'people'}
                </p>
              </button>
              <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(expense.amount)}</p>
                  <div className="mt-0.5 hidden sm:block">{status}</div>
                </div>
                {iOwe && mySplit && (
                  <Button size="xs" className="hidden sm:inline-flex" isLoading={busyId === mySplit.id} onClick={() => onSettle(mySplit, true)} leftIcon={<HiOutlineCheck className="h-3.5 w-3.5" />}>
                    Mark paid
                  </Button>
                )}
                {manageable && (
                  <Menu
                    ariaLabel={`Actions for ${expense.title}`}
                    items={[
                      { label: 'Edit', icon: <HiOutlinePencilSquare className="h-4 w-4" />, onSelect: () => onEdit(expense) },
                      { label: 'Delete', icon: <HiOutlineTrash className="h-4 w-4" />, tone: 'danger', onSelect: () => onDelete(expense) },
                    ]}
                    trigger={() => (
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                        <HiOutlineEllipsisHorizontal className="h-5 w-5" />
                      </span>
                    )}
                  />
                )}
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={expanded ? 'Hide shares' : 'Show shares'}
                  className="hidden rounded-lg p-1 text-slate-400 transition-colors hover:text-slate-600 sm:block dark:hover:text-slate-200"
                >
                  <HiOutlineChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 px-4 pb-3 sm:hidden">
              {status}
              {iOwe && mySplit && (
                <Button size="xs" isLoading={busyId === mySplit.id} onClick={() => onSettle(mySplit, true)} leftIcon={<HiOutlineCheck className="h-3.5 w-3.5" />}>
                  Mark paid
                </Button>
              )}
            </div>

            {expanded && (
              <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 animate-fade-in sm:px-5 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">Shares · {formatDate(expense.date)}</p>
                <ul className="space-y-2">
                  {expense.splits.map((split) => {
                    const isPayerShare = split.userId === expense.paidBy;
                    const canToggle = !isPayerShare && split.amount > 0 && (manageable || split.userId === currentUserId);
                    return (
                      <li key={split.id} className="flex items-center gap-3 text-sm">
                        <Avatar src={split.avatar} name={split.userName} size={28} />
                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                          {split.userId === currentUserId ? 'You' : split.userName}
                          {isPayerShare && <span className="ml-1 text-xs text-slate-400">paid the bill</span>}
                        </span>
                        <span className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(split.amount)}</span>
                        <span className="flex-shrink-0">
                          {isPayerShare ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : split.settled ? (
                            <Badge tone="success" className={split.settledAt ? 'cursor-help' : ''}>
                              Settled
                            </Badge>
                          ) : (
                            <Badge tone="warning">Owes</Badge>
                          )}
                        </span>
                        {canToggle ? (
                          <Button size="xs" variant={split.settled ? 'ghost' : 'outline'} isLoading={busyId === split.id} onClick={() => onSettle(split, !split.settled)}>
                            {split.settled ? 'Undo' : 'Mark paid'}
                          </Button>
                        ) : (
                          <span className="hidden w-[4.5rem] sm:block" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
