import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// Exercises assign_program_generation() itself -- the one atomic RPC
// write path assign-program-actions.ts's assignProgramToAthlete calls --
// against real, simulated authenticated sessions (via asUser, a real
// auth.uid() session variable, not a service-role bypass), since a
// service-role smoke test can't exercise the function's own auth.uid()-
// based authorization checks at all (auth.uid() is null for service_role).
// Coach A -> Athlete A is a real, active relationship (see fixtures.ts).
const programA = { id: "00000000-0000-4000-8000-0000000080a1", coachId: IDS.coachA };
const phaseDefA = { id: "00000000-0000-4000-8000-0000000081a1" };
const variantA = { id: "00000000-0000-4000-8000-0000000082a1" };
const programDayA = { id: "00000000-0000-4000-8000-0000000083a1" };
const volumeVariantA = { id: "00000000-0000-4000-8000-0000000084a1" };

beforeAll(async () => {
  await withCommittedServiceRole(async (c) => {
    await c.query(`insert into public.training_programs (id, coach_id, name, scales_distance_with_mileage) values ($1, $2, 'RPC Test Program', true)`, [
      programA.id,
      programA.coachId,
    ]);
    await c.query(
      `insert into public.program_phase_definitions (id, program_id, phase_key, position, duration_weeks_min, duration_weeks_max)
       values ($1, $2, 'General', 1, 2, 2)`,
      [phaseDefA.id, programA.id],
    );
    await c.query(`insert into public.program_duration_variants (id, program_id, name) values ($1, $2, '2-Week')`, [
      variantA.id,
      programA.id,
    ]);
    await c.query(`insert into public.program_variant_phases (variant_id, phase_definition_id, position) values ($1, $2, 1)`, [
      variantA.id,
      phaseDefA.id,
    ]);
    await c.query(
      `insert into public.program_days (id, program_id, phase_definition_id, week_number, day_of_week, day_label, planned_distance_m)
       values ($1, $2, $3, 1, 1, 'Easy', 8000)`,
      [programDayA.id, programA.id, phaseDefA.id],
    );
    await c.query(
      `insert into public.program_volume_variants (id, program_id, variant_key, name, position, peak_mileage, initial_mileage)
       values ($1, $2, 'test-50', '50 mi/week peak', 1, 50, 35)`,
      [volumeVariantA.id, programA.id],
    );
  });
});

afterAll(async () => {
  await withCommittedServiceRole((c) => c.query("delete from public.training_programs where id = $1", [programA.id]));
  await closePool();
});

const phasesJson = JSON.stringify([
  { phaseDefinitionId: phaseDefA.id, phaseKey: "General", name: null, startDate: "2027-06-07", endDate: "2027-06-20" },
]);
const daysJson = JSON.stringify([
  {
    sourceProgramDayId: programDayA.id,
    scheduledDate: "2027-06-07",
    dayLabel: "Easy",
    sessionSlot: null,
    plannedDistanceM: 8000,
    steps: [{ stepOrder: 0, stepType: "main", targetType: "open" }],
    extras: [{ extraOrder: 0, kind: "Strides", items: ["A skips"] }],
  },
]);
const weeksJson = JSON.stringify([{ weekStart: "2027-06-07", targetVolumeMin: 25, label: null }]);

