-- 1. "Users can view households by join code" let any signed-in user read every household that
--    has a join code (name, address, rules, chore settings). Join-by-code now goes through the
--    join_household_by_code() RPC, so the policy is no longer needed.
drop policy if exists "Users can view households by join code" on public.households;

-- 2. invitations: fold the admin and recipient policies into one per command so each row is
--    evaluated once, and wrap auth calls in (select ...) so they are computed once per query.
drop policy if exists "Household admins can view household invitations" on public.invitations;
drop policy if exists "Users can view invitations to their email" on public.invitations;
drop policy if exists "Household admins can update household invitations" on public.invitations;
drop policy if exists "Users can update invitations to their email" on public.invitations;

create policy "Admins and recipients can view invitations"
on public.invitations for select to authenticated
using (
  lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  or household_id in (
    select household_id from public.household_members
    where user_id = (select auth.uid()) and role = 'admin'
  )
);

create policy "Admins and recipients can update invitations"
on public.invitations for update to authenticated
using (
  lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  or household_id in (
    select household_id from public.household_members
    where user_id = (select auth.uid()) and role = 'admin'
  )
)
with check (
  lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  or household_id in (
    select household_id from public.household_members
    where user_id = (select auth.uid()) and role = 'admin'
  )
);

-- 3. Avatar storage: public-read bucket; each user may only write inside a folder named by their uid.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;

create policy "Avatar images are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own avatar"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own avatar"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 4. expense_splits carried two extra indexes identical to its UNIQUE (expense_id, user_id) constraint.
drop index if exists public.expense_splits_expense_user_key;
drop index if exists public.idx_expense_splits_expense_user;

-- 5. The one remaining function without a pinned search_path.
alter function public.get_rag_context_with_similarity(uuid, uuid, text, jsonb, text) set search_path = public;
