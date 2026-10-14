// Pure normalization of the verified marathon-framework seed files
// (scripts/data/framework-seeds/{canyon,mesa,ridge,peak,summit}.json and
// crash-course.json) into the row shapes the Program layer stores --
// training_programs / program_phase_definitions / program_duration_variants
// / program_volume_variants / program_phase_weeks /
// program_phase_week_volumes / program_days.
//
// Deliberately pure and DB-free, exactly like program-generation.ts: the
// seed script (scripts/seed-framework-programs.ts) does nothing but load
// JSON, call buildFrameworkSeed, and write the rows it returns, so every
// transcription rule below is unit-testable without a database (see
// tests/lib/private-coaching/framework-seed.test.ts).
//
// WHAT IS AND ISN'T DERIVED FROM THE SOURCE. The seed files are verified
// transcriptions of the Marathon Excellence web PDFs, cross-checked
// against Kindle screenshots, with every PDF/Kindle conflict already
// settled in the file's own `conflicts_resolved` block. This module's job
// is therefore transcription, never interpretation:
//
//   * Each session's prescription text is stored VERBATIM in
//     program_days.notes. It is never parsed into program_day_steps.
//     "10 x 3 min at 90-92% 5k pace with 45 sec jog" carries a rep count,
//     a pace range, a rest length and an implied warm-up/cool-down
//     structure, and splitting that into structured steps means choosing,
//     per workout, which of several ranges the author meant to be the
//     "real" target -- the exact approximation CLAUDE.md 5/15 and both
//     library data files' own header comments forbid. Steps remain a thing
//     a coach can add by hand later, on top of real authored prose.
//
//   * Pace percent (program_days.pace_percent_basis/_min/_max) is
//     deliberately NOT populated for any seeded day, so no seeded workout
//     resolves into a literal pace against the athlete's fitness estimate
//     -- it renders as the authored prose instead. This is a consequence of
//     the sources, not an omission: scripts/data/canyon-program.ts sets a
//     day-level percent only where "the day's whole prescription is a
//     single, unambiguous clause", and in these web-PDF transcriptions
//     that case never occurs -- every pace-targeted session states its
//     warm-up and cool-down in the same string ("2 mi progressive warm-up
//     + 4 strides / 7-8 mi at 85% 5k pace / 2 mi easy cool-down"). A
//     day-level percent means "this whole workout is at this pace," which
//     is false for all 11-12 of those miles. The honest home for these
//     targets is step-level (program_day_steps.target_pace_percent_*),
//     which means authoring the warm-up/main-set/cool-down split -- and
//     for an interval session, every rep and float -- per day. That is a
//     real, bounded follow-up, not something to approximate here.
//
//   * Difficulty is preserved verbatim (program_days.difficulty_label) and
//     ALSO widened into the integer planned_rpe/_max pair every existing
//     editor reads, because that column is an int and the sources use half
//     points. See parseDifficulty.
//
//   * Day of week comes from each week's POSITION in the days array, never
//     from the day label. The frameworks label days "M T W T F S S", where
//     Tuesday/Thursday and Saturday/Sunday are literally the same
//     character -- parsing those labels is ambiguous by construction. The
//     arrays are Monday-first and seven long (asserted below), so index +
//     1 is the real, unambiguous day number, matching program_days'
//     Monday-aligned 1=Monday..7=Sunday convention.

/** Both ASCII hyphen and en dash appear as range separators across the seed files (Peak and Summit use en dashes, Canyon and Mesa hyphens) -- neither is normalized away in the stored verbatim text, only in the parsed numbers. */
const RANGE_SEPARATOR = /[-–—]/;

// ---------------------------------------------------------------------------
// Raw seed-file shapes (exactly as authored -- not reshaped)
// ---------------------------------------------------------------------------

export type RawFrameworkSession = {
  slot: "AM" | "PM" | "single";
  workout: string;
  difficulty: string | null;
  optional?: boolean;
  alternatives?: string | null;
};

export type RawFrameworkDay = { day: string; sessions: RawFrameworkSession[] };

