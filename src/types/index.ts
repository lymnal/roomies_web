// src/types/index.ts
// Shapes returned by our /api routes (camelCase). Database rows are mapped in src/lib/serializers.ts.

export type HouseholdRole = 'admin' | 'member';

export interface Member {
  /** household_members.id */
  id: string;
  /** profiles.id / auth user id */
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: HouseholdRole;
  joinedAt: string;
}

export interface Household {
  id: string;
  name: string;
  address: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  /** Only present for admins. */
  joinCode?: string | null;
  members?: Member[];
}

export interface HouseholdSummary extends Household {
  role: HouseholdRole;
  joinedAt: string;
  memberCount: number;
  expenseCount: number;
  taskCount: number;
  messageCount: number;
}

export interface Split {
  id: string;
  userId: string;
  userName: string;
  avatar: string | null;
  amount: number;
  settled: boolean;
  settledAt: string | null;
}

export interface Payment {
  id: string;
  expenseId: string;
  userId: string;
  userName: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED';
  date?: string | null;
}

export interface Expense {
  id: string;
  householdId: string;
  title: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  paidBy: string;
  paidByName: string;
  paidByAvatar: string | null;
  createdBy: string | null;
  version: number;
  createdAt: string;
  updatedAt: string | null;
  splits: Split[];
  /** Derived from splits: everyone who owes the payer. */
  payments: Payment[];
}

export interface SplitInput {
  userId: string;
  amount: number;
}

export interface ExpenseInput {
  householdId: string;
  title: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  paidBy?: string;
  splits: SplitInput[];
}

export interface Balance {
  userId: string;
  userName: string;
  avatar: string | null;
  /** Positive: others owe this person. Negative: this person owes. */
  net: number;
  owes: number;
  isOwed: number;
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type RecurrenceRule = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface Task {
  id: string;
  householdId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  creatorId: string;
  creatorName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  /** ISO timestamp */
  dueDate: string | null;
  recurring: boolean;
  recurrenceRule: RecurrenceRule | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  householdId?: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  recurring?: boolean;
  recurrenceRule?: RecurrenceRule | null;
}

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'declined' | 'expired';

export interface Invitation {
  id: string;
  email: string;
  householdId: string;
  role: HouseholdRole;
  status: InvitationStatus;
  message: string | null;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  /** Only returned to household admins. */
  token?: string;
  household: { id: string; name: string; address: string | null } | null;
  inviter: { id: string; name: string; email: string | null; avatar: string | null } | null;
}

export interface ChatMessage {
  id: string;
  householdId: string;
  userId: string;
  content: string;
  createdAt: string;
  edited: boolean;
  sender: { id: string; name: string; avatar: string | null } | null;
}

export interface RecentExpense {
  id: string;
  title: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  paidBy: string;
  paidByName: string;
  paidByAvatar: string | null;
  splitCount: number;
  /** The viewer's share, or null when they are not part of the split. */
  myShare: number | null;
  mySettled: boolean | null;
}

export interface DashboardSummary {
  household: Household;
  role: HouseholdRole;
  memberCount: number;
  myBalance: number;
  myPendingShares: { count: number; total: number };
  myOpenTaskCount: number;
  upcomingTasks: Pick<Task, 'id' | 'title' | 'dueDate' | 'priority' | 'status' | 'assigneeName'>[];
  messagesToday: number;
  /** Ledger balances for every member (drives the settle-up chips). */
  balances: Balance[];
  /** Household spend since the first of the month. */
  monthSpend: number;
  recentExpenses: RecentExpense[];
}