describe("assign_program_generation RPC", () => {
  it("Coach A (real relationship with Athlete A) can successfully assign the program, writing real rows", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c
        .query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb) as result", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesJson,
          daysJson,
          weeksJson,
        ])
        .then((r) => r.rows[0].result),
    );
    expect(result.phasesCreated).toBe(1);
    expect(result.workoutsCreated).toBe(1);

    // The insert itself happened inside asUser's own transaction, which
    // rolls back after the test -- confirm the rows are visible from
    // WITHIN that same transaction (asUser's callback), which is the real
    // thing under test (did the function actually write correctly),
    // without needing the data to persist afterward.
    const phaseRows = await asUser(IDS.coachA, (c) =>
      c
        .query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesJson,
          daysJson,
          weeksJson,
        ])
        .then(() => c.query("select id from public.training_phases where source_program_id = $1", [programA.id]))
        .then((r) => r.rows),
    );
    expect(phaseRows.length).toBeGreaterThan(0);
  });

  it("Coach B (no relationship with Athlete A, doesn't own the program) is rejected by the function itself", async () => {
    await expect(
      asUser(IDS.coachB, (c) =>
        c.query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesJson,
          daysJson,
          weeksJson,
        ]),
      ),
    ).rejects.toThrow(/Not authorized/);
  });

  it("Coach A cannot assign this program to Athlete B (no active coaching relationship)", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)", [
          programA.id,
          variantA.id,
          IDS.athleteB,
          phasesJson,
          daysJson,
          weeksJson,
        ]),
      ),
    ).rejects.toThrow(/no active coaching relationship/);
  });

  it("rejects a variant that doesn't belong to the named program", async () => {
    const otherVariantId = "00000000-0000-4000-8000-0000000082b1";
    await withCommittedServiceRole(async (c) => {
      await c.query(`insert into public.training_programs (id, coach_id, name) values ($1, $2, 'Other Program')`, [
        "00000000-0000-4000-8000-0000000080b1",
        IDS.coachA,
      ]);
      await c.query(`insert into public.program_duration_variants (id, program_id, name) values ($1, $2, 'Other Variant')`, [
        otherVariantId,
        "00000000-0000-4000-8000-0000000080b1",
      ]);
    });
    try {
      await expect(
        asUser(IDS.coachA, (c) =>
          c.query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)", [
            programA.id,
            otherVariantId,
            IDS.athleteA,
            phasesJson,
            daysJson,
            weeksJson,
          ]),
        ),
      ).rejects.toThrow(/Invalid variant/);
    } finally {
      await withCommittedServiceRole((c) => c.query("delete from public.training_programs where id = $1", ["00000000-0000-4000-8000-0000000080b1"]));
    }
  });

  it("rejects an overlapping assignment by default, but succeeds and replaces the old block when p_clear_overlapping is true", async () => {
    await asUser(IDS.coachA, async (c) => {
      await c.query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)", [
        programA.id,
        variantA.id,
        IDS.athleteA,
        phasesJson,
        daysJson,
        weeksJson,
      ]);

      // Default (p_clear_overlapping omitted -> false): same abort as
      // before. A savepoint around the expected failure is required here
      // -- asUser's own transaction has no implicit savepoint per query,
      // so a query that errors (by design, in this assertion) would
      // otherwise abort every later query in this same test's transaction.
      await c.query("savepoint overlap_check");
      await expect(
        c.query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesJson,
          daysJson,
          weeksJson,
        ]),
      ).rejects.toThrow(/overlaps an existing training phase/);
      await c.query("rollback to savepoint overlap_check");

      // Explicit opt-in: the old phase (and its workout) is cleared first,
      // then the new one is written -- no overlap error, exactly one
      // training_phases row survives for this athlete/program.
      const result = await c
        .query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, true) as result", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesJson,
          daysJson,
          weeksJson,
        ])
        .then((r) => r.rows[0].result);
      expect(result.clearedPhases).toBe(1);
      expect(result.clearedWorkouts).toBe(1);
      expect(result.phasesCreated).toBe(1);

      const phaseRows = await c.query("select id from public.training_phases where athlete_id = $1 and source_program_id = $2", [
        IDS.athleteA,
        programA.id,
      ]);
      expect(phaseRows.rows.length).toBe(1);
    });
  });
});

