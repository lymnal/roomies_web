-- Belt and braces: the auth server fires the auth.users triggers as supabase_auth_admin. Trigger
-- functions are not ACL-checked at fire time, but grant EXECUTE explicitly anyway so that the
-- PUBLIC revoke in the previous migration can never interfere with sign-up / profile sync.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant execute on function public.handle_user_update() to supabase_auth_admin;
grant execute on function public.handle_user_delete() to supabase_auth_admin;
grant execute on function public.handle_user_deletion() to supabase_auth_admin;
