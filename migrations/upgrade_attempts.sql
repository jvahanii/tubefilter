-- Track when free users hit the channel limit and try to upgrade

create table if not exists public.upgrade_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  channel_name text,
  created_at timestamptz not null default now()
);

grant select, insert on public.upgrade_attempts to authenticated;
grant all on public.upgrade_attempts to service_role;

alter table public.upgrade_attempts enable row level security;

drop policy if exists "users insert own upgrade attempts" on public.upgrade_attempts;
create policy "users insert own upgrade attempts" on public.upgrade_attempts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "users read own upgrade attempts" on public.upgrade_attempts;
create policy "users read own upgrade attempts" on public.upgrade_attempts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "admins read all upgrade attempts" on public.upgrade_attempts;
create policy "admins read all upgrade attempts" on public.upgrade_attempts
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create index if not exists upgrade_attempts_user_created_idx
  on public.upgrade_attempts (user_id, created_at desc);
