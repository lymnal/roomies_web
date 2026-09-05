import { describe, expect, it } from 'vitest';
import { parseExpenseInput, parseInvitationInput, parseTaskInput } from '@/lib/validation';
import { HttpError } from '@/lib/supabase-server';

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111';
const ALICE = '22222222-2222-4222-8222-222222222222';
const BOB = '33333333-3333-4333-8333-333333333333';

function expectHttp(fn: () => unknown, status: number, messagePart: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    expect((error as HttpError).message).toContain(messagePart);
    return;
  }
  throw new Error('expected an HttpError');
}

describe('parseExpenseInput', () => {
  const valid = {
    householdId: HOUSEHOLD,
    title: '  Groceries ',
    amount: '30',
    date: '2026-09-05',
    splits: [
      { userId: ALICE, amount: 10 },
      { userId: BOB, amount: 20 },
    ],
  };

  it('normalises a valid body', () => {
    const input = parseExpenseInput(valid, { paidBy: ALICE });
    expect(input).toEqual({
      householdId: HOUSEHOLD,
      title: 'Groceries',
      amount: 30,
      date: '2026-09-05',
      paidBy: ALICE,
      splits: [
        { userId: ALICE, amount: 10 },
        { userId: BOB, amount: 20 },
      ],
    });
  });

  it('accepts snake_case aliases and ISO timestamps', () => {
    const input = parseExpenseInput(
      { household_id: HOUSEHOLD, description: 'Rent', amount: 1200, date: '2026-09-01T23:30:00.000Z', paid_by: BOB, splits: [{ user_id: BOB, amount: 1200 }] },
      { paidBy: ALICE }
    );
    expect(input.title).toBe('Rent');
    expect(input.date).toBe('2026-09-01');
    expect(input.paidBy).toBe(BOB);
  });

  it('rejects shares that do not add up', () => {
    expectHttp(() => parseExpenseInput({ ...valid, splits: [{ userId: ALICE, amount: 10 }, { userId: BOB, amount: 19.98 }] }, { paidBy: ALICE }), 400, 'add up');
  });

  it('tolerates float noise in the shares', () => {
    const input = parseExpenseInput({ ...valid, amount: 0.3, splits: [{ userId: ALICE, amount: 0.1 }, { userId: BOB, amount: 0.2 }] }, { paidBy: ALICE });
    expect(input.amount).toBe(0.3);
  });

  it('rejects duplicate people, bad ids, negative shares and non-positive totals', () => {
    expectHttp(() => parseExpenseInput({ ...valid, splits: [{ userId: ALICE, amount: 15 }, { userId: ALICE, amount: 15 }] }, { paidBy: ALICE }), 400, 'only appear once');
    expectHttp(() => parseExpenseInput({ ...valid, splits: [{ userId: 'nope', amount: 30 }] }, { paidBy: ALICE }), 400, 'valid user');
    expectHttp(() => parseExpenseInput({ ...valid, splits: [{ userId: ALICE, amount: -5 }, { userId: BOB, amount: 35 }] }, { paidBy: ALICE }), 400, 'zero or more');
    expectHttp(() => parseExpenseInput({ ...valid, amount: 0, splits: [] }, { paidBy: ALICE }), 400, 'positive');
    expectHttp(() => parseExpenseInput({ ...valid, title: '   ' }, { paidBy: ALICE }), 400, 'Title is required');
    expectHttp(() => parseExpenseInput({ ...valid, date: 'yesterday' }, { paidBy: ALICE }), 400, 'YYYY-MM-DD');
    expectHttp(() => parseExpenseInput({ ...valid, householdId: 'x' }, { paidBy: ALICE }), 400, 'householdId');
  });
});

describe('parseTaskInput', () => {
  it('requires householdId and title when creating', () => {
    expectHttp(() => parseTaskInput({ title: 'Trash' }, { partial: false }), 400, 'householdId');
    expectHttp(() => parseTaskInput({ householdId: HOUSEHOLD }, { partial: false }), 400, 'Title');
  });

  it('turns a date-only due date into noon UTC and upper-cases enums', () => {
    const input = parseTaskInput({ householdId: HOUSEHOLD, title: 'Trash', dueDate: '2026-09-10', priority: 'high', status: 'in_progress', assigneeId: ALICE }, { partial: false });
    expect(input.dueDate).toBe('2026-09-10T12:00:00.000Z');
    expect(input.priority).toBe('HIGH');
    expect(input.status).toBe('IN_PROGRESS');
    expect(input.assigneeId).toBe(ALICE);
  });

  it('allows partial updates and clears the rule when not recurring', () => {
    expect(parseTaskInput({ status: 'COMPLETED' }, { partial: true })).toEqual({ status: 'COMPLETED' });
    expect(parseTaskInput({ recurring: false, recurrenceRule: 'WEEKLY' }, { partial: true })).toEqual({ recurring: false, recurrenceRule: null });
    expect(parseTaskInput({ assigneeId: '' }, { partial: true })).toEqual({ assigneeId: null });
  });

  it('treats explicit nulls as "clear this field" (the form sends null when unassigning)', () => {
    expect(parseTaskInput({ assigneeId: null, dueDate: null, recurrenceRule: null }, { partial: true })).toEqual({
      assigneeId: null,
      dueDate: null,
      recurrenceRule: null,
    });
    expect(parseTaskInput({ assignee_id: null, due_date: null }, { partial: true })).toEqual({ assigneeId: null, dueDate: null });
  });

  it('rejects bad enums and a recurring task without a rule', () => {
    expectHttp(() => parseTaskInput({ priority: 'ASAP' }, { partial: true }), 400, 'Priority');
    expectHttp(() => parseTaskInput({ recurring: true, recurrenceRule: null }, { partial: true }), 400, 'recurrence');
  });
});

describe('parseInvitationInput', () => {
  it('lower-cases the email and defaults the role', () => {
    expect(parseInvitationInput({ householdId: HOUSEHOLD, email: 'Sam@Example.com' })).toEqual({
      householdId: HOUSEHOLD,
      email: 'sam@example.com',
      role: 'member',
      message: null,
    });
  });

  it('rejects unknown roles and bad emails', () => {
    expectHttp(() => parseInvitationInput({ householdId: HOUSEHOLD, email: 'sam@example.com', role: 'guest' }), 400, 'Role');
    expectHttp(() => parseInvitationInput({ householdId: HOUSEHOLD, email: 'not an email' }), 400, 'valid email');
  });
});
