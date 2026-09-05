// src/components/tasks/TaskForm.tsx
'use client';

import { useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { toDateInputValue } from '@/lib/utils';
import type { Member, RecurrenceRule, Task, TaskInput, TaskPriority, TaskStatus } from '@/types';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { Checkbox, FormField, Input, Select, Textarea } from '@/components/ui/Field';
import Segmented from '@/components/ui/Segmented';

interface TaskFormProps {
  task: Task | null;
  members: Member[];
  currentUserId: string;
  onSubmit: (input: TaskInput & { title: string }) => Promise<void>;
  onCancel: () => void;
}

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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && <Alert kind="error">{error}</Alert>}

      <FormField label="Title" htmlFor="task-title">
        <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Clean the kitchen, take out the trash…" required maxLength={200} autoFocus autoComplete="off" />
      </FormField>

      <FormField label="Details" htmlFor="task-description" optional>
        <Textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} placeholder="Anything the person doing it should know." />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Assign to" htmlFor="task-assignee">
          <Select id="task-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.userId === currentUserId ? `You (${member.name})` : member.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Due date" htmlFor="task-due" optional>
          <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </FormField>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">Priority</p>
        <Segmented
          ariaLabel="Priority"
          value={priority}
          onChange={setPriority}
          options={[
            { value: 'LOW', label: 'Low' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'HIGH', label: 'High' },
            { value: 'URGENT', label: 'Urgent' },
          ]}
        />
      </div>

      {task && (
        <FormField label="Status" htmlFor="task-status">
          <Select id="task-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="SKIPPED">Skipped</option>
          </Select>
        </FormField>
      )}

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <Checkbox id="task-recurring" label="Repeats on a schedule" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
        {recurring && (
          <div className="mt-3">
            <FormField label="Repeats" htmlFor="task-recurrence">
              <Select id="task-recurrence" value={recurrenceRule} onChange={(e) => setRecurrenceRule(e.target.value as RecurrenceRule)}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Every 2 weeks</option>
                <option value="MONTHLY">Monthly</option>
              </Select>
            </FormField>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {task ? 'Save changes' : 'Create task'}
        </Button>
      </div>
    </form>
  );
}
