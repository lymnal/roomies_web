import { describe, expect, it } from 'vitest';
import { toBalance, toExpense, toInvitation, toMember, toTask } from '@/lib/serializers';

const ALICE = { id: 'a', name: 'Alice', email: 'alice@example.com', avatar_url: null };
const BOB = { id: 'b', name: ' Bob ', email: 'bob@example.com', avatar_url: 'https://x/bob.png' };

describe('toExpense', () => {
  it('maps rows, coerces numerics and derives payments for everyone but the payer', () => {
    const expense = toExpense({
      id: 'e1',
      household_id: 'h1',
      description: 'Groceries',
      amount: '30.00',
      date: '2026-09-05',
      paid_by: 'a',
      created_by: 'a',
      version: null,
      created_at: '2026-09-05T00:00:00Z',
      updated_at: null,
      paid_by_user: [ALICE],
      splits: [
        { id: 's1', user_id: 'a', amount: '10.00', settled: true, settled_at: '2026-09-05T00:00:00Z', user: ALICE },
        { id: 's2', user_id: 'b', amount: '20.00', settled: false, settled_at: null, user: BOB },
      ],
    });
    expect(expense.amount).toBe(30);
    expect(expense.version).toBe(1);
    expect(expense.paidByName).toBe('Alice');
    expect(expense.splits.map((s) => [s.userName, s.amount, s.settled])).toEqual([
      ['Alice', 10, true],
      ['Bob', 20, false],
    ]);
    expect(expense.payments).toEqual([{ id: 's2', expenseId: 'e1', userId: 'b', userName: 'Bob', amount: 20, status: 'PENDING', date: null }]);
  });
});

describe('toBalance', () => {
  it('splits the net into owes / isOwed', () => {
    expect(toBalance({ user_id: 'a', balance: '12.345', profile: { name: 'Alice' } })).toMatchObject({ net: 12.35, isOwed: 12.35, owes: 0 });
    expect(toBalance({ user_id: 'b', balance: -7, profile: null })).toMatchObject({ userName: 'Unknown', net: -7, owes: 7, isOwed: 0 });
  });
});

describe('toMember / toTask / toInvitation', () => {
  it('normalises roles, names and embeds', () => {
    expect(toMember({ id: 'm1', user_id: 'b', role: 'ADMIN', joined_at: 't', user: BOB })).toMatchObject({ role: 'member', name: 'Bob', avatar: 'https://x/bob.png' });
    expect(toMember({ id: 'm1', user_id: 'b', role: 'admin', joined_at: 't', user: null })).toMatchObject({ role: 'admin', name: 'Unknown', email: '' });

    const task = toTask({
      id: 't1',
      household_id: 'h1',
      title: 'Trash',
      description: null,
      status: 'PENDING',
      priority: 'HIGH',
      creator_id: 'a',
      assignee_id: 'b',
      due_date: null,
      recurring: true,
      recurrence_rule: 'WEEKLY',
      completed_at: null,
      created_at: 'c',
      updated_at: 'u',
      creator: ALICE,
      assignee: [BOB],
    });
    expect(task).toMatchObject({ creatorName: 'Alice', assigneeName: ' Bob ', recurring: true, recurrenceRule: 'WEEKLY' });

    const invitation = toInvitation(
      {
        id: 'i1',
        email: 'sam@example.com',
        household_id: 'h1',
        invited_by: 'a',
        role: null,
        status: null,
        message: null,
        expires_at: 'x',
        created_at: 'c',
        accepted_at: null,
        token: 'secret',
        household: { id: 'h1', name: 'Home', address: null },
        inviter: ALICE,
      },
      { includeToken: false }
    );
    expect(invitation.role).toBe('member');
    expect(invitation.status).toBe('pending');
    expect(invitation.token).toBeUndefined();
    expect(invitation.inviter?.name).toBe('Alice');
  });
});
