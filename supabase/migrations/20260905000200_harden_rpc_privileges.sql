-- Security advisor findings: 64 SECURITY DEFINER functions were executable by the anon role and many
-- household-scoped ones never verified that the caller belongs to the household.
-- (a) household-scoped functions get a membership guard (web_assert_member) after their first BEGIN;
-- (b) a few functions get bespoke guards or rewrites;
-- (c) maintenance helpers become service-role only;
-- (d) EXECUTE is revoked from PUBLIC/anon on every non-extension function in public, re-granting
--     authenticated / service_role only where they already had it, so no signed-in client loses access.

-- (a) generic membership guard
do $$
declare
  r record;
  v_def text;
  v_new text;
  v_guard text;
  v_targets constant text[] := array[
    'analyze_expense_patterns', 'assign_placeholder_chores_to_member', 'assign_placeholder_chores_to_new_member',
    'check_duplicate_embedding', 'create_expense_with_splits', 'get_expense_context', 'get_household_full_data',
    'get_household_info_context', 'get_chore_context', 'get_rag_context', 'get_rag_context_with_similarity',
    'get_rag_context_with_vectors', 'get_unified_rag_context', 'hybrid_search_embeddings',
    'process_due_recurring_expenses', 'process_recurring_expenses_robust', 'rotate_chore_assignments',
    'search_similar_conversations_text', 'search_similar_embeddings', 'search_similar_expenses_text',
    'store_conversation', 'who_usually_buys', 'get_messages_with_profiles', 'create_expense_atomic'
  ];
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and l.lanname = 'plpgsql' and p.proname = any(v_targets)
  loop
    v_def := pg_get_functiondef(r.oid);
    if v_def like '%web_assert_member(%' then
      continue;
    end if;
    v_guard := E'BEGIN\n  PERFORM public.web_assert_member(p_household_id);';
    if r.proname = 'create_expense_atomic' then
      v_guard := v_guard || E'\n  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payments) x WHERE NOT public.is_household_member(p_household_id, (x ->> ''payer_id'')::uuid))'
                         || E'\n     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_splits) x WHERE NOT public.is_household_member(p_household_id, (x ->> ''user_id'')::uuid)) THEN'
                         || E'\n    RAISE EXCEPTION ''Payer and split users must be members of this household'';'
                         || E'\n  END IF;';
    end if;
    -- regexp_replace without the g flag rewrites only the first match, i.e. the BEGIN that opens the body.
    v_new := regexp_replace(v_def, '\mBEGIN\M', v_guard);
    if v_new = v_def then
      raise exception 'Could not find BEGIN in %', r.proname;
    end if;
    execute v_new;
  end loop;
end $$;

-- (b) bespoke guards
do $$
declare
  v_def text;
  v_new text;
begin
  -- get_unread_notification_count(p_user_id): only your own count.
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_unread_notification_count';
  if v_def is not null and v_def not like '%web_assert_uid(%' then
    execute regexp_replace(v_def, '\mBEGIN\M', E'BEGIN\n  PERFORM public.web_assert_uid(p_user_id);');
  end if;

  -- reverse_ledger_entries: caller must belong to the household the entries live in.
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'reverse_ledger_entries';
  if v_def is not null and v_def not like '%Not authorized for this household%' then
    execute regexp_replace(v_def, '\mBEGIN\M', $g$BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM ledger_entries le
    WHERE le.reference_id = p_reference_id AND le.reference_table = p_reference_table
      AND public.is_household_member(le.household_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized for this household' USING ERRCODE = '42501';
  END IF;$g$);
  end if;

  -- store_embeddings_batch: every row must target a household the caller belongs to.
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'store_embeddings_batch';
  if v_def is not null and v_def not like '%Not authorized for this household%' then
    execute regexp_replace(v_def, '\mBEGIN\M', $g$BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' AND EXISTS (
    SELECT 1 FROM unnest(p_embeddings) e
    WHERE NOT public.is_household_member((e ->> 'household_id')::uuid, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized for this household' USING ERRCODE = '42501';
  END IF;$g$);
  end if;

  -- update_expense_with_adjustments deleted ledger rows, which the immutability trigger rejects,
  -- so every call failed. Post reversals instead.
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'update_expense_with_adjustments';
  if v_def is not null and v_def like '%DELETE FROM ledger_entries%' then
    v_new := regexp_replace(v_def,
      $q$DELETE FROM ledger_entries\s+WHERE reference_id = p_expense_id AND reference_table = 'expenses';$q$,
      $q$PERFORM public.web_zero_ledger_reference(p_expense_id, 'expenses', 'Expense edited', v_caller);$q$);
    if v_new = v_def then
      raise exception 'Could not patch update_expense_with_adjustments';
    end if;
    execute v_new;
  end if;
end $$;

-- remove_member_from_household had no authorization at all: any signed-in user could remove any
-- member from any household. Now: admins of that household, or a member removing themselves.
create or replace function public.remove_member_from_household(member_id_to_remove uuid, household_id_to_check uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  admin_count integer;
  v_target household_members%rowtype;
  v_caller uuid := auth.uid();
begin
  select * into v_target from household_members
  where id = member_id_to_remove and household_id = household_id_to_check;
  if not found then
    raise exception 'Member not found in this household' using errcode = 'P0002';
  end if;
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    if v_caller is null then
      raise exception 'Not authenticated' using errcode = '28000';
    end if;
    if v_target.user_id <> v_caller and not public.is_household_admin(v_caller, household_id_to_check) then
      raise exception 'Only household admins can remove other members' using errcode = '42501';
    end if;
  end if;
  select count(*) into admin_count from household_members
  where household_id = household_id_to_check and role = 'admin';
  if admin_count <= 1 and v_target.role = 'admin' then
    raise exception 'Cannot remove the last admin from the household.';
  end if;
  delete from household_members where id = member_id_to_remove;
end $$;

-- (d) revoke PUBLIC/anon on every non-extension function in public, keeping existing grants
do $$
declare
  r record;
  v_auth boolean;
  v_svc boolean;
begin
  for r in
    select p.oid, p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    v_auth := has_function_privilege('authenticated', r.oid, 'EXECUTE');
    v_svc := has_function_privilege('service_role', r.oid, 'EXECUTE');
    execute format('revoke execute on function %s from public, anon', r.sig);
    if v_auth then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
    if v_svc then
      execute format('grant execute on function %s to service_role', r.sig);
    end if;
  end loop;
end $$;

-- (c) maintenance / internal helpers: service role only
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname in (
          'create_household_notification', 'create_payment_reminders', 'create_expense_ledger_entries',
          'create_profile_for_user', 'fix_missing_profiles', 'delete_user_data', 'update_expense',
          'initialize_ledger_balances', 'get_database_schema_json', 'check_user_deletion_setup',
          'cleanup_expired_invitations', 'expire_old_invitations'
        )
        or (p.proname = 'handle_user_deletion' and p.pronargs = 1)
      )
  loop
    execute format('revoke execute on function %s from authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
