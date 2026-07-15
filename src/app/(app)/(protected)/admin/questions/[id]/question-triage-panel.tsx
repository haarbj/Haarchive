"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  archiveQuestion,
  deleteQuestion,
  generateContentSuggestion,
  mergeQuestions,
  updateQuestion,
  type ContentSuggestion,
} from "@/app/(app)/(protected)/admin/questions/actions";
import { searchExistingQuestions, type QuestionSearchResult } from "@/app/questions/actions";
import { LinkedSectionPicker } from "@/app/(app)/(protected)/admin/questions/[id]/linked-section-picker";
import { AssignmentPanel } from "@/app/(app)/(protected)/admin/questions/[id]/assignment-panel";
import type { BasicUser } from "@/lib/admin/users";
import { categories } from "@/lib/sections";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { STATUS_LABELS, STATUS_ORDER, type Question } from "@/lib/questions/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function isContentSuggestion(value: unknown): value is ContentSuggestion {
  return !!value && typeof value === "object" && "draftBody" in (value as object);
}

export function QuestionTriagePanel({ question, users }: { question: Question; users: BasicUser[] }) {
  return (
    <div className="mt-10 space-y-10">
      {/* Keyed on updatedAt so a write from a sibling panel (e.g.
          "Use as public response") remounts this form with the fresh row
          instead of leaving its already-initialized controlled state
          stale -- see assignment-panel.tsx's promoteDraftAnswer call. */}
      <EditForm question={question} key={question.updatedAt} />
      <AssignmentPanel
        questionId={question.id}
        assignedTo={question.assignedTo}
        assignedReviewer={question.assignedReviewer}
        draftAnswer={question.draftAnswer}
        users={users}
      />
      <AiAssistPanel questionId={question.id} initialSuggestion={question.aiSuggestion} />
      <MergePanel questionId={question.id} />
      <DangerZone questionId={question.id} />
    </div>
  );
}

type EditableFields = {
  title: string;
  description: string;
  category: string;
  status: Question["status"];
  tagsInput: string;
  linkedSectionSlug: string;
  adminResponse: string;
  isFaq: boolean;
  adminNotes: string;
};

function fieldsFromQuestion(question: Question): EditableFields {
  return {
    title: question.title,
    description: question.description ?? "",
    category: question.category ?? "",
    status: question.status,
    tagsInput: question.tags.join(", "),
    linkedSectionSlug: question.linkedSectionSlug ?? "",
    adminResponse: question.adminResponse ?? "",
    isFaq: question.isFaq,
    adminNotes: question.adminNotes ?? "",
  };
}

