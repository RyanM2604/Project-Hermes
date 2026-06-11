create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_session_id text,
  event_id text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint interactions_action_check
    check (
      action in (
        'impression',
        'open',
        'save',
        'rsvp',
        'dismiss',
        'share',
        'filter_click'
      )
    ),
  constraint interactions_actor_check
    check (
      (user_id is not null and anonymous_session_id is null)
      or (user_id is null and anonymous_session_id is not null)
    )
);

alter table public.interactions enable row level security;

revoke all on table public.interactions from anon;
grant select, insert on table public.interactions to anon, authenticated;

create policy "Anyone can log interactions"
on public.interactions
for insert
to anon, authenticated
with check (
  (
    auth.uid() is null
    and user_id is null
    and anonymous_session_id is not null
  )
  or (
    auth.uid() is not null
    and user_id = auth.uid()
    and anonymous_session_id is null
  )
);

create policy "Users can read their interactions"
on public.interactions
for select
to authenticated
using (user_id = auth.uid());

create index interactions_user_id_idx on public.interactions (user_id);
create index interactions_event_id_idx on public.interactions (event_id);
create index interactions_action_idx on public.interactions (action);
create index interactions_created_at_idx on public.interactions (created_at desc);
