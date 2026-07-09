import { APICallError, generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { assembleCoachingContext } from "@/lib/ai/context";
import { coachModel } from "@/lib/ai/model";
import { buildAdaptationSystemPrompt, buildRetrievalQuery } from "@/lib/ai/prompts";
import { retrieveRelevantContent } from "@/lib/ai/retrieval";
import { lookupForecastForDate } from "@/lib/ai/weather";
import { sections } from "@/lib/sections";
import { createClient } from "@/lib/db/server";
import {
  adjustForHeat,
  compressWorkout,
  derivePaceZones,
  describePrescription,
  insertRecoveryDay,
  substituteForSurface,
  type WorkoutPrescription,
  type WorkoutType,
} from "@/lib/coaching-engine";

export type ProposedChange = {
  workoutType: WorkoutType;
  before: WorkoutPrescription;
  after: WorkoutPrescription;
};

function describeChange(change: ProposedChange): string {
  return `Here's what I'd change: ${describePrescription(change.after)}`;
}

export async function POST(request: Request) {
  const { workoutId, message } = await request.json().catch(() => ({ workoutId: null, message: null }));
  if (typeof workoutId !== "string" || !workoutId || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Tell your coach what's going on first." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || !userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await assembleCoachingContext(supabase, userId, workoutId);
  if (!context.workout) {
    // RLS silently returns nothing for a workout that doesn't exist or
    // isn't this user's -- same shape either way.
    return Response.json({ error: "Workout not found" }, { status: 404 });
  }

  const currentPrescription = context.workout.prescription;
  const workoutType = context.workout.workoutType;
  const paceZones =
    context.goal?.goalTimeS != null ? derivePaceZones(context.goal.distanceM, context.goal.goalTimeS) : null;

  const retrievalQuery = buildRetrievalQuery(workoutType, context.workout.phase, message);
  const excerpts = retrieveRelevantContent(retrievalQuery, sections, 4);
  const system = buildAdaptationSystemPrompt(context, excerpts);

  let proposedChange: ProposedChange | null = null;

  const tools = {
    compressWorkout: tool({
      description: "Propose a shorter version of today's workout that fits within a limited amount of time.",
      inputSchema: z.object({
        availableMinutes: z.number().positive().describe("How many minutes the athlete has available today"),
      }),
      execute: async ({ availableMinutes }: { availableMinutes: number }) => {
        const result = compressWorkout(currentPrescription, availableMinutes);
        if (!result.ok) return { proposed: false, reason: result.reason };
        proposedChange = { workoutType, before: currentPrescription, after: result.prescription };
        return { proposed: true, newWorkout: describePrescription(result.prescription) };
      },
    }),
    substituteForSurface: tool({
      description: "Get guidance for running today's workout without track access -- doesn't change the workout itself.",
      // A no-argument tool schema confuses smaller models about whether/how
      // to call it -- a trivial required field, unused in execute, matches
      // the other two tools' shape and got this called reliably in testing.
      inputSchema: z.object({
        reason: z.string().describe("Why the athlete doesn't have track access today"),
      }),
      execute: async () => {
        const result = substituteForSurface(currentPrescription);
        if (!result.ok) return { available: false, reason: result.reason };
        return { available: true, guidance: result.guidance };
      },
    }),
    ...(paceZones && {
      insertRecoveryDay: tool({
        description:
          "Replace today's workout with a short, easy recovery effort -- for a missed day, feeling run-down, or anything else that calls for backing off.",
        inputSchema: z.object({
          reason: z.string().describe("Why a recovery day makes sense right now"),
        }),
        execute: async () => {
          const result = insertRecoveryDay(currentPrescription, paceZones);
          if (!result.ok) return { proposed: false, reason: result.reason };
          proposedChange = { workoutType, before: currentPrescription, after: result.prescription };
          return { proposed: true, newWorkout: describePrescription(result.prescription) };
        },
      }),
      adjustForHeat: tool({
        description:
          "Check the forecast for a hot day and, if conditions call for it, adjust today's workout for heat safety.",
        inputSchema: z.object({
          city: z.string().describe("The city the athlete will be running in"),
          region: z.string().optional().describe("State or region, if the athlete mentioned one"),
        }),
        execute: async ({ city, region }: { city: string; region?: string }) => {
          const location = region ? `${city}, ${region}` : city;
          const weather = await lookupForecastForDate(location, context.workout!.scheduledDate);
          if (!weather.ok) return { adjusted: false, reason: weather.reason };

          const result = adjustForHeat(currentPrescription, weather.wbgtC, paceZones);
          if (!result.ok) {
            return {
              adjusted: false,
              reason: result.reason,
              location: weather.locationLabel,
              tempC: Math.round(weather.tempC),
            };
          }
          proposedChange = { workoutType, before: currentPrescription, after: result.prescription };
          return {
            adjusted: true,
            newWorkout: describePrescription(result.prescription),
            location: weather.locationLabel,
            tempC: Math.round(weather.tempC),
          };
        },
      }),
    }),
  };

  const { data: conversation } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title: `Adapt: ${workoutType} on ${context.workout.scheduledDate}` })
    .select("id")
    .single();

  if (conversation) {
    await supabase.from("ai_messages").insert({
      conversation_id: conversation.id,
      user_id: userId,
      role: "user",
      content: message,
    });
  }

  let result;
  try {
    result = await generateText({
      model: coachModel,
      system,
      prompt: message,
      tools,
      stopWhen: stepCountIs(3),
    });
  } catch (err) {
    // A real user-facing failure mode, not just a test-time nuisance --
    // the free tier's rate limit is tight enough to hit from normal usage,
    // and an uncaught throw here would otherwise reach the client as a
    // bare 500 with an empty body, which the client can't even parse as
    // JSON, let alone show a sensible message for.
    const isRateLimited = err instanceof APICallError && err.statusCode === 429;
    return Response.json(
      {
        error: isRateLimited
          ? "Your coach is getting a lot of requests right now -- try again in a minute."
          : "Couldn't reach your coach right now -- try again in a moment.",
      },
      { status: isRateLimited ? 429 : 502 },
    );
  }

  // A smaller model doesn't always wrap a tool call in a closing reply
  // despite being told to -- rather than show the athlete a blank
  // response, fall back to a plain description of whatever the tool
  // actually produced. The tool's own output (not the model's prose) is
  // already the source of truth here, so this fallback is never less
  // accurate than the model's own narration would have been.
  const explanation =
    result.text ||
    (proposedChange
      ? describeChange(proposedChange)
      : "I didn't find a specific change to make here -- try describing what's going on in a bit more detail.");

  if (conversation && explanation) {
    await supabase.from("ai_messages").insert({
      conversation_id: conversation.id,
      user_id: userId,
      role: "assistant",
      content: explanation,
    });
  }

  return Response.json({
    conversationId: conversation?.id ?? null,
    explanation,
    proposedChange,
  });
}
