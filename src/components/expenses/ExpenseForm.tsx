// src/components/expenses/ExpenseForm.tsx
'use client';

import { useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { formatCurrency, roundCents, todayISODate } from '@/lib/utils';
import type { Expense, ExpenseInput, Member } from '@/types';
import Alert from '@/components/ui/Alert';

type SplitType = 'EQUAL' | 'PERCENTAGE' | 'CUSTOM';

interface ExpenseFormProps {
  expense: Expense | null;
  members: Member[];
  householdId: string;
  currentUserId: string;
  onSubmit: (input: ExpenseInput) => Promise<void>;
  onCancel: () => void;
}

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white';
const smallInputClass =
  'w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed';

/** Split `total` across `ids` so the parts sum to the total exactly (last person absorbs rounding). */
function splitEqually(total: number, ids: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  if (ids.length === 0) return result;
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / ids.length);
  let remainder = cents - base * ids.length;
  ids.forEach((id) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    result[id] = (base + extra) / 100;
  });
  return result;
}

function splitByPercentage(total: number, ids: string[], percentages: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  if (ids.length === 0) return result;
  let allocated = 0;
  ids.forEach((id, index) => {
    if (index === ids.length - 1) {
      result[id] = roundCents(total - allocated);
    } else {
      const amount = roundCents((total * (percentages[id] ?? 0)) / 100);
      result[id] = amount;
      allocated = roundCents(allocated + amount);
    }
  });
  return result;
}

function initialSplitType(expense: Expense | null): SplitType {
  if (!expense || expense.splits.length === 0) return 'EQUAL';
  const equal = splitEqually(
    expense.amount,
    expense.splits.map((s) => s.userId)
  );
  const isEqual = expense.splits.every((s) => Math.abs((equal[s.userId] ?? 0) - s.amount) < 0.005);
  return isEqual ? 'EQUAL' : 'CUSTOM';
}

