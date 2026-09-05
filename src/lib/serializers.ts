// src/lib/serializers.ts
// Map database rows (snake_case, joined profiles) to the API shapes in src/types.
import type { Balance, Expense, Household, HouseholdRole, Invitation, Member, Payment, Split, Task } from '@/types';

export interface ProfileRow {
  id: string;
  name: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

/** PostgREST returns to-one embeds as an object, but can surface them as arrays for some hints. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const MEMBER_SELECT = 'id, user_id, role, joined_at, user:profiles!user_id(id, name, email, avatar_url)';

export interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user: ProfileRow | ProfileRow[] | null;
}

export function toMember(row: MemberRow): Member {
  const profile = one(row.user);
  return {
    id: row.id,
    userId: row.user_id,
    name: profile?.name?.trim() || 'Unknown',
    email: profile?.email ?? '',
    avatar: profile?.avatar_url ?? null,
    role: row.role === 'admin' ? 'admin' : 'member',
    joinedAt: row.joined_at,
  };
}

// ---------------------------------------------------------------------------
// Households
// ---------------------------------------------------------------------------

export const HOUSEHOLD_SELECT = 'id, name, address, join_code, created_by, created_at, updated_at';

export interface HouseholdRow {
  id: string;
  name: string;
  address: string | null;
  join_code?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  members?: MemberRow[];
}

export function toHousehold(row: HouseholdRow, viewerRole: HouseholdRole | null): Household {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(viewerRole === 'admin' ? { joinCode: row.join_code ?? null } : {}),
    ...(row.members ? { members: row.members.map(toMember) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export const EXPENSE_SELECT = `
  id, household_id, description, amount, date, paid_by, created_by, version, created_at, updated_at,
  paid_by_user:profiles!paid_by(id, name, email, avatar_url),
  splits:expense_splits(id, user_id, amount, settled, settled_at, user:profiles!user_id(id, name, email, avatar_url))
`;

export interface SplitRow {
  id: string;
  user_id: string;
  amount: number | string;
  settled: boolean | null;
  settled_at: string | null;
  user: ProfileRow | ProfileRow[] | null;
}

export interface ExpenseRow {
  id: string;
  household_id: string;
  description: string;
  amount: number | string;
  date: string;
  paid_by: string;
  created_by: string | null;
  version: number | null;
  created_at: string;
  updated_at: string | null;
  paid_by_user: ProfileRow | ProfileRow[] | null;
  splits: SplitRow[] | null;
}

export function toExpense(row: ExpenseRow): Expense {
  const payer = one(row.paid_by_user);
  const splits: Split[] = (row.splits ?? []).map((s) => {
    const profile = one(s.user);
    return {
      id: s.id,
      userId: s.user_id,
      userName: profile?.name?.trim() || 'Unknown',
      avatar: profile?.avatar_url ?? null,
      amount: Number(s.amount),
      settled: Boolean(s.settled),
      settledAt: s.settled_at,
    };
  });
  const payments: Payment[] = splits
    .filter((s) => s.userId !== row.paid_by)
    .map((s) => ({
      id: s.id,
      expenseId: row.id,
      userId: s.userId,
      userName: s.userName,
      amount: s.amount,
      status: s.settled ? 'COMPLETED' : 'PENDING',
      date: s.settledAt,
    }));
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.description,
    amount: Number(row.amount),
    date: row.date,
    paidBy: row.paid_by,
    paidByName: payer?.name?.trim() || 'Unknown',
    paidByAvatar: payer?.avatar_url ?? null,
    createdBy: row.created_by,
    version: row.version ?? 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    splits,
    payments,
  };
}

// ---------------------------------------------------------------------------
// Balances (get_household_balances_simple)
// ---------------------------------------------------------------------------

export interface BalanceRow {
  user_id: string;
  balance: number | string;
  profile: { id?: string; name?: string | null; avatar_url?: string | null } | null;
}

export function toBalance(row: BalanceRow): Balance {
  const net = Math.round(Number(row.balance) * 100) / 100;
  return {
    userId: row.user_id,
    userName: row.profile?.name?.trim() || 'Unknown',
    avatar: row.profile?.avatar_url ?? null,
    net,
    owes: net < 0 ? -net : 0,
    isOwed: net > 0 ? net : 0,
  };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const TASK_SELECT = `
  id, household_id, title, description, status, priority, creator_id, assignee_id, due_date, recurring,
  recurrence_rule, completed_at, created_at, updated_at,
  creator:profiles!tasks_creator_id_fkey(id, name, avatar_url),
  assignee:profiles!tasks_assignee_id_fkey(id, name, avatar_url)
`;

export interface TaskRow {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  status: Task['status'];
  priority: Task['priority'];
  creator_id: string;
  assignee_id: string | null;
  due_date: string | null;
  recurring: boolean;
  recurrence_rule: Task['recurrenceRule'];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  creator: ProfileRow | ProfileRow[] | null;
  assignee: ProfileRow | ProfileRow[] | null;
}

export function toTask(row: TaskRow): Task {
  const creator = one(row.creator);
  const assignee = one(row.assignee);
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    creatorId: row.creator_id,
    creatorName: creator?.name ?? null,
    assigneeId: row.assignee_id,
    assigneeName: assignee?.name ?? null,
    assigneeAvatar: assignee?.avatar_url ?? null,
    dueDate: row.due_date,
    recurring: Boolean(row.recurring),
    recurrenceRule: row.recurrence_rule,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export const INVITATION_SELECT = `
  id, email, household_id, invited_by, role, status, message, expires_at, created_at, accepted_at, token,
  household:households!household_id(id, name, address),
  inviter:profiles!invitations_invited_by_profiles_fkey(id, name, email, avatar_url)
`;

type InvitationHouseholdRow = { id: string; name: string; address: string | null };

export interface InvitationRow {
  id: string;
  email: string;
  household_id: string;
  invited_by: string;
  role: string | null;
  status: string | null;
  message: string | null;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  token?: string | null;
  household: InvitationHouseholdRow | InvitationHouseholdRow[] | null;
  inviter: ProfileRow | ProfileRow[] | null;
}

export function toInvitation(row: InvitationRow, options: { includeToken?: boolean } = {}): Invitation {
  const household = one(row.household);
  const inviter = one(row.inviter);
  return {
    id: row.id,
    email: row.email,
    householdId: row.household_id,
    role: row.role === 'admin' ? 'admin' : 'member',
    status: (row.status ?? 'pending') as Invitation['status'],
    message: row.message,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    ...(options.includeToken && row.token ? { token: row.token } : {}),
    household: household ? { id: household.id, name: household.name, address: household.address ?? null } : null,
    inviter: inviter
      ? {
          id: inviter.id,
          name: inviter.name?.trim() || 'Unknown',
          email: inviter.email ?? null,
          avatar: inviter.avatar_url ?? null,
        }
      : null,
  };
}