function EditForm({ question }: { question: Question }) {
  const [state, formAction, isPending] = useActionState(updateQuestion, {});
  // Controlled instead of defaultValue/uncontrolled: React resets
  // uncontrolled form fields to their defaultValue once a form action
  // finishes running, whether it succeeded or returned an error -- that's
  // invisible on success (the refreshed `question` prop already matches
  // what was just typed), but on a validation failure it silently
  // discarded everything the user had entered. Owning the values here
  // means a failed action leaves this state, and the screen, untouched.
  const [fields, setFields] = useState<EditableFields>(() => fieldsFromQuestion(question));

  function setField<K extends keyof EditableFields>(field: K, value: EditableFields[K]) {
    setFields((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <Card as="form" action={formAction} padding="md" className="space-y-5">
      <input type="hidden" name="questionId" value={question.id} />
      <p className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Edit</p>

      <div>
        <label htmlFor="title" className={labelClass}>Title</label>
        <input
          id="title"
          name="title"
          value={fields.title}
          onChange={(e) => setField("title", e.target.value)}
          className={`${fieldClass} w-full`}
        />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Description</label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={fields.description}
          onChange={(e) => setField("description", e.target.value)}
          className={`${fieldClass} w-full`}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelClass}>Category</label>
          <select
            id="category"
            name="category"
            value={fields.category}
            onChange={(e) => setField("category", e.target.value)}
            className={`${fieldClass} w-full`}
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className={labelClass}>Status</label>
          <select
            id="status"
            name="status"
            value={fields.status}
            onChange={(e) => setField("status", e.target.value as Question["status"])}
            className={`${fieldClass} w-full`}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="tagsInput" className={labelClass}>Tags (comma-separated)</label>
        <input
          id="tagsInput"
          name="tagsInput"
          value={fields.tagsInput}
          onChange={(e) => setField("tagsInput", e.target.value)}
          className={`${fieldClass} w-full`}
        />
      </div>

      <LinkedSectionPicker
        value={fields.linkedSectionSlug}
        onChange={(next) => setField("linkedSectionSlug", next)}
      />

      <div>
        <label htmlFor="adminResponse" className={labelClass}>
          Public response (shown when Answered or added to the FAQ)
        </label>
        <textarea
          id="adminResponse"
          name="adminResponse"
          rows={3}
          value={fields.adminResponse}
          onChange={(e) => setField("adminResponse", e.target.value)}
          className={`${fieldClass} w-full`}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          name="isFaq"
          value="true"
          checked={fields.isFaq}
          onChange={(e) => setField("isFaq", e.target.checked)}
          className="accent-zinc-900 dark:accent-white"
        />
        Add to FAQ
      </label>

      <div>
        <label htmlFor="adminNotes" className={labelClass}>Private editorial notes</label>
        <textarea
          id="adminNotes"
          name="adminNotes"
          rows={3}
          value={fields.adminNotes}
          onChange={(e) => setField("adminNotes", e.target.value)}
          className={`${fieldClass} w-full`}
        />
      </div>

      {state.error ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </Card>
  );
}

function AiAssistPanel({
  questionId,
  initialSuggestion,
}: {
  questionId: string;
  initialSuggestion: unknown;
}) {
  const [suggestion, setSuggestion] = useState<ContentSuggestion | null>(
    isContentSuggestion(initialSuggestion) ? initialSuggestion : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"expand" | "new_article" | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate(nextMode: "expand" | "new_article") {
    setMode(nextMode);
    setError(null);
    startTransition(async () => {
      const result = await generateContentSuggestion(questionId, nextMode);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSuggestion(result.suggestion);
    });
  }

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-6 dark:border-violet-400/30 dark:bg-violet-400/5">
      <p className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-white">AI Assist</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Generates a draft and placement suggestion, not a finished article — this is a starting point to
        revise, since the site’s content lives in a hand-authored file rather than a CMS.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => generate("expand")} disabled={isPending}>
          {isPending && mode === "expand" ? "Generating…" : "Expand Existing Article"}
        </Button>
        <Button type="button" variant="outline" onClick={() => generate("new_article")} disabled={isPending}>
          {isPending && mode === "new_article" ? "Generating…" : "Create New Article"}
        </Button>
        {suggestion ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => mode && generate(mode)}
            disabled={isPending || !mode}
            className="underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:decoration-white/30"
          >
            Regenerate
          </Button>
        ) : null}
      </div>

      {error ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p> : null}

      {suggestion ? (
        <Card padding="sm" className="mt-5 space-y-4">
          <SuggestionField label="Suggested title" value={suggestion.suggestedTitle} />
          <SuggestionField label="Category" value={suggestion.category} />
          <SuggestionListField label="Outline" items={suggestion.outline} />
          <SuggestionListField label="Related pages" items={suggestion.relatedPages} />
          <SuggestionListField label="Internal link suggestions" items={suggestion.internalLinkSuggestions} />
          <SuggestionField label="Draft" value={suggestion.draftBody} multiline />
        </Card>
      ) : null}
    </div>
  );
}

function SuggestionField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{label}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className={`mt-1 text-sm leading-6 text-zinc-800 dark:text-zinc-200 ${multiline ? "whitespace-pre-wrap" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function SuggestionListField({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{label}</p>
      <ul className="mt-1 space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
        {items.map((item, i) => (
          <li key={i}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function MergePanel({ questionId }: { questionId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuestionSearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function search(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const data = await searchExistingQuestions(value);
      setResults(data.filter((r) => r.id !== questionId));
    });
  }

  function merge(targetId: string) {
    startTransition(async () => {
      const result = await mergeQuestions(questionId, targetId);
      setMessage("error" in result ? result.error! : "Merged. This question is now archived and points at the target.");
    });
  }

  return (
    <Card padding="md" shadow={false}>
      <p className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        Merge into another question
      </p>
      <input
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Search for the question to merge into…"
        className={`${fieldClass} mt-3 w-full`}
      />
      {results.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
              <span className="text-zinc-800 dark:text-zinc-200">{r.title}</span>
              <Button type="button" size="sm" disabled={isPending} onClick={() => merge(r.id)} className="shrink-0">
                Merge into this
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}
    </Card>
  );
}

function DangerZone({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function archive() {
    startTransition(async () => {
      const result = await archiveQuestion(questionId);
      if ("error" in result && result.error) setError(result.error);
      else router.push("/admin/questions");
    });
  }

  function remove() {
    if (!window.confirm("Permanently delete this question? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteQuestion(questionId);
      if ("error" in result && result.error) setError(result.error);
      else router.push("/admin/questions");
    });
  }

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 dark:border-red-400/20 dark:bg-red-400/5">
      <p className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Danger zone</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={isPending} onClick={archive}>
          Archive
        </Button>
        <Button type="button" variant="danger" disabled={isPending} onClick={remove}>
          Delete (spam)
        </Button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
