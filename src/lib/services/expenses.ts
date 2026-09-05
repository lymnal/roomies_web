// src/lib/services/expenses.ts — client-side calls for expenses, shares and settlements
import { apiFetch } from '@/lib/api-client';
import type { Balance, Expense, ExpenseInput } from '@/types';

export function fetchExpenses(householdId: string): Promise<Expense[]> {
  return apiFetch<Expense[]>(`/api/expenses?household_id=${encodeURIComponent(householdId)}`);
}

export function createExpense(input: ExpenseInput): Promise<Expense> {
  return apiFetch<Expense>('/api/expenses', { method: 'POST', json: input });
}

export function updateExpense(expenseId: string, input: Omit<ExpenseInput, 'householdId'>): Promise<Expense> {
  return apiFetch<Expense>(`/api/expenses/${expenseId}`, { method: 'PATCH', json: input });
}

export function deleteExpense(expenseId: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/expenses/${expenseId}`, { method: 'DELETE' });
}

export interface SettleResult {
  id: string;
  status: 'PENDING' | 'COMPLETED';
  settled: boolean;
  settledAt: string | null;
  settlementId: string | null;
  changed: boolean;
}

/** Mark one share of an expense as paid (or not). Balances update through the ledger. */
export function settleShare(splitId: string, settled: boolean): Promise<SettleResult> {
  return apiFetch<SettleResult>(`/api/payments/${splitId}`, {
    method: 'PATCH',
    json: { status: settled ? 'COMPLETED' : 'PENDING' },
  });
}

export function fetchBalances(householdId: string): Promise<Balance[]> {
  return apiFetch<Balance[]>(`/api/households/${householdId}/balances`);
}

export interface SettlementInput {
  householdId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  description?: string;
}

export function recordSettlement(input: SettlementInput): Promise<{ message: string; settlementId: string; amount: number }> {
  return apiFetch('/api/payments/mark-complete', { method: 'POST', json: input });
}