export type RawFrameworkWeek = {
  week: number;
  phase: string;
  goal_mileage: Record<string, string>;
  revise_fitness_estimate?: boolean;
  convert_fitness_estimate_to_mp?: boolean;
  days: RawFrameworkDay[];
  notes?: string;
};

export type RawFrameworkVariant = { id: string; peak_mileage: number; initial_mileage: number };

export type RawFramework = {
  framework: string;
  source_plan_name?: string;
  source: string;
  distance: string;
  duration_weeks: number;
  variants: RawFrameworkVariant[];
  typical_goal_times?: string;
  recommended_for?: string;
  experience?: string;
  phases: { name: string; weeks: number[] }[];
  structural_features?: string[];
  weeks: RawFrameworkWeek[];
};

// ---------------------------------------------------------------------------
// Normalized output row shapes
// ---------------------------------------------------------------------------

export type SeedProgram = {
  frameworkKey: string;
  name: string;
  description: string;
  eventDistance: string;
  sourceReference: string;
  typicalGoalTimes: string | null;
  recommendedFor: string | null;
  initialMileageMin: number | null;
  initialMileageMax: number | null;
  peakMileageMin: number | null;
  peakMileageMax: number | null;
  glossaryTerms: string[] | null;
};

export type SeedPhaseDefinition = {
  phaseKey: string;
  position: number;
  durationWeeksMin: number;
  durationWeeksMax: number;
  notes: string | null;
  /** Absolute plan week numbers this phase spans, in order -- used to translate an absolute week into a phase-relative one. Not stored; the phase's duration is what persists. */
  absoluteWeeks: number[];
};

export type SeedVolumeVariant = {
  variantKey: string;
  name: string;
  position: number;
  peakMileage: number;
  initialMileage: number;
  isDefault: boolean;
};

export type SeedPhaseWeek = {
  phaseKey: string;
  weekNumber: number;
  notes: string | null;
  reviseFitnessEstimate: boolean;
  convertFitnessEstimateToMp: boolean;
};

export type SeedPhaseWeekVolume = {
  variantKey: string;
  phaseKey: string;
  weekNumber: number;
  goalMileageLabel: string;
  goalMileageMin: number | null;
  goalMileageMax: number | null;
};

export type SeedDay = {
  phaseKey: string;
  /** Phase-relative, 1-indexed -- plan week 7 is Supportive week 1. */
  weekNumber: number;
  /** 1=Monday..7=Sunday, from array position. */
  dayOfWeek: number;
  sessionSlot: string | null;
  notes: string;
  isOptional: boolean;
  alternativeText: string | null;
  difficultyLabel: string | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
};

export type FrameworkSeedPlan = {
  program: SeedProgram;
  phases: SeedPhaseDefinition[];
  durationVariantName: string;
  volumeVariants: SeedVolumeVariant[];
  phaseWeeks: SeedPhaseWeek[];
  phaseWeekVolumes: SeedPhaseWeekVolume[];
  days: SeedDay[];
};

// ---------------------------------------------------------------------------
// Field-level parsers
// ---------------------------------------------------------------------------

/**
 * "8.5-9/10" -> { label: "8.5-9/10", rpeMin: 8, rpeMax: 9 }.
 *
 * planned_rpe is `int check (planned_rpe between 1 and 10)`, so it cannot
 * hold the half points these frameworks actually use. Rather than round
 * (which asserts a single value the source never claimed -- "7.5/10"
 * becoming a flat 8), the integer pair is the CONTAINING ENVELOPE:
 * floor(min)..ceil(max). "7.5/10" becomes 7..8, which is wider than the
 * source but never narrower and never wrong, and difficultyLabel keeps the
 * exact string for display. A whole-number rating with no range
 * ("7/10") stays a single point value with a null max, matching how every
 * other min/max pair in this schema represents "not a range."
 */
