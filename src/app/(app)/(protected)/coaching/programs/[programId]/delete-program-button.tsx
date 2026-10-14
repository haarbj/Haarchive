"use client";

import { useRouter } from "next/navigation";

import { deleteProgram } from "../actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DeleteProgramButton({ programId, programName }: { programId: string; programName: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      action={() =>
        deleteProgram(programId).then((result) => {
          if (!result.error) router.push("/coaching/programs");
          return result;
        })
      }
      confirmMessage={`Delete the "${programName}" program? Athletes already assigned training from it keep their generated schedule untouched -- only this reusable program itself goes away.`}
      label="Delete program"
      pendingLabel="Deleting…"
      className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
    />
  );
}
