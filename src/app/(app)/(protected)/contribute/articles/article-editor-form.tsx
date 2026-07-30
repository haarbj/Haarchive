"use client";

import { useActionState, useId, useState } from "react";

import type { ContentBlock } from "@/lib/sections";
import { ARTICLE_TYPES, ARTICLE_TYPE_LABELS, EVIDENCE_CATEGORIES, EVIDENCE_CATEGORY_LABELS } from "@/lib/articles/constants";
import type { TagOption } from "@/lib/articles/tag-options";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { titleCase } from "@/lib/format";
import { createArticleDraft, updateArticleDraft, uploadArticleImage, type ArticleDraftState } from "./actions";
import { ContentBlockEditor } from "./content-block-editor";
import { CitationsEditor, type CitationDraft } from "./citations-editor";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ImageUrlField } from "@/components/ui/image-url-field";

const fieldClass = `w-full ${baseFieldClass}`;

const MAX_TAGS = 8;

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
  | { mode: "create"; articleId?: undefined; initial: ArticleEditorInitial; tagOptions: TagOption[] }
  | { mode: "edit"; articleId: string; initial: ArticleEditorInitial; tagOptions: TagOption[] };

export function ArticleEditorForm({ mode, articleId, initial, tagOptions }: Props) {
  const baseId = useId();
  const action = mode === "create" ? createArticleDraft : updateArticleDraft;
  const [state, formAction, isPending] = useActionState<ArticleDraftState, FormData>(action, {});
  const [content, setContent] = useState<ContentBlock[]>(initial.content);
  const [citations, setCitations] = useState<CitationDraft[]>(initial.citations);
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl);
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    initial.tagsInput
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  );

  function toggleTag(name: string) {
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : prev.length < MAX_TAGS ? [...prev, name] : prev,
    );
  }

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
          <p className={labelClass}>Tags</p>
          {tagOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tagOptions.map((tag) => {
                const checked = selectedTags.includes(tag.name);
                return (
                  <label
                    key={tag.id}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-pill border px-3 py-1 text-sm transition ${
                      checked
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                        : "border-black/10 text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTag(tag.name)}
                      disabled={!checked && selectedTags.length >= MAX_TAGS}
                      className="sr-only"
                    />
                    {titleCase(tag.name)}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              No tags exist yet -- an admin can add some from the Admin → Article Tags page.
            </p>
          )}
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Up to {MAX_TAGS}. A fixed list, kept consistent for everyone -- an admin can add more tags to
            choose from.
          </p>
          <input type="hidden" name="tagsInput" value={selectedTags.join(",")} />
        </div>

        <div>
          <label htmlFor={`${baseId}-cover`} className={labelClass}>
            Cover image
          </label>
          <ImageUrlField
            inputId={`${baseId}-cover`}
            value={coverImageUrl}
            onChange={setCoverImageUrl}
            uploadAction={uploadArticleImage}
            placeholder="https://…"
          />
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
