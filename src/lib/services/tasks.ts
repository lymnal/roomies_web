// src/lib/services/tasks.ts — client-side calls for tasks
import { apiFetch } from '@/lib/api-client';
import type { Task, TaskInput } from '@/types';

export function fetchTasks(householdId: string): Promise<Task[]> {
  return apiFetch<Task[]>(`/api/tasks?householdId=${encodeURIComponent(householdId)}`);
}

export function createTask(input: TaskInput & { householdId: string; title: string }): Promise<Task> {
  return apiFetch<Task>('/api/tasks', { method: 'POST', json: input });
}

export function updateTask(taskId: string, input: TaskInput): Promise<Task> {
  return apiFetch<Task>(`/api/tasks?id=${encodeURIComponent(taskId)}`, { method: 'PATCH', json: input });
}

export function deleteTask(taskId: string): Promise<{ message: string }> {
  return apiFetch(`/api/tasks?id=${encodeURIComponent(taskId)}`, { method: 'DELETE' });
}
