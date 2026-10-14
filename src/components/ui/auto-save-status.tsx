import { FormError } from "@/components/ui/form-error";

type AutoSaveStatusProps = {
  isPending: boolean;
  error?: string;
  success?: boolean;
};

// Replaces the "Save changes" button + inline "Saved."/error text pattern
// for every form converted to useAutoSaveForm -- there's no button click
// to react to anymore, so this status line is the only signal a person
// gets that anything actually happened. Shown small and quiet (not a
// toast) since it appears after nearly every field edit, not just once
// per intentional submit.
export function AutoSaveStatus({ isPending, error, success }: AutoSaveStatusProps) {
  if (error) return <FormError>{error}</FormError>;
  if (isPending) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Saving…</p>;
  if (success) {
    return (
      <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
        Saved
      </p>
    );
  }
  return null;
}
