// src/components/tasks/TasksClientPage.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { createTask, deleteTask, fetchTasks, updateTask } from '@/lib/services/tasks';
import type { HouseholdRole, Member, Task, TaskInput, TaskStatus } from '@/types';
import TaskForm from '@/components/tasks/TaskForm';
import TaskList from '@/components/tasks/TaskList';
import Alert from '@/components/ui/Alert';
import { FullPageSpinner } from '@/components/ui/Spinner';

interface TasksClientPageProps {
  householdId: string;
  members: Member[];
  currentUserId: string;
  viewerRole: HouseholdRole;
  openNew?: boolean;
}

type Filter = 'ALL' | 'MY_TASKS' | 'MY_CREATED' | 'PENDING' | 'COMPLETED';

const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default function TasksClientPage({ householdId, members, currentUserId, viewerRole, openNew = false }: TasksClientPageProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(openNew);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      setTasks(await fetchTasks(householdId));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load tasks'));
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      switch (filter) {
        case 'MY_TASKS':
          return task.assigneeId === currentUserId;
        case 'MY_CREATED':
          return task.creatorId === currentUserId;
        case 'PENDING':
          return task.status === 'PENDING' || task.status === 'IN_PROGRESS';
        case 'COMPLETED':
          return task.status === 'COMPLETED';
        default:
          return true;
      }
    });
    return [...filtered].sort((a, b) => {
      const doneDiff = Number(a.status === 'COMPLETED') - Number(b.status === 'COMPLETED');
      if (doneDiff !== 0) return doneDiff;
      const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (priorityDiff !== 0) return priorityDiff;
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks, filter, currentUserId]);

  const canManage = (task: Task) => viewerRole === 'admin' || task.creatorId === currentUserId || task.assigneeId === currentUserId;
  const canDelete = (task: Task) => viewerRole === 'admin' || task.creatorId === currentUserId;

  const handleSubmit = async (input: TaskInput & { title: string }) => {
    if (editing) {
      const updated = await updateTask(editing.id, input);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } else {
      const created = await createTask({ ...input, householdId });
      setTasks((prev) => [created, ...prev]);
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    setBusyId(taskId);
    setError('');
    try {
      const updated = await updateTask(taskId, { status });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(errorMessage(err, 'Failed to update task'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (task: Task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setBusyId(task.id);
    setError('');
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete task'));
    } finally {
      setBusyId(null);
    }
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'MY_TASKS', label: 'Assigned to me' },
    { key: 'MY_CREATED', label: 'Created by me' },
    { key: 'PENDING', label: 'Open' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  return (
    <div className="container mx-auto py-2">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Household tasks</h1>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          + New task
        </button>
      </div>

      {error && (
        <Alert kind="error" className="mb-6" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      <div className="mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="-mb-px flex space-x-6">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`${
                filter === key ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <FullPageSpinner />
      ) : (
        <TaskList tasks={visibleTasks} currentUserId={currentUserId} busyId={busyId} canManage={canManage} canDelete={canDelete} onStatusChange={handleStatusChange} onEditTask={(task) => {
          setEditing(task);
          setShowForm(true);
        }} onDeleteTask={handleDelete} />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6 shadow-xl">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{editing ? 'Edit task' : 'New task'}</h3>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  aria-label="Close"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <TaskForm
                task={editing}
                members={members}
                currentUserId={currentUserId}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
