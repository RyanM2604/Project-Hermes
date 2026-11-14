-- Public invalidation only; individual RSVP rows stay private.
begin;
set local lock_timeout = '5s';
create table public.event_map_revision (
  id boolean primary key default true check (id),
  revision bigint not null default 0
);
insert into public.event_map_revision (id) values (true);
alter table public.event_map_revision enable row level security;
revoke all on public.event_map_revision from anon, authenticated;
grant select on public.event_map_revision to anon, authenticated;
create policy "Public map revision is readable"
  on public.event_map_revision for select to anon, authenticated using (true);

create function public.bump_event_map_revision()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- ponytail: singleton serializes notifications; switch to per-event signals
  -- if measured RSVP write contention warrants it.
  update public.event_map_revision set revision = revision + 1 where id;
  return null;
end;
$$;
revoke all on function public.bump_event_map_revision() from public;
create trigger event_rsvp_map_revision
after insert or update or delete on public.event_rsvps
for each statement execute function public.bump_event_map_revision();
alter publication supabase_realtime add table public.event_map_revision;
commit;
