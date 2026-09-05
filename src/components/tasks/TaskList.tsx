// src/components/tasks/TaskList.tsx
'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/utils';
import type { Task, TaskStatus } from '@/types';

export interface TaskListProps {
  tasks: Task[];
  currentUserId: string;
  busyId: string | null;
  canManage: (task: Task) => boolean;
  canDelete: (task: Task) => boolean;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

const PRIORITY_STYLES: Record<Task['priority'], string> = {
  LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  HIGH: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  URGENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const STATUS_STYLES: Record<Task['status'], string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  SKIPPED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 weeks',
  MONTHLY: 'Monthly',
};

function isOverdue(task: Task): boolean {
  return Boolean(task.dueDate) && task.status !== 'COMPLETED' && task.status !== 'SKIPPED' && new Date(task.dueDate as string).getTime() < Date.now();
}

export default function TaskList({ tasks, currentUserId, busyId, canManage, canDelete, onStatusChange, onEditTask, onDeleteTask }: TaskListProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 text-center text-gray-500 dark:text-gray-400">No tasks match this filter.</div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {tasks.map((task) => {
          const expanded = expandedTaskId === task.id;
          const done = task.status === 'COMPLETED';
          const overdue = isOverdue(task);
          const manageable = canManage(task);
          return (
            <li key={task.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={!manageable || busyId === task.id}
                    onChange={(e) => onStatusChange(task.id, e.target.checked ? 'COMPLETED' : 'PENDING')}
                    className="mt-1 h-5 w-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                    aria-label={`Mark ${task.title} as ${done ? 'not done' : 'done'}`}
                  />
                  <button type="button" onClick={() => setExpandedTaskId(expanded ? null : task.id)} className="text-left min-w-0">
                    <h3 className={`text-base font-medium ${done ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{task.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-2 items-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[task.status]}`}>{task.status.replace('_', ' ').toLowerCase()}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}>{task.priority.toLowerCase()}</span>
                      {task.recurring && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">{RECURRENCE_LABELS[task.recurrenceRule ?? ''] ?? 'Recurring'}</span>}
                      <span className={`text-xs ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                        {task.dueDate ? `${overdue ? 'Overdue · ' : 'Due '}${formatDate(task.dueDate)}` : 'No due date'}
                      </span>
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{task.assigneeId === currentUserId ? 'You' : (task.assigneeName ?? 'Unassigned')}</span>
                  <svg className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 pl-8 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
                  {task.description && <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{task.description}</p>}
                  <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Created by</dt>
                      <dd className="text-gray-800 dark:text-gray-200">{task.creatorId === currentUserId ? 'You' : (task.creatorName ?? 'Unknown')}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Created</dt>
                      <dd className="text-gray-800 dark:text-gray-200">{formatDate(task.createdAt)}</dd>
                    </div>
                    {task.completedAt && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">Completed</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{formatDate(task.completedAt, true)}</dd>
                      </div>
                    )}
                  </dl>
                  {manageable && (
                    <div className="flex flex-wrap gap-3 text-sm">
                      {task.status !== 'IN_PROGRESS' && task.status !== 'COMPLETED' && (
                        <button type="button" disabled={busyId === task.id} onClick={() => onStatusChange(task.id, 'IN_PROGRESS')} className="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
                          Start
                        </button>
                      )}
                      {task.status !== 'SKIPPED' && task.status !== 'COMPLETED' && (
                        <button type="button" disabled={busyId === task.id} onClick={() => onStatusChange(task.id, 'SKIPPED')} className="text-gray-600 dark:text-gray-300 hover:underline disabled:opacity-50">
                          Skip
                        </button>
                      )}
                      <button type="button" onClick={() => onEditTask(task)} className="text-blue-600 dark:text-blue-400 hover:underline">
                        Edit
                      </button>
                      {canDelete(task) && (
                        <button type="button" disabled={busyId === task.id} onClick={() => onDeleteTask(task)} className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
