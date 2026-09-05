// src/app/(dashboard)/expenses/page.tsx
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useHousehold } from '@/context/HouseholdContext';
import { errorMessage } from '@/lib/api-client';
import { createExpense, deleteExpense, fetchExpenses, settleShare, updateExpense } from '@/lib/services/expenses';
import { fetchMembers } from '@/lib/services/households';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Expense, ExpenseInput, HouseholdRole, Member, Split } from '@/types';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import PaymentMatrix from '@/components/expenses/PaymentMatrix';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import { FullPageSpinner } from '@/components/ui/Spinner';

export default function ExpensesPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <ExpensesGate />
    </Suspense>
  );
}

function ExpensesGate() {
  const { current, loading } = useHousehold();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  if (loading || !user) return <FullPageSpinner />;
  if (!current) {
    return (
      <Alert kind="info">
        You are not in a household yet.{' '}
        <Link href="/dashboard" className="underline">
          Create or join one
        </Link>{' '}
        to start tracking expenses.
      </Alert>
    );
  }
  return <ExpensesView key={current.id} householdId={current.id} currentUserId={user.id} viewerRole={current.role} openNew={searchParams.get('new') === '1'} />;
}

interface ExpensesViewProps {
  householdId: string;
  currentUserId: string;
  viewerRole: HouseholdRole;
  openNew: boolean;
}

function ExpensesView({ householdId, currentUserId, viewerRole, openNew }: ExpensesViewProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(openNew);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [matrixKey, setMatrixKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setError('');
      const [expenseList, memberList] = await Promise.all([fetchExpenses(householdId), fetchMembers(householdId)]);
      setExpenses(expenseList);
      setMembers(memberList);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load expenses'));
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshAll = async () => {
    await load();
    setMatrixKey((k) => k + 1);
  };

  const handleSubmit = async (input: ExpenseInput) => {
    if (editing) {
      await updateExpense(editing.id, input);
    } else {
      await createExpense(input);
    }
    setShowForm(false);
    setEditing(null);
    await refreshAll();
  };

  const handleDelete = async (expense: Expense) => {
    if (!window.confirm(`Delete "${expense.title}" (${formatCurrency(expense.amount)})? Balances will be adjusted.`)) return;
    setBusyId(expense.id);
    setError('');
    try {
      await deleteExpense(expense.id);
      await refreshAll();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete expense'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSettle = async (split: Split, settled: boolean) => {
    setBusyId(split.id);
    setError('');
    try {
      await settleShare(split.id, settled);
      await refreshAll();
    } catch (err) {
      setError(errorMessage(err, 'Failed to update payment'));
    } finally {
      setBusyId(null);
    }
  };

  const canManage = (expense: Expense) => viewerRole === 'admin' || expense.paidBy === currentUserId || expense.createdBy === currentUserId;

  if (loading) return <FullPageSpinner />;

  return (
    <div className="container mx-auto py-2 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Household expenses</h1>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          + Add expense
        </button>
      </div>

      {error && (
        <Alert kind="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      <PaymentMatrix key={matrixKey} householdId={householdId} currentUserId={currentUserId} onSettled={() => void load()} />

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent expenses</h2>
        {expenses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 text-center text-gray-500 dark:text-gray-400">No expenses yet. Add the first one!</div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Expense', 'Date', 'Amount', 'Paid by', 'Your share', 'Status', ''].map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {expenses.map((expense) => {
                    const isPayer = expense.paidBy === currentUserId;
                    const mySplit = expense.splits.find((s) => s.userId === currentUserId);
                    const owedShares = expense.splits.filter((s) => s.userId !== expense.paidBy);
                    const settledCount = owedShares.filter((s) => s.settled).length;
                    const expanded = expandedId === expense.id;
                    const busy = busyId === expense.id;

                    let status: React.ReactNode;
                    if (isPayer) {
                      status = (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          You paid · {settledCount}/{owedShares.length} settled
                        </span>
                      );
                    } else if (!mySplit || mySplit.amount === 0) {
                      status = <span className="text-xs text-gray-400">Not involved</span>;
                    } else if (mySplit.settled) {
                      status = <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Settled</span>;
                    } else {
                      status = <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">You owe</span>;
                    }

                    return (
                      <FragmentRow key={expense.id}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => setExpandedId(expanded ? null : expense.id)} className="text-left">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{expense.title}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {expense.splits.length} {expense.splits.length === 1 ? 'person' : 'people'} · {expanded ? 'hide shares' : 'show shares'}
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(expense.date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(expense.amount)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            <span className="inline-flex items-center gap-2">
                              <Avatar src={expense.paidByAvatar} name={expense.paidByName} size={24} />
                              {isPayer ? 'You' : expense.paidByName}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{mySplit ? formatCurrency(mySplit.amount) : '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{status}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-3">
                              {!isPayer && mySplit && !mySplit.settled && mySplit.amount > 0 && (
                                <button type="button" disabled={busyId === mySplit.id} onClick={() => void handleSettle(mySplit, true)} className="text-green-600 hover:text-green-800 dark:text-green-400 disabled:opacity-50">
                                  Mark paid
                                </button>
                              )}
                              {canManage(expense) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditing(expense);
                                      setShowForm(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                  >
                                    Edit
                                  </button>
                                  <button type="button" disabled={busy} onClick={() => void handleDelete(expense)} className="text-red-600 hover:text-red-800 dark:text-red-400 disabled:opacity-50">
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-gray-50 dark:bg-gray-900/40">
                            <td colSpan={7} className="px-6 py-3">
                              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                {expense.splits.map((split) => {
                                  const isPayerShare = split.userId === expense.paidBy;
                                  const canToggle = !isPayerShare && (canManage(expense) || split.userId === currentUserId);
                                  return (
                                    <li key={split.id} className="py-2 flex items-center justify-between gap-4 text-sm">
                                      <span className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                                        <Avatar src={split.avatar} name={split.userName} size={24} />
                                        {split.userId === currentUserId ? 'You' : split.userName}
                                        {isPayerShare && <span className="text-xs text-gray-400">(paid)</span>}
                                      </span>
                                      <span className="flex items-center gap-4">
                                        <span className="text-gray-900 dark:text-white">{formatCurrency(split.amount)}</span>
                                        {isPayerShare ? (
                                          <span className="text-xs text-gray-400 w-20 text-right">—</span>
                                        ) : split.settled ? (
                                          <span className="text-xs text-green-600 dark:text-green-400 w-20 text-right">
                                            Settled{split.settledAt ? ` ${formatDate(split.settledAt)}` : ''}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-yellow-700 dark:text-yellow-300 w-20 text-right">Owes</span>
                                        )}
                                        {canToggle && split.amount > 0 && (
                                          <button
                                            type="button"
                                            disabled={busyId === split.id}
                                            onClick={() => void handleSettle(split, !split.settled)}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 w-20 text-right"
                                          >
                                            {split.settled ? 'Undo' : 'Mark paid'}
                                          </button>
                                        )}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </FragmentRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6 shadow-xl">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{editing ? 'Edit expense' : 'Add expense'}</h3>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                  aria-label="Close"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ExpenseForm
                expense={editing}
                members={members}
                householdId={householdId}
                currentUserId={currentUserId}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** React fragments cannot carry keys inside .map() with the shorthand, so use the explicit form. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
