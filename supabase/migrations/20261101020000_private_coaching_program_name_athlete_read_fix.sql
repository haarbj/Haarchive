-- Corrects 20261101010000, applied moments earlier in the same task: its
-- RLS-policy-plus-security_invoker-view design turned out unsound. The
-- new training_programs_select_athlete policy does let the view project
-- only id/name -- but once ANY policy admits a row, every column of that
-- row becomes selectable by a *direct* query against the base table too,
-- since a security_invoker view only limits what the view itself
-- projects, not what the underlying table's own RLS allows once it says
-- yes. Confirmed by a failing RLS test this same task added: "Athlete A
-- still cannot read Program A through the base table directly" started
-- returning the row once training_programs_select_athlete existed --
-- exactly the "full-row reads on training_programs to athletes" the task
-- explicitly ruled out.
--
-- Drop both and replace with the pattern already established in this
-- codebase for "narrow, column-limited slice of a table, independent of
-- the base table's own RLS" -- see public_personal_records
-- (20260721010000): a security_invoker = false (definer-style) view. It
-- runs with the view owner's privileges, bypassing training_programs'
-- RLS for its own internal read, and instead encodes the real
-- authorization check directly in its own WHERE clause -- the coach's
-- existing condition (coach_id = auth.uid()) OR the new athlete
-- condition (linked via one of their own phases' source_program_id) --
-- while its SELECT list structurally limits the exposed columns to
-- id/name regardless of which branch matched. training_programs itself,
-- and training_programs_all_own, are untouched by either migration --
-- the base table's own access story (coach-only, full row) never
-- changes; this view is a narrow, self-contained, additive side door for
-- exactly one read.
drop policy "training_programs_select_athlete" on public.training_programs;
drop view public.training_program_names;

create view public.training_program_names
  with (security_invoker = false) as
  select id, name
  from public.training_programs
  where coach_id = (select auth.uid())
     or exists (
          select 1
          from public.training_phases tp
          where tp.source_program_id = training_programs.id
            and tp.athlete_id = (select auth.uid())
        );

grant select on public.training_program_names to authenticated;
