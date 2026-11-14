-- Run in Supabase SQL Editor as postgres, or via psql. Not a migration.
-- Creates marked, banned, non-login Auth fixtures to satisfy RSVP foreign keys.
-- No identities, passwords, sessions, invitations, or emails are created/sent.
-- Reruns replace only this fixture's RSVPs, never real users' responses.
-- Change scenario_seed to simulate a different distribution of attendance.
begin;

do $$
declare
  -- Edit these settings, then run the whole file again.
  total_users integer := 200;
  min_going integer := 5;
  max_going integer := 80;
  scenario_seed text := 'demo-1';
  today_only boolean := false; -- false = all ongoing and upcoming events

  fixture constant text := 'hermes-rsvp-sim-v1';
  written integer;
begin
  if total_users not between 1 and 1000 or min_going < 1
    or max_going < min_going or max_going > total_users
    or scenario_seed is null or length(scenario_seed) = 0 then
    raise exception 'Require 1 <= min_going <= max_going <= total_users <= 1000 and a nonempty seed';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, banned_until,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  select
    md5(fixture || ':' || n)::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated',
    'rsvp-sim-' || n || '@hermes.invalid', '2099-12-31 23:59:59+00'::timestamptz,
    '', '', '', '',
    jsonb_build_object('hermes_fixture', fixture),
    jsonb_build_object('full_name', 'Simulated Student ' || n),
    now() - interval '30 days', now()
  from generate_series(1, total_users) as n
  on conflict (id) do nothing;

  -- Refuse to use an unrelated account if a deterministic fixture ID collides.
  if exists (
    select 1 from generate_series(1, total_users) as n
    join auth.users u on u.id = md5(fixture || ':' || n)::uuid
    where u.raw_app_meta_data->>'hermes_fixture' is distinct from fixture
      or u.email is distinct from 'rsvp-sim-' || n || '@hermes.invalid'
      or u.banned_until is distinct from '2099-12-31 23:59:59+00'::timestamptz
  ) then
    raise exception 'Fixture user collision; no changes committed';
  end if;

  delete from public.event_rsvps r using auth.users u
  where r.user_id = u.id
    and u.raw_app_meta_data->>'hermes_fixture' = fixture
    and u.email like 'rsvp-sim-%@hermes.invalid';

  -- ponytail: at most 1000 test users x eligible events; use this for development
  -- simulations, and move to a load-test runner if concurrency is the goal.
  with pool as (
    select md5(fixture || ':' || n)::uuid as user_id
    from generate_series(1, total_users) as n
  ), eligible as (
    select e.id,
      min_going + ((('x' || substr(md5(scenario_seed || ':' || e.id), 1, 8))::bit(32)::bigint)
        % (max_going - min_going + 1))::integer as going_target
    from public.events e
    where e.superseded_by_id is null and e.end_time > now()
      and (not today_only or e.start_time < (
        date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day'
      ) at time zone 'America/Toronto')
  ), ranked as (
    select e.id as event_id, p.user_id, e.going_target,
      row_number() over (
        partition by e.id order by md5(scenario_seed || ':' || e.id || ':' || p.user_id::text), p.user_id
      ) as person_rank
    from eligible e cross join pool p
  ), responses as (
    select *, case
      when person_rank <= going_target then 'going'
      when person_rank <= going_target + floor((total_users - going_target) * 0.20) then 'interested'
      when person_rank <= going_target + floor((total_users - going_target) * 0.25) then 'cancelled'
      else null
    end as status
    from ranked
  )
  insert into public.event_rsvps (user_id, event_id, status, created_at, updated_at)
  select user_id, event_id, status,
    now() - interval '7 days' * (person_rank::double precision / (total_users + 1)), now()
  from responses where status is not null;

  get diagnostics written = row_count;
  raise notice 'Scenario %: % simulated users, % RSVP rows. Real user RSVPs unchanged.', scenario_seed, total_users, written;
end;
$$;

-- Inspect the simulated distribution. These counts exclude real users.
select e.id, e.title,
  count(*) filter (where r.status = 'going') as simulated_going,
  count(*) filter (where r.status = 'interested') as simulated_interested,
  count(*) filter (where r.status = 'cancelled') as simulated_cancelled
from public.event_rsvps r
join auth.users u on u.id = r.user_id
join public.events e on e.id = r.event_id
where u.raw_app_meta_data->>'hermes_fixture' = 'hermes-rsvp-sim-v1'
  and u.email like 'rsvp-sim-%@hermes.invalid'
group by e.id, e.title order by simulated_going desc, e.id;

commit;
