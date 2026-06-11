create table public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id),
  constraint event_rsvps_status_check
    check (status in ('going', 'interested', 'cancelled'))
);

alter table public.event_rsvps enable row level security;

revoke all on table public.event_rsvps from anon;
grant select, insert, update on table public.event_rsvps to authenticated;

create policy "Users can view their RSVPs"
on public.event_rsvps
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create RSVPs for themselves"
on public.event_rsvps
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their RSVPs"
on public.event_rsvps
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
