"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";

import type { AuthActionState } from "@/app/(app)/auth-actions";

const fieldClass =
  "w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm text-zinc-900 transition focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
const labelClass =
  "mb-1 block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300";

type AuthFormProps = {
  action: (
    state: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  submitLabel: string;
  pendingLabel: string;
  passwordAutoComplete: "current-password" | "new-password";
  passwordMinLength?: number;
  footer: ReactNode;
};

export function AuthForm({
  action,
  submitLabel,
  pendingLabel,
  passwordAutoComplete,
  passwordMinLength,
  footer,
}: AuthFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={passwordAutoComplete}
          minLength={passwordMinLength}
          required
          className={fieldClass}
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="text-sm font-medium text-red-700 dark:text-red-400"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? pendingLabel : submitLabel}
      </button>

      {footer}
    </form>
  );
}
