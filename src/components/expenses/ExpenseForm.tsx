// src/components/expenses/ExpenseForm.tsx
'use client';

import { useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { splitByPercentage, splitEqually, splitsMatchTotal, sumSplits } from '@/lib/splits';
import { cn, formatCurrency, roundCents, todayISODate } from '@/lib/utils';
import type { Expense, ExpenseInput, Member } from '@/types';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { FormField, Input, Select } from '@/components/ui/Field';
import Segmented from '@/components/ui/Segmented';

type SplitType = 'EQUAL' | 'PERCENTAGE' | 'CUSTOM';

interface ExpenseFormProps {
  expense: Expense | null;
  members: Member[];
  householdId: string;
  currentUserId: string;
  onSubmit: (input: ExpenseInput) => Promise<void>;
  onCancel: () => void;
}

const smallInput =
  'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-right text-sm tabular-nums text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800';

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

  const splitTotal = sumSplits(includedIds, computedSplits);
  const percentTotal = roundCents(includedIds.reduce((sum, id) => sum + (percentages[id] ?? 0), 0));
  const totalsMatch = splitsMatchTotal(amount, includedIds, computedSplits);
  const allIncluded = includedIds.length === members.length;

  const toggleIncluded = (userId: string) => {
    setIncluded((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Give the expense a name';
    if (!(amount > 0)) return 'Amount must be greater than 0';
    if (!date) return 'Pick a date';
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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && <Alert kind="error">{error}</Alert>}

      <FormField label="What was it for?" htmlFor="expense-title">
        <Input id="expense-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Groceries, rent, internet…" required maxLength={200} autoFocus autoComplete="off" />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount" htmlFor="expense-amount">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">$</span>
            <Input
              id="expense-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0.00"
              required
              className="pl-7 text-lg font-semibold tabular-nums"
            />
          </div>
        </FormField>
        <FormField label="Date" htmlFor="expense-date">
          <Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required max={todayISODate()} />
        </FormField>
      </div>

      <FormField label="Paid by" htmlFor="expense-paid-by">
        <Select id="expense-paid-by" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.userId === currentUserId ? `You (${m.name})` : m.name}
            </option>
          ))}
        </Select>
      </FormField>

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">Split</p>
        <Segmented
          ariaLabel="Split method"
          value={splitType}
          onChange={setSplitType}
          options={[
            { value: 'EQUAL', label: 'Equally' },
            { value: 'PERCENTAGE', label: 'By percentage' },
            { value: 'CUSTOM', label: 'Custom amounts' },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-800/60">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Split between</span>
          <button type="button" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => setIncluded(allIncluded ? [] : members.map((m) => m.userId))}>
            {allIncluded ? 'Clear' : 'Everyone'}
          </button>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {members.map((member) => {
            const isIncluded = included.includes(member.userId);
            return (
              <li key={member.userId} className={cn('flex items-center gap-3 px-4 py-2.5 transition-opacity', !isIncluded && 'opacity-60')}>
                <input
                  type="checkbox"
                  checked={isIncluded}
                  onChange={() => toggleIncluded(member.userId)}
                  className="form-checkbox h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
                  aria-label={`Include ${member.name}`}
                />
                <Avatar src={member.avatar} name={member.name} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
                  {member.userId === currentUserId ? 'You' : member.name}
                  {member.userId === paidBy && <span className="ml-1.5 text-xs text-slate-400">paid</span>}
                </span>
                {splitType === 'PERCENTAGE' && (
                  <div className="relative w-24">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      disabled={!isIncluded}
                      value={percentages[member.userId] ?? 0}
                      onChange={(e) => setPercentages((prev) => ({ ...prev, [member.userId]: Number(e.target.value) || 0 }))}
                      className={cn(smallInput, 'pr-6')}
                      aria-label={`${member.name} percentage`}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-slate-400">%</span>
                  </div>
                )}
                {splitType === 'CUSTOM' ? (
                  <div className="relative w-28">
                    <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={!isIncluded}
                      value={customAmounts[member.userId] ?? ''}
                      onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [member.userId]: e.target.value }))}
                      className={cn(smallInput, 'pl-5')}
                      aria-label={`${member.name} amount`}
                    />
                  </div>
                ) : (
                  <span className="w-20 text-right text-sm tabular-nums text-slate-800 dark:text-slate-100">{isIncluded ? formatCurrency(computedSplits[member.userId] ?? 0) : '—'}</span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-800/60">
          <span className="text-slate-500 dark:text-slate-400">Total of shares</span>
          <span className={cn('font-semibold tabular-nums', totalsMatch ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400')}>
            {formatCurrency(splitTotal)}
            {splitType === 'PERCENTAGE' && ` · ${percentTotal.toFixed(percentTotal % 1 === 0 ? 0 : 2)}%`}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {expense ? 'Save changes' : 'Add expense'}
        </Button>
      </div>
    </form>
  );
}
