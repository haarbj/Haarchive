import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// training_programs / program_phase_definitions / program_duration_
// variants / program_variant_phases / program_days / program_day_steps /
// program_day_extras / program_phase_weeks: the coach-configurable,
// reusable Program library, mirroring workout_templates_all_own's exact
// shape (coach_id = auth.uid(), no athlete-readable policy at all -- a
// Program only becomes athlete-facing once assign_program_generation()
// copies its output into training_phases/scheduled_workouts). This file
// verifies coach isolation across every new table, including the deepest
// child tables (program_day_steps/_extras), which join back through TWO
// parent tables to reach coach_id.
const programA = { id: "00000000-0000-4000-8000-0000000070a1", coachId: IDS.coachA };
const phaseDefA = { id: "00000000-0000-4000-8000-0000000071a1", programId: programA.id };
const variantA = { id: "00000000-0000-4000-8000-0000000072a1", programId: programA.id };
const dayA = { id: "00000000-0000-4000-8000-0000000073a1", programId: programA.id, phaseDefId: phaseDefA.id };
const stepA = { id: "00000000-0000-4000-8000-0000000074a1", dayId: dayA.id };
const extraA = { id: "00000000-0000-4000-8000-0000000075a1", dayId: dayA.id };
const weekLabelA = { id: "00000000-0000-4000-8000-0000000076a1", programId: programA.id, phaseDefId: phaseDefA.id };
// A real training_phases row linking Athlete A to Program A via
// source_program_id -- the only thing training_programs_select_athlete
// (20261101010000) and training_program_names key off. Athlete B has no
// such link to Program A, so stays the "unlinked athlete" negative case.
const linkedPhaseA = { id: "00000000-0000-4000-8000-0000000077a1", programId: programA.id, athleteId: IDS.athleteA };

beforeAll(async () => {
  await withCommittedServiceRole(async (c) => {
    await c.query(`insert into public.training_programs (id, coach_id, name) values ($1, $2, 'Program A')`, [
      programA.id,
      programA.coachId,
    ]);
    await c.query(
      `insert into public.program_phase_definitions (id, program_id, phase_key, position, duration_weeks_min, duration_weeks_max)
       values ($1, $2, 'General', 1, 2, 2)`,
      [phaseDefA.id, phaseDefA.programId],
    );
    await c.query(`insert into public.program_duration_variants (id, program_id, name) values ($1, $2, '2-Week')`, [
      variantA.id,
      variantA.programId,
    ]);
    await c.query(
      `insert into public.program_variant_phases (variant_id, phase_definition_id, position) values ($1, $2, 1)`,
      [variantA.id, phaseDefA.id],
    );
    await c.query(
      `insert into public.program_days (id, program_id, phase_definition_id, week_number, day_of_week, day_label)
       values ($1, $2, $3, 1, 1, 'Easy')`,
      [dayA.id, dayA.programId, dayA.phaseDefId],
    );
    await c.query(
      `insert into public.program_day_steps (id, program_day_id, step_order, step_type) values ($1, $2, 1, 'main')`,
      [stepA.id, stepA.dayId],
    );
    await c.query(`insert into public.program_day_extras (id, program_day_id, extra_order, kind) values ($1, $2, 1, 'Strides')`, [
      extraA.id,
      extraA.dayId,
    ]);
    await c.query(
      `insert into public.program_phase_weeks (id, program_id, phase_definition_id, week_number, label) values ($1, $2, $3, 1, 'Week 1')`,
      [weekLabelA.id, weekLabelA.programId, weekLabelA.phaseDefId],
    );
    await c.query(
      `insert into public.training_phases (id, athlete_id, coach_id, phase_type, start_date, end_date, source_program_id)
       values ($1, $2, $3, 'Base', current_date, current_date + 13, $4)`,
      [linkedPhaseA.id, linkedPhaseA.athleteId, programA.coachId, linkedPhaseA.programId],
    );
  });
});

afterAll(async () => {
  await withCommittedServiceRole((c) => c.query("delete from public.training_phases where id = $1", [linkedPhaseA.id]));
  await withCommittedServiceRole((c) => c.query("delete from public.training_programs where id = $1", [programA.id]));
  await closePool();
});

