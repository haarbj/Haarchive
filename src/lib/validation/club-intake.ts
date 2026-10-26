import { z } from "zod";

export const CLUB_INTAKE_WTP_BRACKETS = [
  "under_50",
  "50_75",
  "75_100",
  "100_150",
  "150_200",
  "200_plus",
  "not_interested",
] as const;

export const CLUB_INTAKE_WTP_LABELS: Record<(typeof CLUB_INTAKE_WTP_BRACKETS)[number], string> = {
  under_50: "Under $50",
  "50_75": "$50-75",
  "75_100": "$75-100",
  "100_150": "$100-150",
  "150_200": "$150-200",
  "200_plus": "$200+",
  not_interested: "Not interested at any price",
};

// The readiness gate (Field 1) is enforced in club-intake.ts's own
// checkClubIntakeReadiness, not here -- this schema only validates shape,
// never a coaching judgment. A below-threshold mileage still parses fine;
// the submit action is what branches into the redirected_not_ready path.
export const clubIntakeSubmissionSchema = z
  .object({
    currentWeeklyMileage: z.coerce
      .number()
      .positive("Enter your current weekly mileage.")
      .max(150, "That's a lot of miles -- double check this number."),
    raceName: z.string().trim().max(200).optional(),
    raceDate: z.string().trim().optional(),
    finishTimeS: z.coerce.number().int().positive().optional(),
    plansTimeTrial: z.coerce.boolean().default(false),
    yearsRunning: z.coerce.number().int().min(0).max(80, "Enter a realistic number of years."),
    plansCompleted: z.coerce.number().int().min(0).max(50, "Enter a realistic number.").default(0),
    goalType: z.enum(["finish", "time"]),
    goalTimeS: z.coerce.number().int().positive().optional(),
    injuryHistory: z.string().trim().max(2000).optional(),
    schoolEmail: z.string().trim().toLowerCase().email("Enter a valid email address.").optional().or(z.literal("")),
    interested1on1: z.coerce.boolean().default(false),
    wtpBracket: z.enum(CLUB_INTAKE_WTP_BRACKETS).optional(),
    agreementLogHonestly: z.coerce.boolean().default(false),
    agreementSayIfWrong: z.coerce.boolean().default(false),
    agreementRunPrescribedPaces: z.coerce.boolean().default(false),
    agreementReadTheWhy: z.coerce.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.goalType === "time" && !data.goalTimeS) {
      ctx.addIssue({ code: "custom", path: ["goalTimeS"], message: "Enter your goal time." });
    }
    // The sincerity filter is paid-only (Field 7) -- it is required
    // precisely and only when 1-on-1 interest is expressed, never for a
    // free-Club-Plan-only submission, which has no filter at all.
    if (
      data.interested1on1 &&
      (!data.agreementLogHonestly || !data.agreementSayIfWrong || !data.agreementRunPrescribedPaces || !data.agreementReadTheWhy)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["agreementLogHonestly"],
        message: "All four coaching-agreement boxes must be checked to express 1-on-1 interest.",
      });
    }
  });

export type ClubIntakeSubmissionInput = z.infer<typeof clubIntakeSubmissionSchema>;
