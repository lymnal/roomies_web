// src/app/api/tasks/route.ts
import { NextResponse } from 'next/server';
import {
  withAuth,
  errorResponse,
  dbErrorResponse,
  readJson,
  requireMembership,
  getMembership,
  isUuid,
  HttpError,
} from '@/lib/supabase-server';
import { TASK_SELECT, toTask, type TaskRow } from '@/lib/serializers';
import { fetchTask } from '@/lib/queries';
import { parseTaskInput } from '@/lib/validation';
import type { TaskInput } from '@/types';

function taskIdFrom(params: URLSearchParams): string | null {
  return params.get('id') ?? params.get('taskId');
}

function toRow(input: TaskInput) {
  const row: Record<string, unknown> = {};
  if (input.title !== undefined) row.title = input.title;
  if (input.description !== undefined) row.description = input.description;
  if (input.status !== undefined) row.status = input.status;
  if (input.priority !== undefined) row.priority = input.priority;
  if (input.assigneeId !== undefined) row.assignee_id = input.assigneeId;
  if (input.dueDate !== undefined) row.due_date = input.dueDate;
  if (input.recurring !== undefined) row.recurring = input.recurring;
  if (input.recurrenceRule !== undefined) row.recurrence_rule = input.recurrenceRule;
  return row;
}

// GET /api/tasks?householdId=...   or   GET /api/tasks?id=...
export const GET = withAuth(async (request, { user, supabase }) => {
  const params = request.nextUrl.searchParams;
  const taskId = taskIdFrom(params);
  const householdId = params.get('householdId') ?? params.get('household_id');

  if (taskId) {
    if (!isUuid(taskId)) return errorResponse('id must be a valid task id', 400);
    const task = await fetchTask(supabase, taskId);
    if (!task) return errorResponse('Task not found', 404);
    return NextResponse.json(task);
  }

  if (!isUuid(householdId)) return errorResponse('householdId is required', 400);
  await requireMembership(supabase, householdId, user.id);

  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('household_id', householdId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) return dbErrorResponse(error, 'Failed to fetch tasks');
  return NextResponse.json(((data ?? []) as unknown as TaskRow[]).map(toTask));
});

// POST /api/tasks
export const POST = withAuth(async (request, { user, supabase }) => {
  const body = await readJson(request);
  const input = parseTaskInput(body, { partial: false });
  const householdId = input.householdId as string;
  await requireMembership(supabase, householdId, user.id);

  if (input.assigneeId) {
    const assigneeMembership = await getMembership(supabase, householdId, input.assigneeId);
    if (!assigneeMembership) throw new HttpError(400, 'The assignee must be a member of this household');
  }

  const status = input.status ?? 'PENDING';
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      household_id: householdId,
      creator_id: user.id,
      title: input.title,
      description: input.description ?? null,
      status,
      priority: input.priority ?? 'MEDIUM',
      assignee_id: input.assigneeId ?? null,
      due_date: input.dueDate ?? null,
      recurring: input.recurring ?? false,
      recurrence_rule: input.recurring ? input.recurrenceRule ?? 'WEEKLY' : null,
      completed_at: status === 'COMPLETED' ? new Date().toISOString() : null,
    })
    .select(TASK_SELECT)
    .single();
  if (error) return dbErrorResponse(error, 'Failed to create task');
  return NextResponse.json(toTask(data as unknown as TaskRow), { status: 201 });
});

// PATCH /api/tasks?id=...
export const PATCH = withAuth(async (request, { user, supabase }) => {
  const taskId = taskIdFrom(request.nextUrl.searchParams);
  if (!isUuid(taskId)) return errorResponse('id query parameter is required', 400);

  const existing = await fetchTask(supabase, taskId);
  if (!existing) return errorResponse('Task not found', 404);

  const membership = await requireMembership(supabase, existing.householdId, user.id);
  const canEdit = existing.creatorId === user.id || existing.assigneeId === user.id || membership.role === 'admin';
  if (!canEdit) throw new HttpError(403, 'Only the creator, the assignee or an admin can edit this task');

  const body = await readJson(request);
  delete body.householdId;
  delete body.household_id;
  const input = parseTaskInput(body, { partial: true });

  if (input.assigneeId) {
    const assigneeMembership = await getMembership(supabase, existing.householdId, input.assigneeId);
    if (!assigneeMembership) throw new HttpError(400, 'The assignee must be a member of this household');
  }

  const row = toRow(input);
  const nextStatus = input.status ?? existing.status;
  if (nextStatus === 'COMPLETED') {
    if (!existing.completedAt) row.completed_at = new Date().toISOString();
  } else {
    row.completed_at = null;
  }
  if (input.recurring === false) row.recurrence_rule = null;
  if (Object.keys(row).length === 0) throw new HttpError(400, 'Nothing to update');
  row.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from('tasks').update(row).eq('id', taskId).select(TASK_SELECT).maybeSingle();
  if (error) return dbErrorResponse(error, 'Failed to update task');
  if (!data) return errorResponse('Task not found', 404);
  return NextResponse.json(toTask(data as unknown as TaskRow));
});

// DELETE /api/tasks?id=...
export const DELETE = withAuth(async (request, { user, supabase }) => {
  const taskId = taskIdFrom(request.nextUrl.searchParams);
  if (!isUuid(taskId)) return errorResponse('id query parameter is required', 400);

  const existing = await fetchTask(supabase, taskId);
  if (!existing) return errorResponse('Task not found', 404);

  const membership = await requireMembership(supabase, existing.householdId, user.id);
  if (existing.creatorId !== user.id && membership.role !== 'admin') {
    throw new HttpError(403, 'Only the creator or an admin can delete this task');
  }

  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) return dbErrorResponse(error, 'Failed to delete task');
  return NextResponse.json({ message: 'Task deleted', id: taskId });
});
