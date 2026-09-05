// src/components/tasks/TasksClientPage.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HiOutlinePlus } from 'react-icons/hi2';
import { errorMessage } from '@/lib/api-client';
import { createTask, deleteTask, fetchTasks, updateTask } from '@/lib/services/tasks';
import type { HouseholdRole, Member, Task, TaskInput, TaskStatus } from '@/types';
import TaskForm from '@/components/tasks/TaskForm';
import TaskList, { type TaskFilter } from '@/components/tasks/TaskList';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Confirm';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import Segmented from '@/components/ui/Segmented';
import { SkeletonList } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface TasksClientPageProps {
  householdId: string;
  householdName: string;
  members: Member[];
  currentUserId: string;
  viewerRole: HouseholdRole;
  openNew?: boolean;
}

const OPEN_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS'];

export default function TasksClientPage({ householdId, householdName, members, currentUserId, viewerRole, openNew = false }: TasksClientPageProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(openNew);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filter, setFilter] = useState<TaskFilter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);

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

  const counts = useMemo(
    () => ({
      ALL: tasks.length,
      MINE: tasks.filter((t) => t.assigneeId === currentUserId && OPEN_STATUSES.includes(t.status)).length,
      OPEN: tasks.filter((t) => OPEN_STATUSES.includes(t.status)).length,
      DONE: tasks.filter((t) => t.status === 'COMPLETED').length,
    }),
    [tasks, currentUserId]
  );

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        switch (filter) {
          case 'MINE':
            return task.assigneeId === currentUserId && OPEN_STATUSES.includes(task.status);
          case 'OPEN':
            return OPEN_STATUSES.includes(task.status);
          case 'DONE':
            return task.status === 'COMPLETED';
          default:
            return true;
        }
      }),
    [tasks, filter, currentUserId]
  );

  const canManage = (task: Task) => viewerRole === 'admin' || task.creatorId === currentUserId || task.assigneeId === currentUserId;
  const canDelete = (task: Task) => viewerRole === 'admin' || task.creatorId === currentUserId;

  const openForm = (task: Task | null) => {
    setEditing(task);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    setQuickAdding(true);
    try {
      const created = await createTask({
        householdId,
        title,
        description: null,
        assigneeId: currentUserId,
        priority: 'MEDIUM',
        status: 'PENDING',
        dueDate: null,
        recurring: false,
        recurrenceRule: null,
      });
      setTasks((prev) => [created, ...prev]);
      setQuickTitle('');
      toast.success('Task added', 'Assigned to you. Open it to change the details.');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to add task'));
    } finally {
      setQuickAdding(false);
    }
  };

  const handleSubmit = async (input: TaskInput & { title: string }) => {
    if (editing) {
      const updated = await updateTask(editing.id, input);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast.success('Task updated');
    } else {
      const created = await createTask({ ...input, householdId });
      setTasks((prev) => [created, ...prev]);
      toast.success('Task created', created.assigneeName ? `Assigned to ${created.assigneeId === currentUserId ? 'you' : created.assigneeName}` : 'Unassigned for now');
    }
    closeForm();
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    setBusyId(taskId);
    try {
      const updated = await updateTask(taskId, { status });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (status === 'COMPLETED') toast.success('Done. Nice work.');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update task'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (task: Task) => {
    const ok = await confirm({ title: `Delete "${task.title}"?`, description: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    setBusyId(task.id);
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast.success('Task deleted');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete task'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        eyebrow={householdName}
        title="Tasks"
        description="Chores and to-dos for the whole house."
        actions={
          <Button leftIcon={<HiOutlinePlus className="h-4 w-4" />} onClick={() => openForm(null)}>
            New task
          </Button>
        }
      />

      {error && (
        <Alert kind="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      <form
        onSubmit={handleQuickAdd}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-card transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30 dark:border-slate-800 dark:bg-slate-900"
      >
        <HiOutlinePlus className="h-5 w-5 flex-shrink-0 text-slate-400" />
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a task and press Enter…"
          aria-label="Quick add a task"
          maxLength={200}
          disabled={quickAdding}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
        />
        <Button type="submit" size="sm" variant="secondary" isLoading={quickAdding} disabled={!quickTitle.trim()}>
          Add
        </Button>
      </form>

      <Segmented
        ariaLabel="Filter tasks"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'ALL', label: 'All', count: counts.ALL },
          { value: 'MINE', label: 'Mine', count: counts.MINE },
          { value: 'OPEN', label: 'Open', count: counts.OPEN },
          { value: 'DONE', label: 'Done', count: counts.DONE },
        ]}
      />

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <SkeletonList rows={4} />
        </div>
      ) : (
        <TaskList
          tasks={visibleTasks}
          filter={filter}
          currentUserId={currentUserId}
          busyId={busyId}
          canManage={canManage}
          canDelete={canDelete}
          onStatusChange={(taskId, status) => void handleStatusChange(taskId, status)}
          onEditTask={(task) => openForm(task)}
          onDeleteTask={(task) => void handleDelete(task)}
          onCreate={() => openForm(null)}
        />
      )}

      <Modal open={showForm} onClose={closeForm} title={editing ? 'Edit task' : 'New task'} description={editing ? undefined : 'Give it an owner and a due date so it actually happens.'}>
        {showForm && <TaskForm key={editing?.id ?? 'new'} task={editing} members={members} currentUserId={currentUserId} onSubmit={handleSubmit} onCancel={closeForm} />}
      </Modal>
    </div>
  );
}