describe("training_programs RLS", () => {
  it("Coach A (the owning coach) can read their own program", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.training_programs where id = $1", [programA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Coach B cannot read Coach A's program", async () => {
    const rows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.training_programs where id = $1", [programA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Coach B cannot update or delete Coach A's program", async () => {
    const updateResult = await asUser(IDS.coachB, (c) =>
      c.query("update public.training_programs set name = 'Hijacked' where id = $1", [programA.id]),
    );
    expect(updateResult.rowCount).toBe(0);

    const deleteResult = await asUser(IDS.coachB, (c) =>
      c.query("delete from public.training_programs where id = $1", [programA.id]),
    );
    expect(deleteResult.rowCount).toBe(0);
  });

  it("Athlete A (a real athlete of Coach A) cannot read Coach A's program -- Programs are never athlete-visible", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.training_programs where id = $1", [programA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("program_phase_definitions / program_duration_variants / program_variant_phases RLS (join through training_programs)", () => {
  it("Coach A can read their own phase definition, variant, and variant-phase link", async () => {
    const phaseRows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.program_phase_definitions where id = $1", [phaseDefA.id]).then((r) => r.rows),
    );
    expect(phaseRows).toHaveLength(1);

    const variantRows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.program_duration_variants where id = $1", [variantA.id]).then((r) => r.rows),
    );
    expect(variantRows).toHaveLength(1);

    const linkRows = await asUser(IDS.coachA, (c) =>
      c.query("select variant_id from public.program_variant_phases where variant_id = $1", [variantA.id]).then((r) => r.rows),
    );
    expect(linkRows).toHaveLength(1);
  });

  it("Coach B cannot read Coach A's phase definition, variant, or variant-phase link", async () => {
    const phaseRows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.program_phase_definitions where id = $1", [phaseDefA.id]).then((r) => r.rows),
    );
    expect(phaseRows).toHaveLength(0);

    const variantRows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.program_duration_variants where id = $1", [variantA.id]).then((r) => r.rows),
    );
    expect(variantRows).toHaveLength(0);

    const linkRows = await asUser(IDS.coachB, (c) =>
      c.query("select variant_id from public.program_variant_phases where variant_id = $1", [variantA.id]).then((r) => r.rows),
    );
    expect(linkRows).toHaveLength(0);
  });
});

describe("program_days / program_day_steps / program_day_extras / program_phase_weeks RLS (join through phase_definition/program_id)", () => {
  it("Coach A can read their own day, step, extra, and week label", async () => {
    const dayRows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.program_days where id = $1", [dayA.id]).then((r) => r.rows),
    );
    expect(dayRows).toHaveLength(1);

    const stepRows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.program_day_steps where id = $1", [stepA.id]).then((r) => r.rows),
    );
    expect(stepRows).toHaveLength(1);

    const extraRows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.program_day_extras where id = $1", [extraA.id]).then((r) => r.rows),
    );
    expect(extraRows).toHaveLength(1);

    const weekLabelRows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.program_phase_weeks where id = $1", [weekLabelA.id]).then((r) => r.rows),
    );
    expect(weekLabelRows).toHaveLength(1);
  });

  it("Coach B cannot read, update, or delete Coach A's day, step, extra, or week label -- including the deepest child tables", async () => {
    const dayRows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.program_days where id = $1", [dayA.id]).then((r) => r.rows),
    );
    expect(dayRows).toHaveLength(0);

    const stepRows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.program_day_steps where id = $1", [stepA.id]).then((r) => r.rows),
    );
    expect(stepRows).toHaveLength(0);

    const extraRows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.program_day_extras where id = $1", [extraA.id]).then((r) => r.rows),
    );
    expect(extraRows).toHaveLength(0);

    const weekLabelRows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.program_phase_weeks where id = $1", [weekLabelA.id]).then((r) => r.rows),
    );
    expect(weekLabelRows).toHaveLength(0);

    const deleteStepResult = await asUser(IDS.coachB, (c) =>
      c.query("delete from public.program_day_steps where id = $1", [stepA.id]),
    );
    expect(deleteStepResult.rowCount).toBe(0);
  });

  it("Athlete A cannot read Coach A's program day content -- never athlete-visible at any layer", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.program_days where id = $1", [dayA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});

// training_programs_select_athlete / training_program_names
// (20261101010000): the narrow exception to "Programs are never
// athlete-visible" above -- an athlete can read just the id/name of a
// Program one of their OWN phases is linked to via source_program_id,
// nothing else. linkedPhaseA (Athlete A, Program A) is the only such
// link anywhere in this file's fixtures.
describe("training_programs_select_athlete / training_program_names RLS", () => {
  it("Athlete A (linked via their own phase) can read Program A's name through the view", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id, name from public.training_program_names where id = $1", [programA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Program A");
  });

  it("Athlete A still cannot read Program A through the base table directly -- the view is the only athlete-facing path", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.training_programs where id = $1", [programA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Athlete B (no phase linking them to Program A) cannot read Program A's name through the view either", async () => {
    const rows = await asUser(IDS.athleteB, (c) =>
      c.query("select id, name from public.training_program_names where id = $1", [programA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("The view exposes only id/name -- no other training_programs column is selectable through it", async () => {
    await expect(
      asUser(IDS.athleteA, (c) => c.query("select coach_id from public.training_program_names where id = $1", [programA.id])),
    ).rejects.toThrow(/column .*coach_id.* does not exist/i);
  });

  it("Coach A (the owning coach, via the pre-existing coach policy) can still read Program A's name through the view", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id, name from public.training_program_names where id = $1", [programA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Program A");
  });
});

// The is_event_day partial-unique-index constraint itself (schema-level,
// not RLS -- it holds regardless of which role writes) is exercised
// directly against staging in this feature's own smoke test, and again at
// the application layer by program-generation.ts's defense-in-depth scan
// (see program-generation.test.ts's "more than one day marked is_event_
// day" case) -- not duplicated here, since this file's own job is cross-
// coach RLS isolation specifically.
