-- RLS policies on household_members / households / messages call these helpers. After the blanket
-- PUBLIC revoke, an anonymous request against those tables raised "permission denied for function"
-- instead of returning no rows. The helpers only answer membership questions, so re-grant them.
grant execute on function public.is_household_member(uuid, uuid) to anon;
grant execute on function public.is_household_admin(uuid, uuid) to anon;
grant execute on function public.get_user_household_ids(uuid) to anon;
