import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { mostRecentCompletedMonday } from "@/lib/week";
import { addDays } from "@/lib/coaching-engine";
import { formatDate } from "@/lib/format";
import { CheckinForm, type ExistingCheckin } from "./checkin-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Weekly Check-in",
  robots: { index: false, follow: false },
};

type CheckinRow = {
  overall_feel: number | null;
  fatigue: number;
  soreness: number;
  sleep_quality: number;
  stress: number;
  pain: boolean;
  pain_notes: string | null;
  biggest_positive: string | null;
  biggest_concern: string | null;
  schedule_constraints: string | null;
  notes: string | null;
};

export default async function CoachingCheckinPage() {
  const session = await getAppSession();
  if (!session?.isCoachedAthlete) redirect("/coaching");

  // The week just completed, not the one still in progress -- an athlete
  // shouldn't be able to report on training they haven't finished yet.
  const weekStart = mostRecentCompletedMonday(new Date());
  const weekEnd = addDays(weekStart, 6);

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("weekly_checkins")
    .select("overall_feel, fatigue, soreness, sleep_quality, stress, pain, pain_notes, biggest_positive, biggest_concern, schedule_constraints, notes")
    .eq("user_id", session.userId)
    .eq("week_start", weekStart)
    .maybeSingle<CheckinRow>();

  const existing: ExistingCheckin | null = row
    ? {
        overallFeel: row.overall_feel ?? 3,
        fatigue: row.fatigue,
        soreness: row.soreness,
        sleepQuality: row.sleep_quality,
        stress: row.stress,
        pain: row.pain,
        painNotes: row.pain_notes,
        biggestPositive: row.biggest_positive,
        biggestConcern: row.biggest_concern,
        scheduleConstraints: row.schedule_constraints,
        notes: row.notes,
      }
    : null;

  return (
    <Container variant="narrow">
      <BackLink href="/coaching">My Coaching</BackLink>
      <Heading>Weekly Check-in</Heading>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Week of {formatDate(weekStart)} – {formatDate(weekEnd)}
      </p>
      <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        A quick pulse check for your coach -- takes under a minute.
      </p>
      <div className="mt-8">
        <CheckinForm existing={existing} />
      </div>
    </Container>
  );
}