describe("resync_program_phase_generation RPC", () => {
  it("replaces an assigned phase's workouts/week-plans with freshly-provided content, in place", async () => {
    await asUser(IDS.coachA, async (c) => {
      const assigned = await c
        .query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb) as result", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesJson,
          daysJson,
          weeksJson,
        ])
        .then((r) => r.rows[0].result);
      expect(assigned.workoutsCreated).toBe(1);

      const phaseRow = await c
        .query("select id from public.training_phases where athlete_id = $1 and source_program_id = $2", [IDS.athleteA, programA.id])
        .then((r) => r.rows[0]);

      const resyncedDaysJson = JSON.stringify([
        {
          sourceProgramDayId: programDayA.id,
          scheduledDate: "2027-06-07",
          dayLabel: "Easy, resynced",
          sessionSlot: null,
          plannedDistanceM: 9000,
          steps: [],
          extras: [],
        },
        {
          sourceProgramDayId: programDayA.id,
          scheduledDate: "2027-06-08",
          dayLabel: "Second day, newly added",
          sessionSlot: null,
          plannedDistanceM: 5000,
          steps: [],
          extras: [],
        },
      ]);

      const result = await c
        .query("select resync_program_phase_generation($1, $2, $3::jsonb, $4::jsonb) as result", [
          phaseRow.id,
          IDS.athleteA,
          resyncedDaysJson,
          weeksJson,
        ])
        .then((r) => r.rows[0].result);
      expect(result.clearedWorkouts).toBe(1);
      expect(result.workoutsCreated).toBe(2);

      const workoutRows = await c.query(
        "select scheduled_date, day_label from public.scheduled_workouts where athlete_id = $1 and scheduled_date between $2 and $3 order by scheduled_date",
        [IDS.athleteA, "2027-06-07", "2027-06-20"],
      );
      expect(workoutRows.rows).toEqual([
        { scheduled_date: expect.anything(), day_label: "Easy, resynced" },
        { scheduled_date: expect.anything(), day_label: "Second day, newly added" },
      ]);
    });
  });

  it("rejects a phase that wasn't generated from a Program", async () => {
    await asUser(IDS.coachA, async (c) => {
      const handBuiltId = "00000000-0000-4000-8000-0000000084a1";
      await c.query(
        `insert into public.training_phases (id, athlete_id, coach_id, phase_type, start_date, end_date)
         values ($1, $2, $3, 'Base', '2027-01-04', '2027-01-17')`,
        [handBuiltId, IDS.athleteA, IDS.coachA],
      );
      await expect(
        c.query("select resync_program_phase_generation($1, $2, $3::jsonb, $4::jsonb)", [handBuiltId, IDS.athleteA, "[]", "[]"]),
      ).rejects.toThrow(/not generated from a Program/);
    });
  });

  it("Coach B cannot resync a phase it doesn't own", async () => {
    // asUser's own transaction always rolls back (see this file's own
    // header comment / the README) -- a phase this test's own assertion
    // needs to still exist in a SEPARATE connection (Coach B's) has to be
    // committed for real first, via the service role, not left inside an
    // asUser(coachA) call.
    const phaseId = "00000000-0000-4000-8000-0000000084b1";
    await withCommittedServiceRole((c) =>
      c.query(
        `insert into public.training_phases (id, athlete_id, coach_id, phase_type, start_date, end_date, source_program_id, source_program_phase_definition_id, source_program_duration_variant_id)
         values ($1, $2, $3, 'General', '2027-07-05', '2027-07-18', $4, $5, $6)`,
        [phaseId, IDS.athleteA, IDS.coachA, programA.id, phaseDefA.id, variantA.id],
      ),
    );
    try {
      await expect(
        asUser(IDS.coachB, (c) => c.query("select resync_program_phase_generation($1, $2, $3::jsonb, $4::jsonb)", [phaseId, IDS.athleteA, "[]", "[]"])),
      ).rejects.toThrow(/Not authorized/);
    } finally {
      await withCommittedServiceRole((c) => c.query("delete from public.training_phases where id = $1", [phaseId]));
    }
  });
});

