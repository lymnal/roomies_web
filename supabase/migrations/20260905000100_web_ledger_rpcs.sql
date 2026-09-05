-- Server-side RPCs used by the Roomies web client (roomies_web).
-- Every function is SECURITY DEFINER with an explicit authorization check, because the ledger
-- tables only carry SELECT policies. Ledger rows are immutable (enforce_ledger_immutability),
-- so corrections are posted as offsetting 'reversal' entries instead of deletes.

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
create or replace function public.web_assert_member(p_household_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return;
  end if;
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not public.is_household_member(p_household_id, auth.uid()) then
    raise exception 'Not authorized for this household' using errcode = '42501';
  end if;
end $$;

create or replace function public.web_assert_uid(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return;
  end if;
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_user_id is distinct from auth.uid() then
    raise exception 'Not authorized for this user' using errcode = '42501';
  end if;
end $$;

-- Post offsetting entries so the net ledger effect of a reference (expense / settlement) is zero.
create or replace function public.web_zero_ledger_reference(p_reference_id uuid, p_reference_table text, p_reason text, p_created_by uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row record;
  v_count integer := 0;
  v_batch uuid := gen_random_uuid();
begin
  for v_row in
    select household_id, user_id,
           sum(case when entry_type = 'credit' then amount else -amount end) as net
    from ledger_entries
    where reference_id = p_reference_id and reference_table = p_reference_table
    group by household_id, user_id
    having sum(case when entry_type = 'credit' then amount else -amount end) <> 0
  loop
    insert into ledger_entries (household_id, user_id, amount, entry_type, transaction_type,
                                reference_id, reference_table, description, metadata, created_by)
    values (v_row.household_id, v_row.user_id, abs(v_row.net),
            case when v_row.net > 0 then 'debit' else 'credit' end,
            'reversal', p_reference_id, p_reference_table,
            'Reversal: ' || coalesce(p_reason, 'Transaction reversed'),
            jsonb_build_object('reversal_batch_id', v_batch, 'reversal_reason', p_reason, 'reversed_at', now()),
            p_created_by);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Households: create / join by code
-- ---------------------------------------------------------------------------
create or replace function public.web_generate_join_code()
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from households where upper(join_code) = v_code);
  end loop;
  return v_code;
end $$;

create or replace function public.web_create_household(p_name text, p_address text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_caller uuid := auth.uid();
  v_id uuid;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Household name is required';
  end if;
  insert into households (name, address, created_by, join_code)
  values (btrim(p_name), nullif(btrim(coalesce(p_address, '')), ''), v_caller, public.web_generate_join_code())
  returning id into v_id;
  insert into household_members (household_id, user_id, role) values (v_id, v_caller, 'admin');
  return v_id;
end $$;

create or replace function public.web_regenerate_join_code(p_household_id uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_caller uuid := auth.uid();
  v_code text;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not public.is_household_admin(v_caller, p_household_id) then
    raise exception 'Only household admins can change the join code' using errcode = '42501';
  end if;
  v_code := public.web_generate_join_code();
  update households set join_code = v_code, updated_at = now() where id = p_household_id;
  return v_code;
end $$;

create or replace function public.join_household_by_code(p_code text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_caller uuid := auth.uid();
  v_household households%rowtype;
  v_name text;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select * into v_household from households
  where upper(join_code) = upper(btrim(coalesce(p_code, '')))
  limit 1;
  if not found then
    raise exception 'Invalid join code' using errcode = 'P0002';
  end if;
  if exists (select 1 from household_members where household_id = v_household.id and user_id = v_caller) then
    return v_household.id;
  end if;
  insert into household_members (household_id, user_id, role) values (v_household.id, v_caller, 'member');
  select name into v_name from profiles where id = v_caller;
  insert into notifications (user_id, household_id, type, title, message, data)
  select hm.user_id, v_household.id, 'member_joined', 'New member joined',
         coalesce(v_name, 'Someone') || ' joined ' || v_household.name,
         jsonb_build_object('new_member_id', v_caller, 'household_id', v_household.id)
  from household_members hm
  where hm.household_id = v_household.id and hm.user_id <> v_caller;
  return v_household.id;
end $$;

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
create or replace function public.web_validate_splits(p_household_id uuid, p_amount numeric, p_paid_by uuid, p_splits jsonb)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_paid_by is null or not public.is_household_member(p_household_id, p_paid_by) then
    raise exception 'Payer is not a member of this household';
  end if;
  if p_splits is null or jsonb_typeof(p_splits) <> 'array' then
    raise exception 'At least one split is required';
  end if;
  v_n := jsonb_array_length(p_splits);
  if v_n < 1 then
    raise exception 'At least one split is required';
  end if;
  if exists (select 1 from jsonb_array_elements(p_splits) s where s.value ->> 'user_id' is null) then
    raise exception 'Every split must name a user';
  end if;
  if (select count(distinct (s.value ->> 'user_id')::uuid) from jsonb_array_elements(p_splits) s) <> v_n then
    raise exception 'Duplicate users in splits';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_splits) s
    where not public.is_household_member(p_household_id, (s.value ->> 'user_id')::uuid)
  ) then
    raise exception 'All split users must be members of this household';
  end if;
  if exists (select 1 from jsonb_array_elements(p_splits) s where coalesce((s.value ->> 'amount')::numeric, -1) < 0) then
    raise exception 'Split amounts cannot be negative';
  end if;
  if (select coalesce(sum(round((s.value ->> 'amount')::numeric * 100)::bigint), 0) from jsonb_array_elements(p_splits) s)
     <> round(p_amount * 100)::bigint then
    raise exception 'Split amounts must equal the total amount';
  end if;
end $$;

create or replace function public.web_create_expense(p_household_id uuid, p_description text, p_amount numeric, p_date date, p_paid_by uuid, p_splits jsonb)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_caller uuid := auth.uid();
  v_expense_id uuid;
  v_desc text := btrim(coalesce(p_description, ''));
  v_payer_name text;
begin
  perform public.web_assert_member(p_household_id);
  if v_desc = '' then
    raise exception 'Description is required';
  end if;
  perform public.web_validate_splits(p_household_id, p_amount, p_paid_by, p_splits);

  insert into expenses (household_id, description, amount, date, paid_by, created_by)
  values (p_household_id, v_desc, p_amount, coalesce(p_date, current_date), p_paid_by, v_caller)
  returning id into v_expense_id;

  insert into expense_payments (expense_id, payer_id, amount) values (v_expense_id, p_paid_by, p_amount);

  -- The payer's own share is settled by definition.
  insert into expense_splits (expense_id, user_id, amount, settled, settled_at)
  select v_expense_id, (s.value ->> 'user_id')::uuid, (s.value ->> 'amount')::numeric,
         (s.value ->> 'user_id')::uuid = p_paid_by,
         case when (s.value ->> 'user_id')::uuid = p_paid_by then now() end
  from jsonb_array_elements(p_splits) s;

  perform public.create_expense_ledger_entries(v_expense_id, p_household_id, p_amount, v_desc, p_paid_by, p_splits, v_caller, 'expense');

  -- notify_expense_created fires on the expenses insert, before the splits exist, so notify here.
  select name into v_payer_name from profiles where id = p_paid_by;
  insert into notifications (user_id, household_id, type, title, message, data)
  select (s.value ->> 'user_id')::uuid, p_household_id, 'expense_added', 'New expense added',
         format('%s paid $%s for %s. Your share: $%s',
                coalesce(v_payer_name, 'Someone'), to_char(p_amount, 'FM999999990.00'), v_desc,
                to_char((s.value ->> 'amount')::numeric, 'FM999999990.00')),
         jsonb_build_object('expense_id', v_expense_id, 'amount', (s.value ->> 'amount')::numeric,
                            'description', v_desc, 'paid_by', p_paid_by)
  from jsonb_array_elements(p_splits) s
  where (s.value ->> 'user_id')::uuid <> p_paid_by and (s.value ->> 'amount')::numeric > 0;

  return v_expense_id;
end $$;

create or replace function public.web_update_expense(p_expense_id uuid, p_description text, p_amount numeric, p_date date, p_paid_by uuid, p_splits jsonb)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_caller uuid := auth.uid();
  v_old expenses%rowtype;
  v_desc text := btrim(coalesce(p_description, ''));
  v_old_splits jsonb;
begin
  select * into v_old from expenses where id = p_expense_id for update;
  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
  perform public.web_assert_member(v_old.household_id);
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and v_caller is distinct from v_old.created_by
     and v_caller is distinct from v_old.paid_by
     and not public.is_household_admin(v_caller, v_old.household_id) then
    raise exception 'Only the payer, the creator or a household admin can edit this expense' using errcode = '42501';
  end if;
  if v_desc = '' then
    raise exception 'Description is required';
  end if;
  perform public.web_validate_splits(v_old.household_id, p_amount, p_paid_by, p_splits);

  select coalesce(jsonb_object_agg(user_id::text, jsonb_build_object('amount', amount, 'settled', settled, 'settled_at', settled_at)), '{}'::jsonb)
  into v_old_splits
  from expense_splits where expense_id = p_expense_id;

  perform public.web_zero_ledger_reference(p_expense_id, 'expenses', 'Expense edited', v_caller);

  update expenses
  set description = v_desc, amount = p_amount, date = coalesce(p_date, date), paid_by = p_paid_by,
      version = coalesce(version, 0) + 1, updated_at = now()
  where id = p_expense_id;

  delete from expense_payments where expense_id = p_expense_id;
  insert into expense_payments (expense_id, payer_id, amount) values (p_expense_id, p_paid_by, p_amount);

  -- Keep a share settled only when the same person still owes the same amount.
  delete from expense_splits where expense_id = p_expense_id;
  insert into expense_splits (expense_id, user_id, amount, settled, settled_at)
  select p_expense_id, x.u, x.amt,
         (x.u = p_paid_by) or x.kept,
         case when x.u = p_paid_by then now()
              when x.kept then (v_old_splits -> (x.u::text) ->> 'settled_at')::timestamptz
         end
  from (
    select (s.value ->> 'user_id')::uuid as u,
           (s.value ->> 'amount')::numeric as amt,
           coalesce((v_old_splits -> (s.value ->> 'user_id') ->> 'settled')::boolean, false)
             and (v_old_splits -> (s.value ->> 'user_id') ->> 'amount')::numeric = (s.value ->> 'amount')::numeric as kept
    from jsonb_array_elements(p_splits) s
  ) x;

  perform public.create_expense_ledger_entries(p_expense_id, v_old.household_id, p_amount, v_desc, p_paid_by, p_splits, v_caller, 'expense');
  return p_expense_id;
end $$;

create or replace function public.web_delete_expense(p_expense_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_caller uuid := auth.uid();
  v_old expenses%rowtype;
begin
  select * into v_old from expenses where id = p_expense_id for update;
  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
  perform public.web_assert_member(v_old.household_id);
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and v_caller is distinct from v_old.created_by
     and v_caller is distinct from v_old.paid_by
     and not public.is_household_admin(v_caller, v_old.household_id) then
    raise exception 'Only the payer, the creator or a household admin can delete this expense' using errcode = '42501';
  end if;

  perform public.web_zero_ledger_reference(p_expense_id, 'expenses', 'Expense deleted: ' || v_old.description, v_caller);

  insert into notifications (user_id, household_id, type, title, message, data)
  select es.user_id, v_old.household_id, 'expense_deleted', 'Expense removed',
         format('"%s" ($%s) was removed', v_old.description, to_char(v_old.amount, 'FM999999990.00')),
         jsonb_build_object('expense_id', p_expense_id, 'amount', v_old.amount, 'description', v_old.description)
  from expense_splits es
  where es.expense_id = p_expense_id and es.user_id is distinct from v_caller;

  -- expense_splits and expense_payments cascade.
  delete from expenses where id = p_expense_id;
end $$;

-- Mark a share as settled (records a settlement + ledger entries) or unsettled (records a refund).
create or replace function public.web_settle_split(p_split_id uuid, p_settled boolean)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_caller uuid := auth.uid();
  v_split expense_splits%rowtype;
  v_expense expenses%rowtype;
  v_settlement_id uuid;
  v_desc text;
begin
  select * into v_split from expense_splits where id = p_split_id for update;
  if not found then
    raise exception 'Share not found' using errcode = 'P0002';
  end if;
  select * into v_expense from expenses where id = v_split.expense_id;
  perform public.web_assert_member(v_expense.household_id);
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and v_caller is distinct from v_split.user_id
     and v_caller is distinct from v_expense.paid_by
     and not public.is_household_admin(v_caller, v_expense.household_id) then
    raise exception 'Only the person who owes, the payer or a household admin can settle this share' using errcode = '42501';
  end if;
  if coalesce(p_settled, false) = coalesce(v_split.settled, false) then
    return jsonb_build_object('id', v_split.id, 'settled', v_split.settled, 'settled_at', v_split.settled_at, 'changed', false);
  end if;

  if v_split.user_id <> v_expense.paid_by and v_split.amount > 0 then
    if p_settled then
      v_desc := 'Settled share of ' || v_expense.description;
      insert into settlements (household_id, payer_id, payee_id, amount, description)
      values (v_expense.household_id, v_split.user_id, v_expense.paid_by, v_split.amount, v_desc)
      returning id into v_settlement_id;
      perform public.create_settlement_ledger_entries(v_settlement_id, v_expense.household_id, v_split.user_id, v_expense.paid_by, v_split.amount, v_desc, v_caller);
    else
      v_desc := 'Reversed settlement for ' || v_expense.description;
      insert into settlements (household_id, payer_id, payee_id, amount, description)
      values (v_expense.household_id, v_expense.paid_by, v_split.user_id, v_split.amount, v_desc)
      returning id into v_settlement_id;
      perform public.create_settlement_ledger_entries(v_settlement_id, v_expense.household_id, v_expense.paid_by, v_split.user_id, v_split.amount, v_desc, v_caller);
    end if;
  end if;

  update expense_splits
  set settled = p_settled, settled_at = case when p_settled then now() end, updated_at = now()
  where id = p_split_id
  returning * into v_split;

  return jsonb_build_object('id', v_split.id, 'settled', v_split.settled, 'settled_at', v_split.settled_at,
                            'settlement_id', v_settlement_id, 'changed', true);
end $$;

-- ---------------------------------------------------------------------------
-- Repair: delete_expense_simple hard-deleted ledger rows, which the immutability trigger
-- rejects, so every call failed with {success:false}. Post reversals instead.
-- ---------------------------------------------------------------------------
create or replace function public.delete_expense_simple(p_expense_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_expense record;
begin
  select * into v_expense from expenses where id = p_expense_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Expense not found');
  end if;
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;
  if v_expense.created_by is distinct from auth.uid()
     and v_expense.paid_by is distinct from auth.uid()
     and not exists (
       select 1 from household_members
       where household_id = v_expense.household_id and user_id = auth.uid() and role = 'admin'
     ) then
    return jsonb_build_object('success', false, 'error', 'Permission denied');
  end if;

  perform public.web_zero_ledger_reference(p_expense_id, 'expenses', 'Expense deleted', auth.uid());
  delete from expense_splits where expense_id = p_expense_id;
  delete from expense_payments where expense_id = p_expense_id;
  delete from expenses where id = p_expense_id;

  return jsonb_build_object('success', true, 'expense_id', p_expense_id);
exception
  when others then
    return jsonb_build_object('success', false, 'error', SQLERRM);
end $$;

-- Only authenticated callers (and the service role) may call these.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('web_assert_member', 'web_assert_uid', 'web_zero_ledger_reference', 'web_generate_join_code',
                        'web_create_household', 'web_regenerate_join_code', 'join_household_by_code',
                        'web_validate_splits', 'web_create_expense', 'web_update_expense', 'web_delete_expense',
                        'web_settle_split', 'delete_expense_simple')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;
