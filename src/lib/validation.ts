// src/lib/validation.ts
// Request-body validation for the API routes. Throws HttpError(400) with a user-facing message.
import { HttpError, isUuid } from '@/lib/supabase-server';
import { parseDate, roundCents, todayISODate } from '@/lib/utils';
import type { ExpenseInput, HouseholdRole, RecurrenceRule, SplitInput, TaskInput, TaskPriority, TaskStatus } from '@/types';

type Body = Record<string, unknown>;

const TASK_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];
const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const RECURRENCE_RULES: RecurrenceRule[] = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function num(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

function text(value: unknown, label: string, max: number, required: boolean): string | null {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${label} is required`);
    return null;
  }
  const s = str(value);
  if (s === undefined) throw new HttpError(400, `${label} must be text`);
  const trimmed = s.trim();
  if (!trimmed) {
    if (required) throw new HttpError(400, `${label} is required`);
    return null;
  }
  if (trimmed.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer`);
  return trimmed;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export function parseExpenseInput(
  body: Body,
  defaults: { householdId?: string; paidBy: string; date?: string }
): ExpenseInput {
  const householdId = str(body.householdId) ?? str(body.household_id) ?? defaults.householdId;
  if (!isUuid(householdId)) throw new HttpError(400, 'householdId is required');

  const title = text(body.title ?? body.description, 'Title', 200, true) as string;

  const amount = roundCents(num(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Amount must be a positive number');
  if (amount > 1_000_000) throw new HttpError(400, 'Amount is too large');

  const dateRaw = str(body.date) ?? defaults.date ?? todayISODate();
  const dateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(dateRaw);
  if (!dateMatch || Number.isNaN(parseDate(dateMatch[1]).getTime())) {
    throw new HttpError(400, 'Date must be in YYYY-MM-DD format');
  }
  const date = dateMatch[1];

  const paidBy = str(body.paidBy) ?? str(body.paid_by) ?? defaults.paidBy;
  if (!isUuid(paidBy)) throw new HttpError(400, 'paidBy must be a valid user id');

  const rawSplits = Array.isArray(body.splits) ? (body.splits as unknown[]) : null;
  if (!rawSplits || rawSplits.length === 0) throw new HttpError(400, 'At least one split is required');

  const seen = new Set<string>();
  const splits: SplitInput[] = rawSplits.map((raw) => {
    const s = (raw ?? {}) as Body;
    const userId = str(s.userId) ?? str(s.user_id);
    if (!isUuid(userId)) throw new HttpError(400, 'Each split must name a valid user');
    if (seen.has(userId)) throw new HttpError(400, 'A person can only appear once in the split');
    seen.add(userId);
    const splitAmount = roundCents(num(s.amount));
    if (!Number.isFinite(splitAmount) || splitAmount < 0) throw new HttpError(400, 'Split amounts must be zero or more');
    return { userId, amount: splitAmount };
  });

  const total = roundCents(splits.reduce((sum, s) => sum + s.amount, 0));
  if (Math.abs(total - amount) > 0.005) {
    throw new HttpError(400, `Split amounts (${total.toFixed(2)}) must add up to the total (${amount.toFixed(2)})`);
  }

  return { householdId, title, amount, date, paidBy, splits };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/** Date-only values become noon UTC so the calendar day is the same in every US/EU timezone. */
function parseDueDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const s = str(value);
  if (!s) throw new HttpError(400, 'dueDate must be a date string');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'dueDate is not a valid date');
    return d.toISOString();
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'dueDate is not a valid date');
  return d.toISOString();
}

export function parseTaskInput(body: Body, options: { partial: boolean }): TaskInput {
  const { partial } = options;
  const input: TaskInput = {};

  const householdId = str(body.householdId) ?? str(body.household_id);
  if (householdId !== undefined) {
    if (!isUuid(householdId)) throw new HttpError(400, 'householdId must be a valid id');
    input.householdId = householdId;
  } else if (!partial) {
    throw new HttpError(400, 'householdId is required');
  }

  if (body.title !== undefined || !partial) {
    input.title = text(body.title, 'Title', 200, true) as string;
  }
  if (body.description !== undefined) {
    input.description = text(body.description, 'Description', 2000, false);
  }
  if (body.status !== undefined) {
    const status = str(body.status)?.toUpperCase();
    if (!status || !TASK_STATUSES.includes(status as TaskStatus)) {
      throw new HttpError(400, `Status must be one of ${TASK_STATUSES.join(', ')}`);
    }
    input.status = status as TaskStatus;
  }
  if (body.priority !== undefined) {
    const priority = str(body.priority)?.toUpperCase();
    if (!priority || !TASK_PRIORITIES.includes(priority as TaskPriority)) {
      throw new HttpError(400, `Priority must be one of ${TASK_PRIORITIES.join(', ')}`);
    }
    input.priority = priority as TaskPriority;
  }
  if (body.assigneeId !== undefined || body.assignee_id !== undefined) {
    const assigneeId = body.assigneeId ?? body.assignee_id;
    if (assigneeId === null || assigneeId === '') {
      input.assigneeId = null;
    } else if (isUuid(assigneeId)) {
      input.assigneeId = assigneeId;
    } else {
      throw new HttpError(400, 'assigneeId must be a valid user id');
    }
  }
  const dueDate = parseDueDate(body.dueDate ?? body.due_date);
  if (dueDate !== undefined) input.dueDate = dueDate;

  if (body.recurring !== undefined) {
    if (typeof body.recurring !== 'boolean') throw new HttpError(400, 'recurring must be true or false');
    input.recurring = body.recurring;
  }
  if (body.recurrenceRule !== undefined || body.recurrence_rule !== undefined) {
    const raw = body.recurrenceRule ?? body.recurrence_rule;
    if (raw === null || raw === '') {
      input.recurrenceRule = null;
    } else {
      const rule = str(raw)?.toUpperCase();
      if (!rule || !RECURRENCE_RULES.includes(rule as RecurrenceRule)) {
        throw new HttpError(400, `Recurrence must be one of ${RECURRENCE_RULES.join(', ')}`);
      }
      input.recurrenceRule = rule as RecurrenceRule;
    }
  }
  if (input.recurring === true && input.recurrenceRule === null) {
    throw new HttpError(400, 'Choose a recurrence pattern for a recurring task');
  }
  if (input.recurring === false) {
    input.recurrenceRule = null;
  }
  return input;
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export interface InvitationInput {
  householdId: string;
  email: string;
  role: HouseholdRole;
  message: string | null;
}

export function parseInvitationInput(body: Body): InvitationInput {
  const householdId = str(body.householdId) ?? str(body.household_id);
  if (!isUuid(householdId)) throw new HttpError(400, 'householdId is required');

  const email = (text(body.email, 'Email', 254, true) as string).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address');

  const roleRaw = (str(body.role) ?? 'member').toLowerCase();
  if (roleRaw !== 'admin' && roleRaw !== 'member') throw new HttpError(400, 'Role must be admin or member');

  const message = text(body.message, 'Message', 500, false);
  return { householdId, email, role: roleRaw, message };
}

export function parseRole(value: unknown): HouseholdRole {
  const role = (str(value) ?? '').toLowerCase();
  if (role !== 'admin' && role !== 'member') throw new HttpError(400, 'Role must be admin or member');
  return role;
}

export function parseEmail(value: unknown): string {
  const email = (text(value, 'Email', 254, true) as string).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address');
  return email;
}