export default function ExpenseForm({ expense, members, householdId, currentUserId, onSubmit, onCancel }: ExpenseFormProps) {
  const [title, setTitle] = useState(expense?.title ?? '');
  const [amountText, setAmountText] = useState(expense ? expense.amount.toFixed(2) : '');
  const [date, setDate] = useState(expense?.date ?? todayISODate());
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? currentUserId);
  const [splitType, setSplitType] = useState<SplitType>(() => initialSplitType(expense));
  const [included, setIncluded] = useState<string[]>(() => (expense ? expense.splits.map((s) => s.userId) : members.map((m) => m.userId)));
  const [percentages, setPercentages] = useState<Record<string, number>>(() => {
    const ids = expense ? expense.splits.map((s) => s.userId) : members.map((m) => m.userId);
    const even = ids.length ? roundCents(100 / ids.length) : 0;
    return Object.fromEntries(ids.map((id) => [id, even]));
  });
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries((expense?.splits ?? []).map((s) => [s.userId, s.amount.toFixed(2)]))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const amount = roundCents(Number(amountText) || 0);
  const includedIds = useMemo(() => members.map((m) => m.userId).filter((id) => included.includes(id)), [members, included]);

  const computedSplits = useMemo<Record<string, number>>(() => {
    if (splitType === 'EQUAL') return splitEqually(amount, includedIds);
    if (splitType === 'PERCENTAGE') return splitByPercentage(amount, includedIds, percentages);
    return Object.fromEntries(includedIds.map((id) => [id, roundCents(Number(customAmounts[id]) || 0)]));
  }, [splitType, amount, includedIds, percentages, customAmounts]);

  const splitTotal = roundCents(includedIds.reduce((sum, id) => sum + (computedSplits[id] ?? 0), 0));
  const percentTotal = roundCents(includedIds.reduce((sum, id) => sum + (percentages[id] ?? 0), 0));
  const totalsMatch = Math.abs(splitTotal - amount) < 0.005;

  const toggleIncluded = (userId: string) => {
    setIncluded((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Give the expense a name';
    if (!(amount > 0)) return 'Amount must be greater than 0';
    if (!date) return 'Pick a date';
    if (!includedIds.includes(paidBy) && splitType !== 'CUSTOM') {
      // Payer not sharing the cost is fine, but be explicit about it.
    }
    if (includedIds.length === 0) return 'Select at least one person to split with';
    if (splitType === 'PERCENTAGE' && Math.abs(percentTotal - 100) > 0.05) return 'Percentages must add up to 100%';
    if (!totalsMatch) return `Shares add up to ${formatCurrency(splitTotal)}, but the total is ${formatCurrency(amount)}`;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit({
        householdId,
        title: title.trim(),
        amount,
        date,
        paidBy,
        splits: includedIds.map((userId) => ({ userId, amount: computedSplits[userId] ?? 0 })),
      });
    } catch (err) {
      setError(errorMessage(err, 'Failed to save expense'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-4">
      {error && <Alert kind="error">{error}</Alert>}

      <div>
        <label htmlFor="expense-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          What was it for?
        </label>
        <input id="expense-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Groceries, Rent, Internet" required maxLength={200} className={inputClass} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="expense-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount ($)
          </label>
          <input id="expense-amount" type="number" inputMode="decimal" step="0.01" min="0.01" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0.00" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="expense-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date
          </label>
          <input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="expense-paid-by" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Paid by
          </label>
          <select id="expense-paid-by" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={inputClass}>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userId === currentUserId ? `You (${m.name})` : m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="expense-split-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Split
          </label>
          <select id="expense-split-type" value={splitType} onChange={(e) => setSplitType(e.target.value as SplitType)} className={inputClass}>
            <option value="EQUAL">Equally</option>
            <option value="PERCENTAGE">By percentage</option>
            <option value="CUSTOM">Custom amounts</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
        <div className={`grid ${splitType === 'PERCENTAGE' ? 'grid-cols-[auto_1fr_5rem_6rem]' : 'grid-cols-[auto_1fr_6rem]'} gap-2 mb-2 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase`}>
          <div />
          <div>Member</div>
          {splitType === 'PERCENTAGE' && <div>%</div>}
          <div className="text-right">Share</div>
        </div>
        {members.map((member) => {
          const isIncluded = included.includes(member.userId);
          return (
            <div key={member.userId} className={`grid ${splitType === 'PERCENTAGE' ? 'grid-cols-[auto_1fr_5rem_6rem]' : 'grid-cols-[auto_1fr_6rem]'} gap-2 mb-2 items-center`}>
              <input type="checkbox" checked={isIncluded} onChange={() => toggleIncluded(member.userId)} className="h-4 w-4 rounded border-gray-300 text-blue-600" aria-label={`Include ${member.name}`} />
              <div className={`text-sm ${isIncluded ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400'}`}>
                {member.userId === currentUserId ? 'You' : member.name}
                {member.userId === paidBy && <span className="ml-1 text-xs text-gray-400">(paid)</span>}
              </div>
              {splitType === 'PERCENTAGE' && (
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  disabled={!isIncluded}
                  value={percentages[member.userId] ?? 0}
                  onChange={(e) => setPercentages((prev) => ({ ...prev, [member.userId]: Number(e.target.value) || 0 }))}
                  className={smallInputClass}
                  aria-label={`${member.name} percentage`}
                />
              )}
              {splitType === 'CUSTOM' ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!isIncluded}
                  value={customAmounts[member.userId] ?? ''}
                  onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [member.userId]: e.target.value }))}
                  className={`${smallInputClass} text-right`}
                  aria-label={`${member.name} amount`}
                />
              ) : (
                <div className="text-sm text-right text-gray-800 dark:text-gray-100">{isIncluded ? formatCurrency(computedSplits[member.userId] ?? 0) : '—'}</div>
              )}
            </div>
          );
        })}
        <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200 dark:border-gray-600 mt-2">
          <span className="text-gray-700 dark:text-gray-300">Total of shares</span>
          <span className={totalsMatch ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}>
            {formatCurrency(splitTotal)}
            {splitType === 'PERCENTAGE' && ` (${percentTotal.toFixed(2)}%)`}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-70">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed">
          {isSubmitting ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}
