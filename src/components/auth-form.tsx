"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";

import type { AuthActionState } from "@/app/(app)/auth-actions";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";

const fieldClass = `w-full ${baseFieldClass}`;

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
  defaultEmail?: string;
  emailReadOnly?: boolean;
};

export function AuthForm({
  action,
  submitLabel,
  pendingLabel,
  passwordAutoComplete,
  passwordMinLength,
  footer,
  defaultEmail,
  emailReadOnly,
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
          defaultValue={defaultEmail}
          readOnly={emailReadOnly}
          className={`${fieldClass} ${emailReadOnly ? "opacity-70" : ""}`}
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