export function parseDifficulty(raw: string | null | undefined): {
  label: string | null;
  rpeMin: number | null;
  rpeMax: number | null;
} {
  if (raw == null) return { label: null, rpeMin: null, rpeMax: null };
  const trimmed = raw.trim();
  if (trimmed === "") return { label: null, rpeMin: null, rpeMax: null };

  const withoutScale = trimmed.replace(/\s*\/\s*10\s*$/, "");
  const parts = withoutScale.split(RANGE_SEPARATOR).map((p) => p.trim());
  const numbers = parts.map((p) => Number(p));
  if (parts.length > 2 || numbers.some((n) => !Number.isFinite(n))) {
    throw new Error(`Unparseable difficulty rating: ${JSON.stringify(raw)}`);
  }

  const low = numbers[0];
  const high = numbers.length === 2 ? numbers[1] : numbers[0];
  if (high < low) throw new Error(`Difficulty range runs backwards: ${JSON.stringify(raw)}`);

  const rpeMin = Math.floor(low);
  const rpeMaxRaw = Math.ceil(high);
  // A single whole number is a point value, not a 1-wide range.
  const rpeMax = rpeMaxRaw === rpeMin ? null : rpeMaxRaw;
  if (rpeMin < 1 || rpeMaxRaw > 10) throw new Error(`Difficulty out of the 1-10 RPE range: ${JSON.stringify(raw)}`);

  return { label: trimmed, rpeMin, rpeMax };
}

/**
 * "85-90" -> { min: 85, max: 90 }; "70" -> { min: 70, max: null };
 * "25 mi" -> { min: 25, max: null }; "n/a" -> { min: null, max: null }.
 *
 * "n/a" is a real authored value, not missing data: race week prescribes
 * no weekly total at all. It is preserved in the label and left numerically
 * null so nothing downstream invents a target for that week.
 */
export function parseGoalMileage(raw: string): {
  label: string;
  min: number | null;
  max: number | null;
} {
  const label = raw.trim();
  if (label === "" ) throw new Error("Goal mileage is empty");
  if (/^n\/?a$/i.test(label)) return { label, min: null, max: null };

  const withoutUnit = label.replace(/\s*mi(les)?\s*$/i, "").trim();
  const parts = withoutUnit.split(RANGE_SEPARATOR).map((p) => p.trim());
  const numbers = parts.map((p) => Number(p));
  if (parts.length > 2 || numbers.some((n) => !Number.isFinite(n) || n <= 0)) {
    throw new Error(`Unparseable goal mileage: ${JSON.stringify(raw)}`);
  }

  const min = numbers[0];
  const max = numbers.length === 2 ? numbers[1] : null;
  if (max != null && max < min) throw new Error(`Goal mileage range runs backwards: ${JSON.stringify(raw)}`);
  return { label, min, max };
}