// The volume-variant half of the RPC contract (20261013060000). These are
// data-shape assertions about what the function writes, run through a real
// authenticated session like everything else in this file.
describe("assign_program_generation: authored goal mileage and volume provenance", () => {
  const phasesWithVariant = JSON.stringify([
    {
      phaseDefinitionId: phaseDefA.id,
      phaseKey: "General",
      name: null,
      startDate: "2027-06-07",
      endDate: "2027-06-20",
      volumeVariantId: volumeVariantA.id,
    },
  ]);

  it("writes a week's authored goal-mileage RANGE, instead of flattening it to its floor", async () => {
    // A framework authoring "85-90" for a week must not silently become 85.
    const weeks = JSON.stringify([{ weekStart: "2027-06-07", targetVolumeMin: 85, targetVolumeMax: 90, label: null }]);
    const row = await asUser(IDS.coachA, (c) =>
      c
        .query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesWithVariant,
          daysJson,
          weeks,
        ])
        .then(() =>
          c.query(
            "select target_volume_min, target_volume_max, target_volume_unit from public.training_week_plans where athlete_id = $1 and week_start = '2027-06-07'",
            [IDS.athleteA],
          ),
        )
        .then((r) => r.rows[0]),
    );
    expect(Number(row.target_volume_min)).toBe(85);
    expect(Number(row.target_volume_max)).toBe(90);
    expect(row.target_volume_unit).toBe("miles");
  });

  it("records the peak-volume variant on the athlete's phase, so a resync keeps the same level", async () => {
    const weeks = JSON.stringify([{ weekStart: "2027-06-07", targetVolumeMin: 85, targetVolumeMax: 90, label: null }]);
    const row = await asUser(IDS.coachA, (c) =>
      c
        .query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesWithVariant,
          daysJson,
          weeks,
        ])
        .then(() =>
          c.query(
            "select source_program_volume_variant_id, source_program_duration_variant_id from public.training_phases where source_program_id = $1",
            [programA.id],
          ),
        )
        .then((r) => r.rows[0]),
    );
    expect(row.source_program_volume_variant_id).toBe(volumeVariantA.id);
    // The two variant axes are recorded independently.
    expect(row.source_program_duration_variant_id).toBe(variantA.id);
  });

  it("leaves race week with no prescribed total rather than a target of zero", async () => {
    // The frameworks author "n/a" for race week; that must stay absent.
    const weeks = JSON.stringify([{ weekStart: "2027-06-07", targetVolumeMin: null, targetVolumeMax: null, label: null }]);
    const row = await asUser(IDS.coachA, (c) =>
      c
        .query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesWithVariant,
          daysJson,
          weeks,
        ])
        .then(() =>
          c.query(
            "select target_volume_min, target_volume_max from public.training_week_plans where athlete_id = $1 and week_start = '2027-06-07'",
            [IDS.athleteA],
          ),
        )
        .then((r) => r.rows[0]),
    );
    expect(row.target_volume_min).toBeNull();
    expect(row.target_volume_max).toBeNull();
  });

  it("still accepts a program with no volume variant, writing a single derived total", async () => {
    // Every hand-authored program keeps its old behavior: no
    // volumeVariantId, no max, week total derived from day distances.
    const weeks = JSON.stringify([{ weekStart: "2027-06-07", targetVolumeMin: 25, label: null }]);
    const result = await asUser(IDS.coachA, (c) =>
      c
        .query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb) as result", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesJson,
          daysJson,
          weeks,
        ])
        .then(async (r) => {
          const weekRow = await c.query(
            "select target_volume_min, target_volume_max from public.training_week_plans where athlete_id = $1 and week_start = '2027-06-07'",
            [IDS.athleteA],
          );
          const phaseRow = await c.query(
            "select source_program_volume_variant_id from public.training_phases where source_program_id = $1",
            [programA.id],
          );
          return { result: r.rows[0].result, week: weekRow.rows[0], phase: phaseRow.rows[0] };
        }),
    );
    expect(result.result.phasesCreated).toBe(1);
    expect(Number(result.week.target_volume_min)).toBe(25);
    expect(result.week.target_volume_max).toBeNull();
    expect(result.phase.source_program_volume_variant_id).toBeNull();
  });
});

// The optional/alternative carry-through (20261013070000). program_days has
// carried these since the volume-variants migration; these assert the
// athlete's generated workout actually receives them.
describe("assign_program_generation: optional sessions and single-session alternatives", () => {
  const optionalDaysJson = JSON.stringify([
    {
      sourceProgramDayId: programDayA.id,
      scheduledDate: "2027-06-07",
      dayLabel: "Easy",
      sessionSlot: "AM",
      isOptional: true,
      alternativeText: "Single-threshold alternative: 6 x 1 km progressing 102-105% MP with 1 min walk.",
      plannedDistanceM: 8000,
      steps: [],
      extras: [],
    },
  ]);

  it("marks an optional session optional on the athlete's own workout", async () => {
    const row = await asUser(IDS.coachA, (c) =>
      c
        .query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesJson,
          optionalDaysJson,
          weeksJson,
        ])
        .then(() =>
          c.query(
            "select is_optional, alternative_text, session_slot from public.scheduled_workouts where athlete_id = $1 and scheduled_date = '2027-06-07'",
            [IDS.athleteA],
          ),
        )
        .then((r) => r.rows[0]),
    );
    expect(row.is_optional).toBe(true);
    expect(row.alternative_text).toMatch(/Single-threshold alternative/);
    expect(row.session_slot).toBe("AM");
  });

  it("defaults a workout to required when the program says nothing about it", async () => {
    // Every hand-authored program, and every workout that already exists:
    // "optional" is something a framework says, never an inference.
    const row = await asUser(IDS.coachA, (c) =>
      c
        .query("select assign_program_generation($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)", [
          programA.id,
          variantA.id,
          IDS.athleteA,
          phasesJson,
          daysJson,
          weeksJson,
        ])
        .then(() =>
          c.query(
            "select is_optional, alternative_text from public.scheduled_workouts where athlete_id = $1 and scheduled_date = '2027-06-07'",
            [IDS.athleteA],
          ),
        )
        .then((r) => r.rows[0]),
    );
    expect(row.is_optional).toBe(false);
    expect(row.alternative_text).toBeNull();
  });
});
