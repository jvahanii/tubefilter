# Admin View Plan

A new `/admin` route that lists all users and their stored preferences (channels, active filters, hidden videos, discovery activity), gated by an `admin` role stored in a dedicated table.

## 1. Database (migration)

Create role infrastructure and a search-activity log:

```sql
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users read own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- Search activity log (new — currently not tracked)
create table public.search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  query text not null,
  kind text not null check (kind in ('channels','videos')),
  created_at timestamptz not null default now()
);
grant select, insert on public.search_events to authenticated;
grant all on public.search_events to service_role;
alter table public.search_events enable row level security;
create policy "users insert own search events" on public.search_events
  for insert to authenticated with check (user_id = auth.uid());
create policy "users read own search events" on public.search_events
  for select to authenticated using (user_id = auth.uid());
```

The first admin is assigned manually via SQL (`insert into user_roles (user_id, role) values ('<uuid>', 'admin')`).

## 2. Server functions (`src/lib/admin.functions.ts`)

- `requireAdmin` middleware: wraps `requireSupabaseAuth`, then calls `has_role(userId, 'admin')`; throws 403 if not admin.
- `listUsers()`: uses `supabaseAdmin` (service-role) to call `auth.admin.listUsers()` and join with `user_preferences` + `user_roles` + recent `search_events` aggregated counts. Returns: email, created_at, last_sign_in_at, role, channels[], activeChannelIds[], hiddenIds[], recent searches.
- `getUserDetail(userId)`: full preferences blob + last 50 search events.

Service-role client is imported inside the handler via `await import('@/integrations/supabase/client.server')`.

## 3. Search activity logging

In `src/routes/index.tsx`, when the discover dialog runs a search (channels or videos tab), fire-and-forget `supabase.from('search_events').insert({ user_id, query, kind })`. Debounced so we only log committed searches, not every keystroke.

## 4. Admin route (`src/routes/_authenticated/admin.tsx`)

- Protected by `_authenticated` layout; additionally calls `listUsers` server fn which enforces admin.
- Layout: left column = user list (email, signup date, last sign-in, channel count); right column = selected user's detail (full channel list with names, active filter set, hidden IDs count, recent searches list).
- Uses TanStack Query (`useSuspenseQuery` + `ensureQueryData` in loader).
- `errorComponent` shows "Admin only" on 403.

## 5. Navigation

Conditional "Admin" link in the main app header, shown only when `has_role` returns true for the current user (small `useQuery` hook on mount).

## Technical notes

- All admin reads go through service-role server fn (RLS bypass) because we need cross-user data; auth check is enforced in the middleware.
- `user_preferences.data` JSON shape already contains `{channels, activeChannelIds, hiddenIds}` — no schema change needed there.
- Channel names persist in the JSON blob, so we don't need a separate channels table to display them.
