// src/components/tasks/TaskForm.tsx
'use client';

import { useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { toDateInputValue } from '@/lib/utils';
import type { Member, RecurrenceRule, Task, TaskInput, TaskPriority, TaskStatus } from '@/types';
import Alert from '@/components/ui/Alert';

interface TaskFormProps {
  task: Task | null;
  members: Member[];
  currentUserId: string;
  onSubmit: (input: TaskInput & { title: string }) => Promise<void>;
  onCancel: () => void;
}

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white';

export default function TaskForm({ task, members, currentUserId, onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? currentUserId);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'MEDIUM');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'PENDING');
  const [dueDate, setDueDate] = useState(toDateInputValue(task?.dueDate));
  const [recurring, setRecurring] = useState(task?.recurring ?? false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(task?.recurrenceRule ?? 'WEEKLY');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give the task a title');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        assigneeId: assigneeId || null,
        priority,
        status,
        dueDate: dueDate || null,
        recurring,
        recurrenceRule: recurring ? recurrenceRule : null,
      });
    } catch (err) {
      setError(errorMessage(err, 'Failed to save task'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {error && <Alert kind="error">{error}</Alert>}

      <div>
        <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title
        </label>
        <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Clean the kitchen, Take out the trash" required maxLength={200} className={inputClass} />
      </div>

      <div>
        <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Details <span className="text-gray-400">(optional)</span>
        </label>
        <textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className={inputClass} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="task-assignee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Assign to
          </label>
          <select id="task-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputClass}>
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.userId === currentUserId ? `You (${member.name})` : member.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="task-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Priority
          </label>
          <select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={inputClass}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="task-due" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Due date
          </label>
          <input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="task-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select id="task-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={inputClass}>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="SKIPPED">Skipped</option>
          </select>
        </div>
      </div>

      <div className="flex items-center">
        <input id="task-recurring" type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
        <label htmlFor="task-recurring" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
          Recurring task
        </label>
      </div>

      {recurring && (
        <div>
          <label htmlFor="task-recurrence" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Repeats
          </label>
          <select id="task-recurrence" value={recurrenceRule} onChange={(e) => setRecurrenceRule(e.target.value as RecurrenceRule)} className={inputClass}>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Every 2 weeks</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-70">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed">
          {isSubmitting ? 'Saving…' : task ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </form>
  );
}
