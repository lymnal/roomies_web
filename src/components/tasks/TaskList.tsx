// src/components/tasks/TaskList.tsx
// Tasks grouped by urgency (overdue, today, upcoming, no date, completed) with a tap-to-complete check.
'use client';

import { useState } from 'react';
import {
  HiOutlineArrowPath,
  HiOutlineArrowUturnLeft,
  HiOutlineCheck,
  HiOutlineClipboardDocumentCheck,
  HiOutlineEllipsisHorizontal,
  HiOutlineForward,
  HiOutlinePencilSquare,
  HiOutlinePlay,
  HiOutlinePlus,
  HiOutlineTrash,
} from 'react-icons/hi2';
import { cn, formatDate, isBeforeToday, isToday, relativeDay } from '@/lib/utils';
import type { Task, TaskPriority, TaskStatus } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Menu, { type MenuItem } from '@/components/ui/Menu';

export type TaskFilter = 'ALL' | 'MINE' | 'OPEN' | 'DONE';

export interface TaskListProps {
  tasks: Task[];
  filter: TaskFilter;
  currentUserId: string;
  busyId: string | null;
  canManage: (task: Task) => boolean;
  canDelete: (task: Task) => boolean;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onCreate: () => void;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = { URGENT: 'danger', HIGH: 'warning', MEDIUM: 'info', LOW: 'neutral' };
const RECURRENCE_LABELS: Record<string, string> = { DAILY: 'Daily', WEEKLY: 'Weekly', BIWEEKLY: 'Every 2 weeks', MONTHLY: 'Monthly' };

const EMPTY: Record<TaskFilter, { title: string; description: string }> = {
  ALL: { title: 'No tasks yet', description: 'Add the first chore or errand and share the load.' },
  MINE: { title: 'Nothing on your plate', description: 'Tasks assigned to you show up here.' },
  OPEN: { title: 'Everything is done', description: 'No open tasks in the household. Enjoy it.' },
  DONE: { title: 'Nothing completed yet', description: 'Finished tasks land here.' },
};

type GroupKey = 'overdue' | 'today' | 'upcoming' | 'someday' | 'done';
const GROUP_ORDER: GroupKey[] = ['overdue', 'today', 'upcoming', 'someday', 'done'];
const GROUP_LABELS: Record<GroupKey, string> = { overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming', someday: 'No due date', done: 'Completed' };

function isOpen(task: Task): boolean {
  return task.status === 'PENDING' || task.status === 'IN_PROGRESS';
}

function groupOf(task: Task): GroupKey {
  if (!isOpen(task)) return 'done';
  if (!task.dueDate) return 'someday';
  if (isBeforeToday(task.dueDate)) return 'overdue';
  if (isToday(task.dueDate)) return 'today';
  return 'upcoming';
}

function compareTasks(a: Task, b: Task): number {
  if (!isOpen(a) && !isOpen(b)) {
    return new Date(b.completedAt ?? b.updatedAt).getTime() - new Date(a.completedAt ?? a.updatedAt).getTime();
  }
  if (a.dueDate && b.dueDate) {
    const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (diff !== 0) return diff;
  } else if (a.dueDate || b.dueDate) {
    return a.dueDate ? -1 : 1;
  }
  const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (priority !== 0) return priority;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export default function TaskList({ tasks, filter, currentUserId, busyId, canManage, canDelete, onStatusChange, onEditTask, onDeleteTask, onCreate }: TaskListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <EmptyState
          icon={<HiOutlineClipboardDocumentCheck className="h-6 w-6" />}
          title={EMPTY[filter].title}
          description={EMPTY[filter].description}
          action={
            filter !== 'DONE' && (
              <Button size="sm" leftIcon={<HiOutlinePlus className="h-4 w-4" />} onClick={onCreate}>
                New task
              </Button>
            )
          }
        />
      </div>
    );
  }

  const groups = GROUP_ORDER.map((key) => ({ key, tasks: tasks.filter((t) => groupOf(t) === key).sort(compareTasks) })).filter((g) => g.tasks.length > 0);

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const collapsible = group.key === 'done' && filter !== 'DONE';
        const collapsed = collapsible && !showDone;
        return (
          <section key={group.key} aria-label={GROUP_LABELS[group.key]}>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className={cn('text-xs font-semibold uppercase tracking-wider', group.key === 'overdue' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400')}>
                {GROUP_LABELS[group.key]} <span className="ml-1 font-normal text-slate-400">{group.tasks.length}</span>
              </h2>
              {collapsible && (
                <button type="button" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => setShowDone((s) => !s)}>
                  {collapsed ? 'Show' : 'Hide'}
                </button>
              )}
            </div>
            {!collapsed && (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    currentUserId={currentUserId}
                    busy={busyId === task.id}
                    expanded={expandedId === task.id}
                    onToggleExpand={() => setExpandedId(expandedId === task.id ? null : task.id)}
                    manageable={canManage(task)}
                    deletable={canDelete(task)}
                    onStatusChange={onStatusChange}
                    onEditTask={onEditTask}
                    onDeleteTask={onDeleteTask}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  currentUserId: string;
  busy: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  manageable: boolean;
  deletable: boolean;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

function TaskRow({ task, currentUserId, busy, expanded, onToggleExpand, manageable, deletable, onStatusChange, onEditTask, onDeleteTask }: TaskRowProps) {
  const done = task.status === 'COMPLETED';
  const open = isOpen(task);
  const overdue = open && isBeforeToday(task.dueDate);
  const assignee = task.assigneeId === currentUserId ? 'You' : (task.assigneeName ?? 'Unassigned');

  const menuItems: MenuItem[] = [];
  if (task.status === 'PENDING') menuItems.push({ label: 'Start', icon: <HiOutlinePlay className="h-4 w-4" />, onSelect: () => onStatusChange(task.id, 'IN_PROGRESS') });
  if (open) menuItems.push({ label: 'Skip', icon: <HiOutlineForward className="h-4 w-4" />, onSelect: () => onStatusChange(task.id, 'SKIPPED') });
  if (!open) menuItems.push({ label: 'Reopen', icon: <HiOutlineArrowUturnLeft className="h-4 w-4" />, onSelect: () => onStatusChange(task.id, 'PENDING') });
  menuItems.push({ label: 'Edit', icon: <HiOutlinePencilSquare className="h-4 w-4" />, onSelect: () => onEditTask(task) });
  if (deletable) menuItems.push({ label: 'Delete', icon: <HiOutlineTrash className="h-4 w-4" />, tone: 'danger', separator: true, onSelect: () => onDeleteTask(task) });

  return (
    <li className={cn('px-3 py-3 transition-opacity sm:px-4', busy && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={!manageable || busy}
          onClick={() => onStatusChange(task.id, done ? 'PENDING' : 'COMPLETED')}
          aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
          className={cn(
            'mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all',
            done ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 hover:border-brand-500 dark:border-slate-600 dark:hover:border-brand-400',
            !manageable && 'cursor-not-allowed opacity-50'
          )}
        >
          {done && <HiOutlineCheck className="h-3.5 w-3.5 animate-scale-in" strokeWidth={3} />}
        </button>

        <button type="button" onClick={onToggleExpand} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
          <p className={cn('text-sm font-medium', done ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-900 dark:text-white')}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              {task.assigneeId && <Avatar src={task.assigneeAvatar} name={task.assigneeName ?? '?'} size={16} />}
              {assignee}
            </span>
            {task.dueDate && (
              <span className={cn(overdue && 'font-medium text-rose-600 dark:text-rose-400')}>
                · {overdue ? 'Overdue · ' : ''}
                {relativeDay(task.dueDate)}
              </span>
            )}
            {task.status === 'IN_PROGRESS' && (
              <Badge tone="info" dot>
                In progress
              </Badge>
            )}
            {task.status === 'SKIPPED' && <Badge tone="neutral">Skipped</Badge>}
            {(task.priority === 'URGENT' || task.priority === 'HIGH') && <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority.toLowerCase()}</Badge>}
            {task.recurring && (
              <Badge tone="purple">
                <HiOutlineArrowPath className="h-3 w-3" />
                {RECURRENCE_LABELS[task.recurrenceRule ?? ''] ?? 'Recurring'}
              </Badge>
            )}
          </div>
        </button>

        {manageable && (
          <Menu
            ariaLabel={`Actions for ${task.title}`}
            items={menuItems}
            trigger={() => (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                <HiOutlineEllipsisHorizontal className="h-5 w-5" />
              </span>
            )}
          />
        )}
      </div>

      {expanded && (
        <div className="ml-9 mt-3 space-y-3 border-t border-slate-100 pt-3 text-sm animate-fade-in dark:border-slate-800">
          {task.description ? (
            <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{task.description}</p>
          ) : (
            <p className="text-slate-400 dark:text-slate-500">No details added.</p>
          )}
          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-slate-400 dark:text-slate-500">Created by</dt>
              <dd className="text-slate-700 dark:text-slate-200">{task.creatorId === currentUserId ? 'You' : (task.creatorName ?? 'Unknown')}</dd>
            </div>
            <div>
              <dt className="text-slate-400 dark:text-slate-500">Created</dt>
              <dd className="text-slate-700 dark:text-slate-200">{formatDate(task.createdAt)}</dd>
            </div>
            {task.dueDate && (
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Due</dt>
                <dd className="text-slate-700 dark:text-slate-200">{formatDate(task.dueDate)}</dd>
              </div>
            )}
            {task.completedAt && (
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Completed</dt>
                <dd className="text-slate-700 dark:text-slate-200">{formatDate(task.completedAt, true)}</dd>
              </div>
            )}
          </dl>
          {manageable && (
            <div className="flex flex-wrap gap-2">
              {task.status === 'PENDING' && (
                <Button size="xs" variant="outline" leftIcon={<HiOutlinePlay className="h-3.5 w-3.5" />} disabled={busy} onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}>
                  Start
                </Button>
              )}
              {open && (
                <Button size="xs" variant="ghost" leftIcon={<HiOutlineForward className="h-3.5 w-3.5" />} disabled={busy} onClick={() => onStatusChange(task.id, 'SKIPPED')}>
                  Skip
                </Button>
              )}
              {!open && (
                <Button size="xs" variant="ghost" leftIcon={<HiOutlineArrowUturnLeft className="h-3.5 w-3.5" />} disabled={busy} onClick={() => onStatusChange(task.id, 'PENDING')}>
                  Reopen
                </Button>
              )}
              <Button size="xs" variant="ghost" leftIcon={<HiOutlinePencilSquare className="h-3.5 w-3.5" />} onClick={() => onEditTask(task)}>
                Edit
              </Button>
              {deletable && (
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30"
                  leftIcon={<HiOutlineTrash className="h-3.5 w-3.5" />}
                  disabled={busy}
                  onClick={() => onDeleteTask(task)}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
