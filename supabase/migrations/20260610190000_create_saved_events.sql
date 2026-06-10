create table public.saved_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

alter table public.saved_events enable row level security;

revoke all on table public.saved_events from anon;
grant select, insert, delete on table public.saved_events to authenticated;

create policy "Users can view their saved events"
on public.saved_events
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can save events for themselves"
on public.saved_events
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can unsave their own events"
on public.saved_events
for delete
to authenticated
using ((select auth.uid()) = user_id);
