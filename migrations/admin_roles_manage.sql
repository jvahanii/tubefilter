-- Run this in the Supabase SQL editor to let admins manage roles from the admin UI.

-- Allow authenticated users to issue insert/delete (RLS still gates who can actually do it).
grant insert, delete on public.user_roles to authenticated;

-- Admins can insert roles for any user.
drop policy if exists "admins insert any role" on public.user_roles;
create policy "admins insert any role" on public.user_roles
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- Admins can delete roles for any user.
drop policy if exists "admins delete any role" on public.user_roles;
create policy "admins delete any role" on public.user_roles
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
