"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { logLearningEvent } from "@/app/learning-actions";

export type SaveCalculationResult = {
  status: "success" | "error";
  message?: string;
};

export async function saveCalculation(
  calculatorType: string,
  input: unknown,
  output: unknown,
  label: string,
): Promise<SaveCalculationResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { status: "error", message: "Sign in to save calculator results." };
  }

  const { error } = await supabase.from("saved_calculations").insert({
    user_id: userId,
    calculator_type: calculatorType,
    input_json: input,
    output_json: output,
    label,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  // Saving a result is a deliberate, post-computation action -- a real
  // "tool_used" learning signal, unlike merely opening the calculator page
  // (which fires nothing). calculatorType already equals the matching
  // topic's slug for every calculator (see src/lib/mastery/taxonomy.ts),
  // so no translation is needed. No-ops silently if it isn't (e.g. a
  // calculator not yet seeded as a topic).
  await logLearningEvent(calculatorType, "tool_used");

  revalidatePath("/dashboard");
  return { status: "success" };
}

export async function deleteSavedCalculation(calculationId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;

  await supabase.from("saved_calculations").delete().eq("id", calculationId).eq("user_id", userId);

  revalidatePath("/dashboard");
}
