-- Removes only the marked simulation accounts and their cascading RSVPs.
-- Real accounts and real RSVPs are untouched. Run as postgres, not a client.
begin;
with removed as (
  delete from auth.users
  where raw_app_meta_data->>'hermes_fixture' = 'hermes-rsvp-sim-v1'
    and email like 'rsvp-sim-%@hermes.invalid'
    and banned_until = '2099-12-31 23:59:59+00'::timestamptz
  returning id
)
select count(*) as removed_simulated_users from removed;
commit;
