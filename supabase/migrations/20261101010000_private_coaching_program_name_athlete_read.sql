-- Closes the RLS program-name gap found during the 2026-11-01 read-only
-- audit: training_programs_all_own (20260925010000) is deliberately
-- coach-only ("Never athlete-visible at any layer"), so an athlete's own
-- "Your Plan" page could never resolve the <program name> heading for a
-- Program-assigned phase -- loadPlanPayoffData's name lookup always ran
-- with the athlete's own RLS-scoped session and got nothing back, even
-- though the phase itself (a real training_phases row, already
-- athlete-readable via training_phases_select_athlete) rendered fine.
--
-- Goal here is exactly "let an athlete read the Program name for a
-- Program-assigned phase of their own, nothing more" -- not athlete
-- access to the coach's template library in general. Two things make
-- that true:
--
-- 1. A brand new, narrowly-scoped SELECT policy (athlete-linked-via-
--    phase only) -- training_programs_all_own is untouched, and this is
--    additive alongside it; RLS policies for the same command OR
--    together, so the coach's own full-row access is unaffected.
--
-- 2. A column-limited view, not a column-level GRANT on the base table.
--    A GRANT is per-role, not per-policy: training_programs_all_own and
--    this new policy both run as the same `authenticated` role, so
--    restricting that role's column grants on the base table would also
--    strip the coach's own access to every column besides id/name --
--    a real regression, not an additive change. A security_invoker view
--    sidesteps that: its own SELECT list is what structurally limits the
--    exposed columns to id/name, regardless of which policy (coach's or
--    this new one) is what let a given row through underneath it.
--
-- CORRECTED by 20261101020000: the RLS-policy-plus-view design above
-- turned out unsound (see that migration's own header for why) and was
-- replaced there. Left as originally written/applied here rather than
-- edited after the fact, since this file was already applied to staging
-- before the issue was found -- 20261101020000 is the real fix.

-- The policy's own subquery filter (and any future "which programs has
-- this athlete's training actually drawn from" query) -- training_phases
-- had no index on this column before now.
create index idx_training_phases_source_program_id on public.training_phases (source_program_id);

create policy "training_programs_select_athlete" on public.training_programs
  for select to authenticated using (
    exists (
      select 1
      from public.training_phases tp
      where tp.source_program_id = training_programs.id
        and tp.athlete_id = (select auth.uid())
    )
  );

-- security_invoker = true (not the classic/default false) so this view
-- defers entirely to training_programs' own RLS stack -- both
-- training_programs_all_own and training_programs_select_athlete above --
-- instead of running with the view owner's elevated privileges.
create view public.training_program_names
  with (security_invoker = true) as
  select id, name from public.training_programs;

grant select on public.training_program_names to authenticated;
