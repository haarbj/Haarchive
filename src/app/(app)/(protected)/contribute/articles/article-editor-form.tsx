"use client";

import { useActionState, useId, useState } from "react";

import type { ContentBlock } from "@/lib/sections";
import { ARTICLE_TYPES, ARTICLE_TYPE_LABELS, EVIDENCE_CATEGORIES, EVIDENCE_CATEGORY_LABELS } from "@/lib/articles/constants";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { createArticleDraft, updateArticleDraft, type ArticleDraftState } from "./actions";
import { ContentBlockEditor } from "./content-block-editor";
import { CitationsEditor, type CitationDraft } from "./citations-editor";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ImageUrlField } from "@/components/ui/image-url-field";

const fieldClass = `w-full ${baseFieldClass}`;

export type ArticleEditorInitial = {
  title: string;
  subtitle: string;
  articleType: string;
  evidenceCategory: string;
  tagsInput: string;
  coverImageUrl: string;
  content: ContentBlock[];
  citations: CitationDraft[];
};

type Props =
  | { mode: "create"; articleId?: undefined; initial: ArticleEditorInitial }
  | { mode: "edit"; articleId: string; initial: ArticleEditorInitial };

export function ArticleEditorForm({ mode, articleId, initial }: Props) {
  const baseId = useId();
  const action = mode === "create" ? createArticleDraft : updateArticleDraft;
  const [state, formAction, isPending] = useActionState<ArticleDraftState, FormData>(action, {});
  const [content, setContent] = useState<ContentBlock[]>(initial.content);
  const [citations, setCitations] = useState<CitationDraft[]>(initial.citations);
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl);

  return (
    <form action={formAction} className="space-y-8">
      {mode === "edit" ? <input type="hidden" name="articleId" value={articleId} /> : null}

      <div className="space-y-5">
        <div>
          <label htmlFor={`${baseId}-title`} className={labelClass}>
            Title
          </label>
          <input id={`${baseId}-title`} name="title" type="text" defaultValue={initial.title} className={fieldClass} />
        </div>

        <div>
          <label htmlFor={`${baseId}-subtitle`} className={labelClass}>
            Subtitle
          </label>
          <input
            id={`${baseId}-subtitle`}
            name="subtitle"
            type="text"
            defaultValue={initial.subtitle}
            className={fieldClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${baseId}-type`} className={labelClass}>
              Article type
            </label>
            <select id={`${baseId}-type`} name="articleType" defaultValue={initial.articleType} className={fieldClass}>
              {ARTICLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ARTICLE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${baseId}-evidence`} className={labelClass}>
              Evidence category
            </label>
            <select
              id={`${baseId}-evidence`}
              name="evidenceCategory"
              defaultValue={initial.evidenceCategory}
              className={fieldClass}
            >
              <option value="">None</option>
              {EVIDENCE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {EVIDENCE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={`${baseId}-tags`} className={labelClass}>
            Tags
          </label>
          <input
            id={`${baseId}-tags`}
            name="tagsInput"
            type="text"
            defaultValue={initial.tagsInput}
            placeholder="marathon, fueling, recovery"
            className={fieldClass}
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Separate with commas.</p>
        </div>

        <div>
          <label htmlFor={`${baseId}-cover`} className={labelClass}>
            Cover image
          </label>
          <ImageUrlField inputId={`${baseId}-cover`} value={coverImageUrl} onChange={setCoverImageUrl} placeholder="https://…" />
          <input type="hidden" name="coverImageUrl" value={coverImageUrl} />
        </div>
      </div>

      <div>
        <p className={labelClass}>Content</p>
        <p className="mt-1 mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Any heading followed by &ldquo;in Section Title&rdquo; (e.g. &ldquo;Gut Training Is a Real, Trainable
          Skill in Nutrition &amp; Fueling&rdquo;) links automatically. To link a bare section name, or any other
          phrase, mid-sentence, write it as <code>[link text](/href)</code>. For emphasis, wrap text in{" "}
          <code>**bold**</code>, <code>_italic_</code>, or <code>++underline++</code>: select text and click
          B/I/U, or press Cmd/Ctrl+B/I/U, in any text field below, including bullet items.
        </p>
        <ContentBlockEditor value={content} onChange={setContent} />
      </div>

      <div>
        <p className={labelClass}>Citations</p>
        <CitationsEditor citations={citations} onChange={setCitations} />
      </div>

      <input type="hidden" name="contentJson" value={JSON.stringify(content)} />
      <input type="hidden" name="citationsJson" value={JSON.stringify(citations)} />

      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.success ? (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Saved.
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Saving…" : mode === "create" ? "Create draft" : "Save changes"}
      </Button>
    </form>
  );
}
