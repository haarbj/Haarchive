"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";

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

  revalidatePath("/dashboard");
  return { status: "success" };
}