/** Title Case phase keys, matching the Canyon seed's existing "General"/"Supportive"/"Specific" program_phase_definitions.phase_key values (scripts/seed-canyon-program.ts) rather than introducing a second casing convention. */
export function phaseKeyFor(rawPhaseName: string): string {
  const trimmed = rawPhaseName.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Whole-framework normalization
// ---------------------------------------------------------------------------

const DAYS_PER_WEEK = 7;

/**
 * Turn one verified framework seed file into the full set of rows to write.
 * Throws on any structural surprise (a week with other than seven days, a
 * week claiming a phase the file never declared, a variant missing a goal
 * mileage for some week) rather than writing partial or silently-defaulted
 * methodology content.
 */
export function buildFrameworkSeed(raw: RawFramework): FrameworkSeedPlan {
  const frameworkKey = raw.framework.trim().toLowerCase();
  const name = phaseKeyFor(raw.framework);

  const phases: SeedPhaseDefinition[] = raw.phases.map((phase, index) => {
    const absoluteWeeks = [...phase.weeks].sort((a, b) => a - b);
    if (absoluteWeeks.length === 0) throw new Error(`${frameworkKey}: phase "${phase.name}" declares no weeks`);
    return {
      phaseKey: phaseKeyFor(phase.name),
      position: index + 1,
      // A seeded framework's phases are fixed-length, not a range a coach
      // picks within at assignment time: these 18 weeks are the authored
      // methodology. min = max expresses exactly that, using the same
      // range mechanism program_phase_definitions already has.
      durationWeeksMin: absoluteWeeks.length,
      durationWeeksMax: absoluteWeeks.length,
      notes: null,
      absoluteWeeks,
    };
  });

  const phaseByAbsoluteWeek = new Map<number, { phaseKey: string; weekNumber: number }>();
  for (const phase of phases) {
    phase.absoluteWeeks.forEach((absoluteWeek, indexInPhase) => {
      if (phaseByAbsoluteWeek.has(absoluteWeek)) {
        throw new Error(`${frameworkKey}: week ${absoluteWeek} is claimed by more than one phase`);
      }
      phaseByAbsoluteWeek.set(absoluteWeek, { phaseKey: phase.phaseKey, weekNumber: indexInPhase + 1 });
    });
  }

  const declaredWeeks = phases.reduce((total, phase) => total + phase.absoluteWeeks.length, 0);
  if (declaredWeeks !== raw.duration_weeks || raw.weeks.length !== raw.duration_weeks) {
    throw new Error(
      `${frameworkKey}: duration_weeks is ${raw.duration_weeks} but phases cover ${declaredWeeks} weeks and ${raw.weeks.length} weeks are authored`,
    );
  }

  const volumeVariants: SeedVolumeVariant[] = raw.variants.map((variant, index) => ({
    variantKey: variant.id,
    name: `${variant.peak_mileage} mi/week peak`,
    position: index + 1,
    peakMileage: variant.peak_mileage,
    initialMileage: variant.initial_mileage,
    // Nothing is pre-selected: picking a peak-volume level for a real
    // athlete is exactly the judgment Part D's mileage-match check exists
    // to inform, so the assignment form should make the coach choose
    // rather than quietly defaulting to the lowest or highest.
    isDefault: false,
  }));

  const days: SeedDay[] = [];
  const phaseWeeks: SeedPhaseWeek[] = [];
  const phaseWeekVolumes: SeedPhaseWeekVolume[] = [];

  for (const week of raw.weeks) {
    const placement = phaseByAbsoluteWeek.get(week.week);
    if (!placement) throw new Error(`${frameworkKey}: week ${week.week} belongs to no declared phase`);
    const declaredPhaseKey = phaseKeyFor(week.phase);
    if (declaredPhaseKey !== placement.phaseKey) {
      throw new Error(
        `${frameworkKey}: week ${week.week} says phase "${week.phase}" but the phase list puts it in ${placement.phaseKey}`,
      );
    }

    phaseWeeks.push({
      phaseKey: placement.phaseKey,
      weekNumber: placement.weekNumber,
      notes: week.notes?.trim() ? week.notes.trim() : null,
      reviseFitnessEstimate: week.revise_fitness_estimate === true,
      convertFitnessEstimateToMp: week.convert_fitness_estimate_to_mp === true,
    });

    for (const variant of volumeVariants) {
      const rawGoal = week.goal_mileage[variant.variantKey];
      if (rawGoal == null) {
        throw new Error(`${frameworkKey}: week ${week.week} has no goal mileage for variant ${variant.variantKey}`);
      }
      const goal = parseGoalMileage(rawGoal);
      phaseWeekVolumes.push({
        variantKey: variant.variantKey,
        phaseKey: placement.phaseKey,
        weekNumber: placement.weekNumber,
        goalMileageLabel: goal.label,
        goalMileageMin: goal.min,
        goalMileageMax: goal.max,
      });
    }

    if (week.days.length !== DAYS_PER_WEEK) {
      throw new Error(
        `${frameworkKey}: week ${week.week} has ${week.days.length} days, expected ${DAYS_PER_WEEK} (Monday-first)`,
      );
    }

    week.days.forEach((day, dayIndex) => {
      if (day.sessions.length === 0) {
        throw new Error(`${frameworkKey}: week ${week.week} day ${dayIndex + 1} has no sessions`);
      }
      const seenSlots = new Set<string>();
      for (const session of day.sessions) {
        const slotKey = session.slot === "single" ? "single" : session.slot;
        if (seenSlots.has(slotKey)) {
          throw new Error(`${frameworkKey}: week ${week.week} day ${dayIndex + 1} repeats the ${slotKey} slot`);
        }
        seenSlots.add(slotKey);

        const difficulty = parseDifficulty(session.difficulty);
        days.push({
          phaseKey: placement.phaseKey,
          weekNumber: placement.weekNumber,
          dayOfWeek: dayIndex + 1,
          // "single" is the absence of a slot, stored as NULL so it reads
          // the same as every hand-authored one-session day in this
          // schema; the uniqueness index coalesces NULL back to 'single'.
          sessionSlot: session.slot === "single" ? null : session.slot,
          notes: session.workout,
          isOptional: session.optional === true,
          alternativeText: session.alternatives?.trim() ? session.alternatives.trim() : null,
          difficultyLabel: difficulty.label,
          plannedRpe: difficulty.rpeMin,
          plannedRpeMax: difficulty.rpeMax,
        });
      }
    });
  }

  const peaks = volumeVariants.map((v) => v.peakMileage);
  const initials = volumeVariants.map((v) => v.initialMileage);

  const descriptionParts: string[] = [];
  if (raw.recommended_for) descriptionParts.push(`Recommended for: ${raw.recommended_for.trim()}`);
  if (raw.experience) descriptionParts.push(`Experience: ${raw.experience.trim()}`);
  if (raw.structural_features?.length) {
    descriptionParts.push(
      ["How this framework is built:", ...raw.structural_features.map((feature) => `- ${feature}`)].join("\n"),
    );
  }

  return {
    program: {
      frameworkKey,
      name,
      description: descriptionParts.join("\n\n"),
      eventDistance: raw.distance.trim(),
      sourceReference: raw.source.trim(),
      typicalGoalTimes: raw.typical_goal_times?.trim() ?? null,
      recommendedFor: raw.recommended_for?.trim() ?? null,
      initialMileageMin: Math.min(...initials),
      initialMileageMax: Math.max(...initials),
      peakMileageMin: Math.min(...peaks),
      peakMileageMax: Math.max(...peaks),
      glossaryTerms: null,
    },
    phases,
    durationVariantName: `${raw.duration_weeks}-Week`,
    volumeVariants,
    phaseWeeks,
    phaseWeekVolumes,
    days,
  };
}

// ---------------------------------------------------------------------------
// The 5K Crash Course (Part K) -- a different source shape, same output shape
// ---------------------------------------------------------------------------
//
// crash-course.json is NOT a framework file: it has three levels rather
// than peak-volume variants, four weeks rather than eighteen, one session
// per day stated directly on the day (no `sessions` array), and a
// per-level effort-guideline table instead of pace percentages. Each level
// becomes its own assignable program, because a coach assigns exactly one
// level to one athlete -- they are alternatives, not variants of a shared
// week-by-week prescription the way canyon-40 and canyon-50 are.

export type RawCrashCourseDay = { day: string; workout: string; difficulty: string | null };

export type RawCrashCourseWeek = { week: number; weekly_mileage: string; days: RawCrashCourseDay[] };

export type RawCrashCourseLevel = {
  level: string;
  mileage: string;
  metric_equivalent?: string;
  workout_notes: string;
  weeks: RawCrashCourseWeek[];
  culminating_event: string;
};

export type RawCrashCourse = {
  program: string;
  source: string;
  purpose: string;
  effort_guidelines: { effort: string; feels_like: string }[];
  levels: RawCrashCourseLevel[];
  metric_versions_available?: string[];
};

const CRASH_COURSE_WEEKS = 4;

/**
 * One assignable program per level. The effort-guideline table becomes the
 * program's glossary (the pacing reference Part K item 32 calls for),
 * formatted like the existing Canyon seed's glossary_terms entries
 * ("LR - Long Run") rather than inventing a second convention.
 */
export function buildCrashCourseSeeds(raw: RawCrashCourse): FrameworkSeedPlan[] {
  const glossaryTerms = raw.effort_guidelines.map((g) => `${g.effort} - ${g.feels_like}`);

  return raw.levels.map((level) => {
    if (level.weeks.length !== CRASH_COURSE_WEEKS) {
      throw new Error(`crash course level ${level.level}: ${level.weeks.length} weeks authored, expected ${CRASH_COURSE_WEEKS}`);
    }

    const phaseKey = "Introductory";
    const days: SeedDay[] = [];
    const phaseWeeks: SeedPhaseWeek[] = [];
    const phaseWeekVolumes: SeedPhaseWeekVolume[] = [];
    const weeklyMileages: number[] = [];
    // The level's own declared mileage ("25 mi/wk") names the variant; the
    // real per-week totals supply the numbers.
    const variantKey = `crash-course-${level.level.toLowerCase()}`;

    for (const week of level.weeks) {
      if (week.days.length !== DAYS_PER_WEEK) {
        throw new Error(
          `crash course level ${level.level}: week ${week.week} has ${week.days.length} days, expected ${DAYS_PER_WEEK} (Monday-first)`,
        );
      }

      const goal = parseGoalMileage(week.weekly_mileage);
      if (goal.min == null) throw new Error(`crash course level ${level.level}: week ${week.week} has no numeric weekly mileage`);
      weeklyMileages.push(goal.min);

      phaseWeeks.push({
        phaseKey,
        weekNumber: week.week,
        // The only real per-week commentary in this source is the
        // culminating event, which belongs to the final week. Earlier
        // weeks genuinely have none -- left null rather than padded with
        // invented coaching copy.
        notes: week.week === CRASH_COURSE_WEEKS ? level.culminating_event.trim() : null,
        // The course exists to PRODUCE a first fitness estimate from the
        // week-4 time trial, so the estimate review belongs on that week
        // (Part K item 32 feeds it into Part F).
        reviseFitnessEstimate: week.week === CRASH_COURSE_WEEKS,
        convertFitnessEstimateToMp: false,
      });

      phaseWeekVolumes.push({
        variantKey,
        phaseKey,
        weekNumber: week.week,
        goalMileageLabel: goal.label,
        goalMileageMin: goal.min,
        goalMileageMax: goal.max,
      });

      week.days.forEach((day, dayIndex) => {
        const difficulty = parseDifficulty(day.difficulty);
        days.push({
          phaseKey,
          weekNumber: week.week,
          dayOfWeek: dayIndex + 1,
          sessionSlot: null,
          notes: day.workout,
          isOptional: false,
          alternativeText: null,
          difficultyLabel: difficulty.label,
          plannedRpe: difficulty.rpeMin,
          plannedRpeMax: difficulty.rpeMax,
        });
      });
    }

    return {
      program: {
        frameworkKey: variantKey,
        name: `5K Crash Course - Level ${level.level}`,
        description: [raw.purpose.trim(), `Level ${level.level} (${level.mileage}): ${level.workout_notes.trim()}`].join("\n\n"),
        eventDistance: "5k",
        sourceReference: raw.source.trim(),
        typicalGoalTimes: null,
        // There is no "recommended for" prose per level in this source --
        // the level IS the recommendation (matched to current mileage).
        recommendedFor: `Athletes currently running about ${level.mileage}, with no current 5K fitness estimate.`,
        initialMileageMin: weeklyMileages[0],
        initialMileageMax: weeklyMileages[0],
        peakMileageMin: Math.max(...weeklyMileages),
        peakMileageMax: Math.max(...weeklyMileages),
        glossaryTerms,
      },
      phases: [
        {
          phaseKey,
          position: 1,
          durationWeeksMin: CRASH_COURSE_WEEKS,
          durationWeeksMax: CRASH_COURSE_WEEKS,
          notes: level.workout_notes.trim(),
          absoluteWeeks: [1, 2, 3, 4],
        },
      ],
      durationVariantName: `${CRASH_COURSE_WEEKS}-Week`,
      volumeVariants: [
        {
          variantKey,
          name: level.mileage,
          position: 1,
          peakMileage: Math.max(...weeklyMileages),
          initialMileage: weeklyMileages[0],
          // A level has exactly one volume, so selecting it is not a real
          // choice -- unlike a framework's 40-vs-50 decision.
          isDefault: true,
        },
      ],
      phaseWeeks,
      phaseWeekVolumes,
      days,
    };
  });
}
