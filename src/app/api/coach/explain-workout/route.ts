import { streamText } from "ai";
import { google } from "@ai-sdk/google";

import { assembleCoachingContext } from "@/lib/ai/context";
import { buildRetrievalQuery, buildSystemPrompt, EXPLAIN_WORKOUT_PROMPT } from "@/lib/ai/prompts";
import { retrieveRelevantContent } from "@/lib/ai/retrieval";
import { sections } from "@/lib/sections";
import { createClient } from "@/lib/db/server";

const MODEL_ID = "gemini-2.5-flash";

export async function POST(request: Request) {
  const { workoutId } = await request.json().catch(() => ({ workoutId: null }));
  if (typeof workoutId !== "string" || !workoutId) {
    return new Response("Missing workoutId", { status: 400 });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || !userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const context = await assembleCoachingContext(supabase, userId, workoutId);
  if (!context.workout) {
    // RLS silently returns nothing for a workout that doesn't exist or
    // isn't this user's -- same shape either way, so a generic 404 here
    // never leaks which case it was.
    return new Response("Workout not found", { status: 404 });
  }

  const retrievalQuery = buildRetrievalQuery(context.workout.workoutType, context.workout.phase);
  const excerpts = retrieveRelevantContent(retrievalQuery, sections, 4);
  const system = buildSystemPrompt(context, excerpts);

  const { data: conversation } = await supabase
    .from("ai_conversations")
    .insert({
      user_id: userId,
      title: `Why: ${context.workout.workoutType} on ${context.workout.scheduledDate}`,
    })
    .select("id")
    .single();

  if (conversation) {
    await supabase.from("ai_messages").insert({
      conversation_id: conversation.id,
      user_id: userId,
      role: "user",
      content: EXPLAIN_WORKOUT_PROMPT,
    });
  }

  const result = streamText({
    model: google(MODEL_ID),
    system,
    prompt: EXPLAIN_WORKOUT_PROMPT,
    // Without this, a mid-stream provider error (e.g. a rate limit) is
    // swallowed silently by toTextStreamResponse() rather than surfaced --
    // this at least gets it logged server-side instead of vanishing.
    onError: ({ error }) => console.error("explain-workout stream error:", error),
  });

  // Persisting the assistant's final text is the client's job (see
  // logExplanation in actions.ts), called once it finishes reading this
  // stream. Tried doing it server-side first (after() + onEnd/onFinish),
  // but neither streamText's completion callbacks nor after() itself
  // reliably fired in this setup, and chasing exactly why in dev mode
  // wasn't worth it next to a client round-trip that's simple, visible,
  // and fully within this app's own control either way.
  return result.toTextStreamResponse({
    headers: conversation ? { "X-Conversation-Id": conversation.id } : undefined,
  });
}
