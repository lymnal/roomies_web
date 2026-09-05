-- A hard delete of auth.users cascades to profiles, which expense_splits, settlements and the
-- immutable ledger reference with NO ACTION: anyone with financial history cannot be hard-deleted
-- without destroying other people's records. Account deletion is therefore a soft delete:
-- this function detaches the user from their households and anonymises the profile; the API then
-- soft-deletes the auth user (GoTrue scrubs credentials so they cannot sign in again).
drop function if exists public.delete_my_account();

create or replace function public.web_prepare_account_deletion()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_caller uuid := auth.uid();
  v_blocking text;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select string_agg(h.name, ', ') into v_blocking
  from household_members hm
  join households h on h.id = hm.household_id
  where hm.user_id = v_caller and hm.role = 'admin'
    and (select count(*) from household_members x where x.household_id = hm.household_id) > 1
    and not exists (
      select 1 from household_members y
      where y.household_id = hm.household_id and y.role = 'admin' and y.user_id <> v_caller
    );
  if v_blocking is not null then
    raise exception 'You are the only admin of %. Make someone else an admin first.', v_blocking;
  end if;

  delete from household_members where user_id = v_caller;
  delete from invitations where invited_by = v_caller and status = 'pending';
  delete from notifications where user_id = v_caller;
  update tasks set assignee_id = null, updated_at = now()
  where assignee_id = v_caller and status in ('PENDING', 'IN_PROGRESS');
  update profiles
  set name = 'Deleted user', email = null, avatar_url = null, phone = null,
      vacation_start_date = null, vacation_end_date = null, updated_at = now()
  where id = v_caller;
end $$;

revoke execute on function public.web_prepare_account_deletion() from public, anon;
grant execute on function public.web_prepare_account_deletion() to authenticated, service_role;
