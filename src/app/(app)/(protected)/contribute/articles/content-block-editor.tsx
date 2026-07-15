"use client";

import type { ContentBlock } from "@/lib/sections";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const fieldClass = `w-full ${baseFieldClass}`;

const BLOCK_TYPES: ContentBlock["type"][] = ["heading", "paragraph", "list", "quote", "callout", "image"];
const BLOCK_LABELS: Record<ContentBlock["type"], string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  list: "List",
  quote: "Quote",
  callout: "Callout",
  image: "Image",
};
const CALLOUT_VARIANTS = ["tip", "mistake", "research", "takeaway", "advanced"] as const;

function defaultBlockFor(type: ContentBlock["type"]): ContentBlock {
  switch (type) {
    case "heading":
      return { type: "heading", text: "" };
    case "paragraph":
      return { type: "paragraph", text: "" };
    case "list":
      return { type: "list", items: [""] };
    case "quote":
      return { type: "quote", text: "" };
    case "callout":
      return { type: "callout", variant: "tip", text: "" };
    case "image":
      return { type: "image", url: "" };
  }
}

// A constrained, form-based block editor -- not a rich-text/WYSIWYG engine
// on purpose (see the contributor-platform planning discussion): every
// block type gets a small set of plain fields matching ContentBlock
// exactly, so what a contributor builds here is guaranteed to render
// through the same ArticleLayout Foundations pages already use.
export function ContentBlockEditor({
  value,
  onChange,
}: {
  value: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}) {
  function update(index: number, block: ContentBlock) {
    onChange(value.map((b, i) => (i === index ? block : b)));
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function add(type: ContentBlock["type"]) {
    onChange([...value, defaultBlockFor(type)]);
  }

  return (
    <div className="space-y-4">
      {value.map((block, index) => (
        <Card key={index} padding="sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {BLOCK_LABELS[block.type]}
            </span>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
              >
                ↑ Up
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === value.length - 1}
                className="text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
              >
                ↓ Down
              </button>
              <button type="button" onClick={() => remove(index)} className="text-red-700 dark:text-red-400">
                Remove
              </button>
            </div>
          </div>

          <div className="mt-3">
            {block.type === "heading" && (
              <div className="flex gap-2">
                <input
                  className={`${fieldClass} flex-1`}
                  value={block.text}
                  onChange={(e) => update(index, { ...block, text: e.target.value })}
                  placeholder="Heading text"
                />
                <select
                  className={baseFieldClass}
                  value={block.level ?? 2}
                  onChange={(e) => update(index, { ...block, level: Number(e.target.value) as 2 | 3 })}
                >
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                </select>
              </div>
            )}

            {block.type === "paragraph" && (
              <textarea
                className={fieldClass}
                rows={3}
                value={block.text}
                onChange={(e) => update(index, { ...block, text: e.target.value })}
                placeholder="Paragraph text"
              />
            )}

            {block.type === "list" && (
              <StringListEditor
                items={block.items}
                onChange={(items) => update(index, { ...block, items })}
              />
            )}

            {block.type === "quote" && (
              <div className="space-y-2">
                <textarea
                  className={fieldClass}
                  rows={2}
                  value={block.text}
                  onChange={(e) => update(index, { ...block, text: e.target.value })}
                  placeholder="Quote text"
                />
                <input
                  className={fieldClass}
                  value={block.attribution ?? ""}
                  onChange={(e) => update(index, { ...block, attribution: e.target.value || undefined })}
                  placeholder="Attribution (optional)"
                />
              </div>
            )}

            {block.type === "callout" && (
              <div className="space-y-2">
                <select
                  className={fieldClass}
                  value={block.variant}
                  onChange={(e) =>
                    update(index, { ...block, variant: e.target.value as (typeof CALLOUT_VARIANTS)[number] })
                  }
                >
                  {CALLOUT_VARIANTS.map((variant) => (
                    <option key={variant} value={variant}>
                      {variant}
                    </option>
                  ))}
                </select>
                <input
                  className={fieldClass}
                  value={block.title ?? ""}
                  onChange={(e) => update(index, { ...block, title: e.target.value || undefined })}
                  placeholder="Title (optional)"
                />
                <textarea
                  className={fieldClass}
                  rows={2}
                  value={block.text ?? ""}
                  onChange={(e) => update(index, { ...block, text: e.target.value || undefined })}
                  placeholder="Lead-in text (optional)"
                />
                <StringListEditor
                  items={block.items ?? []}
                  onChange={(items) => update(index, { ...block, items })}
                  label="Bullet items (optional)"
                />
              </div>
            )}

            {block.type === "image" && (
              <div className="space-y-2">
                <input
                  className={fieldClass}
                  value={block.url}
                  onChange={(e) => update(index, { ...block, url: e.target.value })}
                  placeholder="Image URL"
                />
                <input
                  className={fieldClass}
                  value={block.alt ?? ""}
                  onChange={(e) => update(index, { ...block, alt: e.target.value || undefined })}
                  placeholder="Alt text"
                />
                <input
                  className={fieldClass}
                  value={block.caption ?? ""}
                  onChange={(e) => update(index, { ...block, caption: e.target.value || undefined })}
                  placeholder="Caption (optional)"
                />
              </div>
            )}
          </div>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((type) => (
          <Button key={type} type="button" variant="outline" size="sm" onClick={() => add(type)}>
            + {BLOCK_LABELS[type]}
          </Button>
        ))}
      </div>
    </div>
  );
}

function StringListEditor({
  items,
  onChange,
  label = "Items",
}: {
  items: string[];
  onChange: (items: string[]) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <p className={labelClass}>{label}</p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={`${fieldClass} flex-1`}
            value={item}
            onChange={(e) => onChange(items.map((it, idx) => (idx === i ? e.target.value : it)))}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="text-xs font-semibold text-red-700 dark:text-red-400"
          >
            Remove
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
        + Item
      </Button>
    </div>
  );
}
