import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { GeneratePlanForm } from "./generate-plan-form";

export const metadata: Metadata = {
  title: "Generate Your Training Plan",
};

export default async function NewPlanPage() {
  // Team-connected athletes get their schedule from their coach, not
  // self-generated -- this route is fully blocked for them, not just
  // hidden, since generating one here would collide with their coach's
  // group plan (and there's nothing for it to attach to: no season/group
  // context to associate it with).
  const session = await getAppSession();
  if (session?.teamId) redirect("/plan");

  const supabase = await createClient();

  const [{ data: goal }, { data: existingPlan }, { data: athleteProfile }] = await Promise.all([
    supabase
      .from("goals")
      .select("id, race_name, distance_m, goal_time_s, goal_date")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("training_plans").select("id").in("status", ["draft", "active"]).maybeSingle(),
    supabase
      .from("athlete_profiles")
      .select("current_weekly_mileage, running_days_per_week")
      .maybeSingle(),
  ]);

  if (existingPlan) {
    redirect("/plan");
  }
  if (!goal || !goal.goal_time_s || !goal.goal_date) {
    redirect("/dashboard");
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-16 animate-fade-in">
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        Generate your training plan
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        For <span className="font-semibold text-zinc-900 dark:text-white">{goal.race_name}</span>.
        Two numbers, and the plan is yours.
      </p>

      <div className="mt-10">
        <GeneratePlanForm
          defaultCurrentWeeklyMileage={athleteProfile?.current_weekly_mileage ?? undefined}
          defaultDaysPerWeek={athleteProfile?.running_days_per_week ?? undefined}
        />
      </div>
    </section>
  );
}
