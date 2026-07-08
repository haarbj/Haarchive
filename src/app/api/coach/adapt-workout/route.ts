import { APICallError, generateText, stepCountIs, tool } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

import { assembleCoachingContext } from "@/lib/ai/context";
import { buildAdaptationSystemPrompt, buildRetrievalQuery } from "@/lib/ai/prompts";
import { retrieveRelevantContent } from "@/lib/ai/retrieval";
import { sections } from "@/lib/sections";
import { createClient } from "@/lib/db/server";
import {
  compressWorkout,
  derivePaceZones,
  describePrescription,
  insertRecoveryDay,
  substituteForSurface,
  type WorkoutPrescription,
  type WorkoutType,
} from "@/lib/coaching-engine";

const MODEL_ID = "gemini-2.5-flash";

export type ProposedChange = {
  workoutType: WorkoutType;
  before: WorkoutPrescription;
  after: WorkoutPrescription;
};

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
      inputSchema: z.object({}),
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
      model: google(MODEL_ID),
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

  if (conversation && result.text) {
    await supabase.from("ai_messages").insert({
      conversation_id: conversation.id,
      user_id: userId,
      role: "assistant",
      content: result.text,
    });
  }

  return Response.json({
    conversationId: conversation?.id ?? null,
    explanation: result.text,
    proposedChange,
  });
}
