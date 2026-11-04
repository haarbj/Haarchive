-- Fixes the finding from the dashboard/admin performance audit: /admin/users
-- previously fetched EVERY row of learning_events and saved_calculations
-- (unfiltered, unlimited -- just the user_id column) and hand-rolled a
-- per-user count in JS (admin/users/page.tsx's own countByUser()), on every
-- page load and every filter-submit. That doesn't fail today, but it's a
-- scaling cliff as either table grows -- the count belongs in the database.
--
-- A single view joining both counts (rather than two separate views) matches
-- the page's own access pattern: it always wants both counts together, keyed
-- by user_id, in the one loadUsers() call.
--
-- GROUP BY makes this structurally non-updatable already (same reasoning as
-- public_personal_records, 20260721010000) but the revoke below is still
-- explicit, not assumed: this is engagement data across ALL users, read only
-- by the admin page's service-role client (service_role bypasses grants
-- entirely, so no re-grant is needed for it to work) -- anon and
-- authenticated get nothing, the same deny-all-by-default shape
-- club_intake_cycles/_submissions (20261026210000) already established for
-- an admin/service-role-only table.
create view public.user_engagement_counts
  with (security_invoker = false) as
  select
    coalesce(le.user_id, sc.user_id) as user_id,
    coalesce(le.learning_event_count, 0) as learning_event_count,
    coalesce(sc.saved_calculation_count, 0) as saved_calculation_count
  from
    (select user_id, count(*) as learning_event_count from public.learning_events group by user_id) le
    full outer join
    (select user_id, count(*) as saved_calculation_count from public.saved_calculations group by user_id) sc
    on le.user_id = sc.user_id;

revoke all on public.user_engagement_counts from anon;
revoke all on public.user_engagement_counts from authenticated;
