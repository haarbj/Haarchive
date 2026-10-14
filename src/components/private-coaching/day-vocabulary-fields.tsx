"use client";

import { SUGGESTED_DAY_LABELS, SUGGESTED_XT_TYPES, splitDayLabel, isXtLabel } from "@/lib/private-coaching/day-type-visuals";
import { PACE_REFERENCE_KEYS, PACE_REFERENCE_LABELS, type PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import { fieldClass, labelClass } from "@/lib/form-styles";

const SESSION_SLOTS = ["AM", "PM"];

// A low-profile mode switch for Volume/Pace's Fixed <-> alternate-vocabulary
// toggles -- same "secondary text link" visual weight as QuickCreatePanel's
// own "+ Add structured steps" affordance elsewhere in this flow, not a
// bordered button pair. The point: the common case (a plain distance/pace
// number) reaches its input field immediately, with the advanced vocabulary
// (% of week, a named pace reference) available one click away but never
// competing for attention as its own section header + toggle row.
const secondaryLinkClass =
  "text-xs font-semibold whitespace-nowrap text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white";

// Shared between QuickCreatePanel, the full WorkoutForm, and workout
// templates (coaching/templates/template-form.tsx) -- all three need the
// exact same day_label/session_slot/target controls, just embedded in a
// different surrounding form (lives here, not under the schedule route,
// for the same reason StepsEditor does). day_label is free text with a
// <datalist> of suggestions (see day-type-visuals.ts), never a closed
// enum -- real coaching vocabulary isn't a closed set, and this is never
// translated into or compared against workoutType.
//
// Distance, duration, pace, heart rate, and RPE are Data & Analytics'
// "Three Layers of Measurement" made concrete: external workload
// (distance/duration/pace), physiological response (heart rate), and
// perceived effort (RPE) -- none alone tells the whole story, so a coach
// can lean on whichever combination fits the session, and only one of the
// five is ever required. Distance, duration, and pace stay mathematically
// consistent as any two are filled in (see use-workout-target-fields.ts's
// autoCompleteWorkoutTargets wiring); heart rate and RPE are independent
// alongside them.
//
// Extras live in their own ExtrasEditor now, not here -- they outgrew a
// flat tag list (a coach needs to attach real detail: how many strides
// and their distance, a drill circuit's overview and named items) and can
// be saved to/loaded from the coach's own library, which needs more room
// than a checkbox row.
export function DayVocabularyFields({
  dayLabel,
  onDayLabelChange,
  sessionSlot,
  onSessionSlotChange,
  distanceMinInput,
  onDistanceMinChange,
  distanceMaxInput,
  onDistanceMaxChange,
  durationMinInput,
  onDurationMinChange,
  durationMaxInput,
  onDurationMaxChange,
  paceMinInput,
  onPaceMinChange,
  paceMaxInput,
  onPaceMaxChange,
  paceReference,
  onPaceReferenceChange,
  volumePercentInput,
  onVolumePercentChange,
  hrMinInput,
  onHrMinChange,
  hrMaxInput,
  onHrMaxChange,
  rpeMinInput,
  onRpeMinChange,
  rpeMaxInput,
  onRpeMaxChange,
  allowPacePercent = false,
  pacePercentBasis = null,
  onPacePercentBasisChange,
  pacePercentMinInput = "",
  onPacePercentMinChange,
  pacePercentMaxInput = "",
  onPacePercentMaxChange,
}: {
  dayLabel: string;
  onDayLabelChange: (value: string) => void;
  sessionSlot: string | null;
  onSessionSlotChange: (value: string | null) => void;
  distanceMinInput: string;
  onDistanceMinChange: (value: string) => void;
  distanceMaxInput: string;
  onDistanceMaxChange: (value: string) => void;
  // A coach who prescribes by time ("45-60 min easy") rather than distance
  // needs an equally direct top-level field -- distance, duration, and
  // pace are linked (entering any two fills in the third), and a coach
  // fills in whichever apply, same as how a single step already lets
  // distance and duration coexist.
  durationMinInput: string;
  onDurationMinChange: (value: string) => void;
  durationMaxInput: string;
  onDurationMaxChange: (value: string) => void;
  paceMinInput: string;
  onPaceMinChange: (value: string) => void;
  paceMaxInput: string;
  onPaceMaxChange: (value: string) => void;
  // A coach picks a NAMED pace ("Threshold Pace") instead of typing one,
  // resolved live from the athlete's own most recent race -- see
  // pace-reference.ts. Mutually exclusive with paceMinInput/paceMaxInput;
  // non-null here means those two inputs are hidden in favor of the
  // reference <select> below.
  paceReference: PaceReferenceKey | null;
  onPaceReferenceChange: (value: PaceReferenceKey | null) => void;
  // A coach expresses this day's volume as a percent of that week's own
  // target ("20% of the week") instead of a fixed distance/duration --
  // resolved live from that week's own training_week_plans target, see
  // volume-reference.ts. Mutually exclusive with distance/duration
  // (non-empty here means those inputs are hidden in favor of this single
  // percent field, since which figure it resolves to depends on the
  // week's own unit, not a per-field choice).
  volumePercentInput: string;
  onVolumePercentChange: (value: string) => void;
  hrMinInput: string;
  onHrMinChange: (value: string) => void;
  hrMaxInput: string;
  onHrMaxChange: (value: string) => void;
  rpeMinInput: string;
  onRpeMinChange: (value: string) => void;
  rpeMaxInput: string;
  onRpeMaxChange: (value: string) => void;
  // Opt-in third pace-entry mode: "% of a reference pace" (e.g. Canyon's
  // "50-60% 5K pace"). Used by ProgramDayForm (program_days) and WorkoutForm
  // (scheduled_workouts, since coaching-platform-audit/01 §5.1's day-level
  // fix) -- QuickCreatePanel and TemplateForm leave this off, since
  // workout_templates has no matching day-level columns at all. Mutually
  // exclusive with both the fixed pace inputs and paceReference, same
  // "one mode at a time" pattern those two already follow.
  allowPacePercent?: boolean;
  pacePercentBasis?: PaceReferenceKey | null;
  onPacePercentBasisChange?: (value: PaceReferenceKey | null) => void;
  pacePercentMinInput?: string;
  onPacePercentMinChange?: (value: string) => void;
  pacePercentMaxInput?: string;
  onPacePercentMaxChange?: (value: string) => void;
}) {
  // "XT"/"Cross Training" alone doesn't say what an athlete should
  // actually do -- pool, bike, and elliptical are entirely different
  // sessions. Composing the modality into the label itself ("Cross
  // Training (Bike)") keeps day_label a single free-text field (no schema
  // change) while still letting a coach pick one; splitDayLabel parses it
  // back apart so re-opening an existing "Cross Training (Bike)" workout
  // shows both the base label and the selected modality correctly, not a
  // broken match. Recognizes both the full suggested name and the bare
  // "XT" a coach may have typed directly (or that predates the datalist
  // spelling this out in full).
  const { base, detail } = splitDayLabel(dayLabel);
  const isXt = isXtLabel(base);

  function handleXtTypeChange(xtType: string) {
    onDayLabelChange(xtType ? `${base || "Cross Training"} (${xtType})` : base || "Cross Training");
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Day label</span>
          <input
            list="day-label-suggestions"
            value={dayLabel}
            onChange={(e) => onDayLabelChange(e.target.value)}
            placeholder="Easy, Medium Long Run, Threshold…"
            className={fieldClass}
          />
          <datalist id="day-label-suggestions">
            {SUGGESTED_DAY_LABELS.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </label>
        <div>
          <span className={labelClass}>Session</span>
          <div className="mt-1 flex gap-2">
            {SESSION_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onSessionSlotChange(sessionSlot === slot ? null : slot)}
                aria-pressed={sessionSlot === slot}
                className={`rounded-control border px-3 py-1.5 text-sm font-medium ${
                  sessionSlot === slot
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                    : "border-black/10 text-zinc-600 hover:border-black/20 dark:border-white/10 dark:text-zinc-300 dark:hover:border-white/20"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isXt ? (
        <label className="block max-w-xs">
          <span className={labelClass}>Cross-training type</span>
          <input
            list="xt-type-suggestions"
            value={detail}
            onChange={(e) => handleXtTypeChange(e.target.value)}
            placeholder="Pool, Bike, Elliptical…"
            className={fieldClass}
          />
          <datalist id="xt-type-suggestions">
            {SUGGESTED_XT_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </label>
      ) : null}

      <div>
        {volumePercentInput.trim() ? (
          <label className="block max-w-xs">
            <div className="flex items-center justify-between gap-2">
              <span className={labelClass}>Percent of the week&rsquo;s target</span>
              <button type="button" onClick={() => onVolumePercentChange("")} className={secondaryLinkClass}>
                use a fixed number instead
              </button>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={volumePercentInput}
                onChange={(e) => onVolumePercentChange(e.target.value)}
                placeholder="20"
                className={fieldClass}
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">%</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Resolves live from that week&rsquo;s own target volume -- whichever unit the week is set in (miles or minutes).
            </p>
          </label>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Distance, duration, and pace stay in sync -- fill in any two and the third fills itself in. Only one of
                the five fields below is ever required.
              </p>
              <button type="button" onClick={() => onVolumePercentChange("20")} className={`${secondaryLinkClass} shrink-0`}>
                use % of week instead
              </button>
            </div>
            {/* Both cells stay plain, single-line labels -- the toggle above
                used to live inside the "Distance (mi)" cell only, giving it
                a taller label row than its "to (mi)" sibling and leaving
                the two inputs at different heights within the same grid
                row. */}
            <div className="mt-1.5 grid grid-cols-1 gap-3 xs:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Distance (mi)</span>
                <input
                  value={distanceMinInput}
                  onChange={(e) => onDistanceMinChange(e.target.value)}
                  className={fieldClass}
                />
              </label>
              {distanceMinInput.trim() ? (
                <label className="block">
                  <span className={labelClass}>to (mi), optional</span>
                  <input value={distanceMaxInput} onChange={(e) => onDistanceMaxChange(e.target.value)} className={fieldClass} />
                </label>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 xs:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Duration (min)</span>
                <input
                  value={durationMinInput}
                  onChange={(e) => onDurationMinChange(e.target.value)}
                  className={fieldClass}
                />
              </label>
              {durationMinInput.trim() ? (
                <label className="block">
                  <span className={labelClass}>to (min), optional</span>
                  <input value={durationMaxInput} onChange={(e) => onDurationMaxChange(e.target.value)} className={fieldClass} />
                </label>
              ) : null}
            </div>
          </>
        )}

        <div className="mt-3">
          {pacePercentBasis ? (
            <div className="max-w-sm">
              <div className="flex items-center justify-between gap-2">
                <span className={labelClass}>Percent of a reference pace</span>
                <button type="button" onClick={() => onPacePercentBasisChange?.(null)} className={secondaryLinkClass}>
                  use a fixed pace instead
                </button>
              </div>
              <select
                value={pacePercentBasis}
                onChange={(e) => onPacePercentBasisChange?.(e.target.value as PaceReferenceKey)}
                className={`${fieldClass} mt-1`}
              >
                {PACE_REFERENCE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PACE_REFERENCE_LABELS[key]}
                  </option>
                ))}
              </select>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Low %</span>
                  <input
                    value={pacePercentMinInput}
                    onChange={(e) => onPacePercentMinChange?.(e.target.value)}
                    placeholder="50"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>High %</span>
                  <input
                    value={pacePercentMaxInput}
                    onChange={(e) => onPacePercentMaxChange?.(e.target.value)}
                    placeholder="60"
                    className={fieldClass}
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Resolves against the athlete&rsquo;s own {PACE_REFERENCE_LABELS[pacePercentBasis]} at assignment time.
              </p>
            </div>
          ) : paceReference ? (
            <label className="block max-w-xs">
              <div className="flex items-center justify-between gap-2">
                <span className={labelClass}>Pace</span>
                <div className="flex shrink-0 items-center gap-2">
                  {allowPacePercent ? (
                    <button type="button" onClick={() => onPacePercentBasisChange?.(PACE_REFERENCE_KEYS[0])} className={secondaryLinkClass}>
                      % of pace
                    </button>
                  ) : null}
                  <button type="button" onClick={() => onPaceReferenceChange(null)} className={secondaryLinkClass}>
                    use a fixed pace instead
                  </button>
                </div>
              </div>
              <select
                value={paceReference}
                onChange={(e) => onPaceReferenceChange(e.target.value as PaceReferenceKey)}
                className={`${fieldClass} mt-1`}
              >
                {PACE_REFERENCE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PACE_REFERENCE_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
              <label className="block">
                <div className="flex items-center justify-between gap-2">
                  <span className={labelClass}>Pace (min/mi)</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {allowPacePercent ? (
                      <button
                        type="button"
                        onClick={() => onPacePercentBasisChange?.(PACE_REFERENCE_KEYS[0])}
                        className={secondaryLinkClass}
                      >
                        % of pace
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onPaceReferenceChange(PACE_REFERENCE_KEYS[0])}
                      className={secondaryLinkClass}
                    >
                      use a named reference instead
                    </button>
                  </div>
                </div>
                <input value={paceMinInput} onChange={(e) => onPaceMinChange(e.target.value)} placeholder="7:30" className={fieldClass} />
              </label>
              {paceMinInput.trim() ? (
                <label className="block">
                  <span className={labelClass}>to (min/mi), optional</span>
                  <input
                    value={paceMaxInput}
                    onChange={(e) => onPaceMaxChange(e.target.value)}
                    placeholder="8:00"
                    className={fieldClass}
                  />
                </label>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Heart rate and RPE are independent of the above -- a coach may prescribe either instead of pace, or alongside it.
        </p>
        <div className="mt-1.5 grid grid-cols-1 gap-3 xs:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Heart rate (bpm)</span>
            <input value={hrMinInput} onChange={(e) => onHrMinChange(e.target.value)} className={fieldClass} />
          </label>
          {hrMinInput.trim() ? (
            <label className="block">
              <span className={labelClass}>to (bpm), optional</span>
              <input value={hrMaxInput} onChange={(e) => onHrMaxChange(e.target.value)} className={fieldClass} />
            </label>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 xs:grid-cols-2">
          <label className="block">
            <span className={labelClass}>RPE (1-10)</span>
            <input
              type="number"
              min={1}
              max={10}
              value={rpeMinInput}
              onChange={(e) => onRpeMinChange(e.target.value)}
              className={fieldClass}
            />
          </label>
          {rpeMinInput.trim() ? (
            <label className="block">
              <span className={labelClass}>to (1-10), optional</span>
              <input
                type="number"
                min={1}
                max={10}
                value={rpeMaxInput}
                onChange={(e) => onRpeMaxChange(e.target.value)}
                className={fieldClass}
              />
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}
