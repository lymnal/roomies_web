-- Invitation links must work for people who are not signed in yet. The token *is* the secret for
-- these functions (122 random bits), so they may run as anon.
-- (The delete_my_account() function this migration also created is replaced by the next one:
--  a hard delete of auth.users is blocked by the financial tables' NO ACTION foreign keys.)

create or replace function public.get_invitation_by_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_inv invitations%rowtype;
  v_household households%rowtype;
  v_inviter profiles%rowtype;
  v_status text;
begin
  select * into v_inv from invitations where token = p_token;
  if not found then
    return null;
  end if;
  v_status := coalesce(v_inv.status, 'pending');
  if v_status = 'pending' and v_inv.expires_at < now() then
    update invitations set status = 'expired', updated_at = now() where id = v_inv.id;
    v_status := 'expired';
  end if;
  select * into v_household from households where id = v_inv.household_id;
  select * into v_inviter from profiles where id = v_inv.invited_by;
  return jsonb_build_object(
    'id', v_inv.id,
    'email', v_inv.email,
    'household_id', v_inv.household_id,
    'role', case when v_inv.role = 'admin' then 'admin' else 'member' end,
    'status', v_status,
    'message', v_inv.message,
    'expires_at', v_inv.expires_at,
    'created_at', v_inv.created_at,
    'accepted_at', v_inv.accepted_at,
    'household', case when v_household.id is null then null
                 else jsonb_build_object('id', v_household.id, 'name', v_household.name, 'address', v_household.address) end,
    'inviter', case when v_inviter.id is null then null
               else jsonb_build_object('id', v_inviter.id, 'name', v_inviter.name, 'email', v_inviter.email, 'avatar_url', v_inviter.avatar_url) end
  );
end $$;

-- p_action: 'accept' (needs a session) or 'decline' (anyone holding the link).
-- SQLSTATE P0003 = "no longer actionable" (expired / already answered) so the API can answer 410.
create or replace function public.respond_to_invitation_by_token(p_token uuid, p_action text, p_claim boolean default false)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_inv invitations%rowtype;
  v_caller uuid := auth.uid();
  v_email text;
  v_existing boolean;
  v_status text;
  v_name text;
  v_household_name text;
begin
  if p_action not in ('accept', 'decline') then
    raise exception 'action must be accept or decline';
  end if;
  select * into v_inv from invitations where token = p_token for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  v_status := coalesce(v_inv.status, 'pending');
  if v_status = 'pending' and v_inv.expires_at < now() then
    update invitations set status = 'expired', updated_at = now() where id = v_inv.id;
    raise exception 'This invitation has expired' using errcode = 'P0003';
  end if;
  if v_status <> 'pending' then
    raise exception 'This invitation has already been %', case when v_status = 'rejected' then 'declined' else v_status end
      using errcode = 'P0003';
  end if;

  if p_action = 'decline' then
    update invitations set status = 'rejected', updated_at = now() where id = v_inv.id;
    return jsonb_build_object('status', 'rejected');
  end if;

  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select lower(email) into v_email from auth.users where id = v_caller;
  if v_email is distinct from lower(v_inv.email) and not coalesce(p_claim, false) then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  select name into v_household_name from households where id = v_inv.household_id;
  select exists (select 1 from household_members where household_id = v_inv.household_id and user_id = v_caller) into v_existing;
  if not v_existing then
    insert into household_members (household_id, user_id, role)
    values (v_inv.household_id, v_caller, case when v_inv.role = 'admin' then 'admin' else 'member' end);
    select name into v_name from profiles where id = v_caller;
    insert into notifications (user_id, household_id, type, title, message, data)
    select hm.user_id, v_inv.household_id, 'member_joined', 'New member joined',
           coalesce(v_name, 'Someone') || ' joined ' || coalesce(v_household_name, 'the household'),
           jsonb_build_object('new_member_id', v_caller, 'household_id', v_inv.household_id)
    from household_members hm
    where hm.household_id = v_inv.household_id and hm.user_id <> v_caller;
  end if;

  update invitations
  set status = 'accepted', accepted_at = now(), updated_at = now(),
      notes = case when v_email is distinct from lower(v_inv.email)
                   then format('Claimed by %s (original recipient: %s)', v_email, v_inv.email)
                   else notes end
  where id = v_inv.id;

  return jsonb_build_object('status', 'accepted', 'household_id', v_inv.household_id,
                            'household_name', v_household_name, 'already_member', v_existing);
end $$;

revoke execute on function public.get_invitation_by_token(uuid) from public;
revoke execute on function public.respond_to_invitation_by_token(uuid, text, boolean) from public;
grant execute on function public.get_invitation_by_token(uuid) to anon, authenticated, service_role;
grant execute on function public.respond_to_invitation_by_token(uuid, text, boolean) to anon, authenticated, service_role;
