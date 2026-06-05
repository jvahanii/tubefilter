-- Run this in the Supabase SQL editor.

-- 1. Roles
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

drop policy if exists "users read own roles" on public.user_roles;
create policy "users read own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "admins read all roles" on public.user_roles;
create policy "admins read all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 2. Profiles mirror of auth.users (so admins can see emails/timestamps)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  updated_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.sync_profile_from_auth()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, created_at, last_sign_in_at, updated_at)
  values (new.id, new.email, new.created_at, new.last_sign_in_at, now())
  on conflict (id) do update set
    email = excluded.email,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = now();
  return new;
end $$;

drop trigger if exists on_auth_user_change on auth.users;
create trigger on_auth_user_change
  after insert or update on auth.users
  for each row execute function public.sync_profile_from_auth();

-- Backfill existing users
insert into public.profiles (id, email, created_at, last_sign_in_at)
select id, email, created_at, last_sign_in_at from auth.users
on conflict (id) do nothing;

-- 3. Allow admins to read all user_preferences
drop policy if exists "admins read all preferences" on public.user_preferences;
create policy "admins read all preferences" on public.user_preferences
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 4. Search activity log
create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  query text not null,
  kind text not null check (kind in ('channels','videos','combined')),
  created_at timestamptz not null default now()
);
grant select, insert on public.search_events to authenticated;
grant all on public.search_events to service_role;
alter table public.search_events enable row level security;

drop policy if exists "users insert own search events" on public.search_events;
create policy "users insert own search events" on public.search_events
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "users read own search events" on public.search_events;
create policy "users read own search events" on public.search_events
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "admins read all search events" on public.search_events;
create policy "admins read all search events" on public.search_events
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create index if not exists search_events_user_created_idx
  on public.search_events (user_id, created_at desc);

-- 5. To make yourself admin, run (replace with your user id from auth.users):
-- insert into public.user_roles (user_id, role) values ('YOUR-UUID-HERE', 'admin');
