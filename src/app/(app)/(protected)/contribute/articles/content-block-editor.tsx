"use client";

import { useRef, useState, type DragEvent } from "react";

import type { ContentBlock, ListItem } from "@/lib/sections";
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
//
// Reordering supports two paths, since contributors asked for something
// closer to Google Docs: dragging a card's handle to its new spot directly,
// or inserting a brand-new block at an exact position via the dividers
// between cards -- neither requires appending at the end and walking a
// block up one row at a time with the Up button.
export function ContentBlockEditor({
  value,
  onChange,
}: {
  value: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);

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
  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(from < to ? to - 1 : to, 0, moved);
    onChange(next);
  }
  function insertAt(position: number, type: ContentBlock["type"]) {
    const next = [...value];
    next.splice(position, 0, defaultBlockFor(type));
    onChange(next);
    setInsertAtIndex(null);
  }

  return (
    <div className="space-y-1">
      <InsertDivider
        position={0}
        open={insertAtIndex === 0}
        onToggle={() => setInsertAtIndex(insertAtIndex === 0 ? null : 0)}
        onInsert={(type) => insertAt(0, type)}
      />
      {value.map((block, index) => (
        <div key={index}>
          <Card
            padding="sm"
            data-block-card
            onDragOver={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              if (dragIndex !== null && dragIndex !== index) setDragOverIndex(index);
            }}
            onDragLeave={() => setDragOverIndex((current) => (current === index ? null : current))}
            onDrop={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              if (dragIndex !== null) reorder(dragIndex, index);
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            className={`transition ${dragIndex === index ? "opacity-40" : ""} ${
              dragOverIndex === index && dragIndex !== index ? "ring-2 ring-accent-tip" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  draggable
                  onDragStart={(e: DragEvent<HTMLSpanElement>) => {
                    setDragIndex(index);
                    const card = (e.currentTarget as HTMLElement).closest("[data-block-card]") as HTMLElement | null;
                    if (card) e.dataTransfer.setDragImage(card, 20, 20);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  // Only this handle is draggable -- not the whole card --
                  // so starting a selection drag inside a textarea or input
                  // (to highlight text) behaves like normal text selection
                  // instead of being hijacked into a block-reorder drag.
                  className="cursor-grab select-none text-zinc-400 active:cursor-grabbing dark:text-zinc-500"
                  title="Drag to reorder"
                >
                  ⠿
                </span>
                <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  {BLOCK_LABELS[block.type]}
                </span>
              </div>
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
                <div className="space-y-2">
                  <FormattableTextarea
                    rows={3}
                    value={block.text}
                    onChange={(text) => update(index, { ...block, text })}
                    placeholder="Paragraph text"
                  />
                  <div className="flex gap-2">
                    <input
                      className={`${fieldClass} flex-1`}
                      value={block.linkHref ?? ""}
                      onChange={(e) => update(index, { ...block, linkHref: e.target.value || undefined })}
                      placeholder="Link URL (optional)"
                    />
                    <input
                      className={`${fieldClass} flex-1`}
                      value={block.linkText ?? ""}
                      onChange={(e) => update(index, { ...block, linkText: e.target.value || undefined })}
                      placeholder="Link text (optional)"
                    />
                  </div>
                </div>
              )}

              {block.type === "list" && (
                <ListItemsEditor
                  items={block.items}
                  onChange={(items) => update(index, { ...block, items })}
                />
              )}

              {block.type === "quote" && (
                <div className="space-y-2">
                  <FormattableTextarea
                    rows={2}
                    value={block.text}
                    onChange={(text) => update(index, { ...block, text })}
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
                  <FormattableTextarea
                    rows={2}
                    value={block.text ?? ""}
                    onChange={(text) => update(index, { ...block, text: text || undefined })}
                    placeholder="Lead-in text (optional)"
                  />
                  <StringListEditor
                    items={block.items ?? []}
                    onChange={(items) => update(index, { ...block, items })}
                    label="Bullet items (optional)"
                  />
                  <div className="flex gap-2">
                    <input
                      className={`${fieldClass} flex-1`}
                      value={block.linkHref ?? ""}
                      onChange={(e) => update(index, { ...block, linkHref: e.target.value || undefined })}
                      placeholder="Link URL (optional, e.g. /nutrition-and-fueling)"
                    />
                    <input
                      className={`${fieldClass} flex-1`}
                      value={block.linkText ?? ""}
                      onChange={(e) => update(index, { ...block, linkText: e.target.value || undefined })}
                      placeholder="Link text (e.g. Nutrition & Fueling)"
                    />
                  </div>
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

          <InsertDivider
            position={index + 1}
            open={insertAtIndex === index + 1}
            onToggle={() => setInsertAtIndex(insertAtIndex === index + 1 ? null : index + 1)}
            onInsert={(type) => insertAt(index + 1, type)}
          />
        </div>
      ))}
    </div>
  );
}

// The "add a block at the end, then click Up a bunch of times" complaint
// this replaces: every gap between cards (including before the first and
// after the last) gets its own insertion point, so a new block lands
// exactly where it's needed instead of needing to be walked into place.
function InsertDivider({
  position,
  open,
  onToggle,
  onInsert,
}: {
  position: number;
  open: boolean;
  onToggle: () => void;
  onInsert: (type: ContentBlock["type"]) => void;
}) {
  return (
    <div className="group relative flex items-center py-1">
      <div className="h-px flex-1 bg-transparent transition group-hover:bg-black/10 dark:group-hover:bg-white/10" />
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Insert block at position ${position + 1}`}
        className={`mx-2 flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold leading-none transition ${
          open
            ? "border-accent-tip bg-accent-tip/10 text-accent-tip"
            : "border-transparent text-transparent group-hover:border-black/20 group-hover:text-zinc-500 dark:group-hover:border-white/20 dark:group-hover:text-zinc-400"
        }`}
      >
        +
      </button>
      <div className="h-px flex-1 bg-transparent transition group-hover:bg-black/10 dark:group-hover:bg-white/10" />
      {open ? (
        <div className="absolute left-1/2 top-full z-10 mt-1 flex -translate-x-1/2 flex-wrap justify-center gap-2 rounded-card border border-black/10 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-zinc-900">
          {BLOCK_TYPES.map((type) => (
            <Button key={type} type="button" variant="outline" size="sm" onClick={() => onInsert(type)}>
              + {BLOCK_LABELS[type]}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Wraps the current selection in `marker` on both sides (e.g. selecting
// "very" and clicking Bold turns it into "**very**"), matching how a
// Google Docs-style toolbar button behaves -- select first, then click.
// Collapsed selections still insert an empty pair with the cursor left
// in the middle, so typing starts already-marked. Works the same way on
// a single-line input as a multi-line textarea -- both expose the same
// selectionStart/selectionEnd/setSelectionRange API.
function wrapSelection(el: HTMLTextAreaElement | HTMLInputElement, marker: string) {
  const { value } = el;
  // HTMLInputElement types these as nullable (some input types don't
  // support selection at all) even though our text inputs always have
  // them set at runtime -- default to "cursor at the end" if either is
  // somehow null.
  const selectionStart = el.selectionStart ?? value.length;
  const selectionEnd = el.selectionEnd ?? value.length;
  const selected = value.slice(selectionStart, selectionEnd);
  return {
    value: value.slice(0, selectionStart) + marker + selected + marker + value.slice(selectionEnd),
    selectionStart: selectionStart + marker.length,
    selectionEnd: selectionStart + marker.length + selected.length,
  };
}

const FORMAT_MARKS = [
  { marker: "**", label: "B", title: "Bold", className: "font-bold", shortcutKey: "b" },
  { marker: "_", label: "I", title: "Italic", className: "italic", shortcutKey: "i" },
  { marker: "++", label: "U", title: "Underline", className: "underline decoration-dotted", shortcutKey: "u" },
] as const;

// Shared by every field that supports formatting -- the multi-line
// FormattableTextarea below and each single-line bullet-item input in
// StringListEditor -- so Cmd/Ctrl+B/I/U behaves identically everywhere
// text can be typed, not just in the fields with a visible toolbar.
function matchFormatShortcut(e: { metaKey: boolean; ctrlKey: boolean; key: string }) {
  if (!(e.metaKey || e.ctrlKey)) return null;
  return FORMAT_MARKS.find((m) => m.shortcutKey === e.key.toLowerCase()) ?? null;
}

// A textarea plus a small Bold/Italic/Underline row -- the closest this
// plain-fields editor gets to a Google Docs toolbar. Cmd/Ctrl+B/I/U work
// too, wrapping the current selection exactly like clicking the matching
// button. It doesn't render the formatting live in the box (this stays a
// plain <textarea>, not a contenteditable surface); it wraps the
// selection in the same **/_/++ marks linkifyContent renders on the
// published page, so what a contributor sees here is the source, not a
// preview.
function FormattableTextarea({
  value,
  onChange,
  rows,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function applyMark(marker: string) {
    const el = ref.current;
    if (!el) return;
    const next = wrapSelection(el, marker);
    onChange(next.value);
    // Re-render happens before this fires, so the selection can be
    // restored on the same element once its value has actually updated.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {FORMAT_MARKS.map(({ marker, label, title, className }) => (
          <button
            key={marker}
            type="button"
            title={title}
            aria-label={title}
            // Prevents the textarea from blurring (and its selection from
            // collapsing) before the click handler gets a chance to read it.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyMark(marker)}
            className={`rounded border border-black/10 px-2 text-xs text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5 ${className}`}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        className={fieldClass}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          const mark = matchFormatShortcut(e);
          if (!mark) return;
          e.preventDefault();
          applyMark(mark.marker);
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

// Shared by every place an item needs to swap with a neighbor (bullet
// items here, list items and their sub-items below) -- returns null at
// either boundary instead of wrapping, matching the block-level Up/Down
// buttons' behavior.
function moveInArray<T>(arr: T[], index: number, direction: -1 | 1): T[] | null {
  const target = index + direction;
  if (target < 0 || target >= arr.length) return null;
  const next = [...arr];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
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
  // Keyed by item index rather than one useRef per item -- the list can
  // grow/shrink/reorder, and hooks can't be called inside `.map`.
  const inputs = useRef(new Map<number, HTMLInputElement>());

  function applyMarkAt(i: number, marker: string) {
    const el = inputs.current.get(i);
    if (!el) return;
    const next = wrapSelection(el, marker);
    onChange(items.map((it, idx) => (idx === i ? next.value : it)));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }

  function move(i: number, direction: -1 | 1) {
    const next = moveInArray(items, i, direction);
    if (next) onChange(next);
  }

  return (
    <div className="space-y-2">
      <p className={labelClass}>{label}</p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            ref={(el) => {
              if (el) inputs.current.set(i, el);
              else inputs.current.delete(i);
            }}
            className={`${fieldClass} flex-1`}
            value={item}
            onChange={(e) => onChange(items.map((it, idx) => (idx === i ? e.target.value : it)))}
            onKeyDown={(e) => {
              const mark = matchFormatShortcut(e);
              if (!mark) return;
              e.preventDefault();
              applyMarkAt(i, mark.marker);
            }}
          />
          <button
            type="button"
            onClick={() => move(i, -1)}
            disabled={i === 0}
            className="text-xs font-semibold text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(i, 1)}
            disabled={i === items.length - 1}
            className="text-xs font-semibold text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
          >
            ↓
          </button>
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

function textOfListItem(item: ListItem): string {
  return typeof item === "string" ? item : item.text;
}
function subItemsOfListItem(item: ListItem): string[] {
  return typeof item === "string" ? [] : item.items;
}

// The `list` block's own items editor -- distinct from StringListEditor
// (which stays flat, for callout bullet items) because a list item can
// have its own sub-items one level deep. A plain string is promoted to
// `{ text, items: [] }` the first time a sub-item is added under it.
function ListItemsEditor({
  items,
  onChange,
}: {
  items: ListItem[];
  onChange: (items: ListItem[]) => void;
}) {
  // Keyed by a composite string ("3" for a top-level item, "3-1" for its
  // second sub-item) so both levels can share one ref map and one
  // applyMark implementation.
  const inputs = useRef(new Map<string, HTMLInputElement>());

  function setInputRef(key: string, el: HTMLInputElement | null) {
    if (el) inputs.current.set(key, el);
    else inputs.current.delete(key);
  }

  function updateItem(i: number, next: ListItem) {
    onChange(items.map((it, idx) => (idx === i ? next : it)));
  }

  function applyMarkAt(key: string, marker: string, commit: (text: string) => void) {
    const el = inputs.current.get(key);
    if (!el) return;
    const next = wrapSelection(el, marker);
    commit(next.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }

  function setText(i: number, text: string) {
    const item = items[i];
    updateItem(i, typeof item === "string" ? text : { ...item, text });
  }
  function addSubItem(i: number) {
    const item = items[i];
    const base = typeof item === "string" ? { text: item, items: [] as string[] } : item;
    updateItem(i, { ...base, items: [...base.items, ""] });
  }
  function setSubItem(i: number, j: number, text: string) {
    const item = items[i];
    if (typeof item === "string") return;
    updateItem(i, { ...item, items: item.items.map((sub, idx) => (idx === j ? text : sub)) });
  }
  function removeSubItem(i: number, j: number) {
    const item = items[i];
    if (typeof item === "string") return;
    updateItem(i, { ...item, items: item.items.filter((_, idx) => idx !== j) });
  }
  function moveItem(i: number, direction: -1 | 1) {
    const next = moveInArray(items, i, direction);
    if (next) onChange(next);
  }
  function moveSubItem(i: number, j: number, direction: -1 | 1) {
    const item = items[i];
    if (typeof item === "string") return;
    const nextSubs = moveInArray(item.items, j, direction);
    if (nextSubs) updateItem(i, { ...item, items: nextSubs });
  }

  return (
    <div className="space-y-2">
      <p className={labelClass}>Items</p>
      {items.map((item, i) => {
        const text = textOfListItem(item);
        const subItems = subItemsOfListItem(item);
        const key = `${i}`;
        return (
          <div key={i} className="space-y-2">
            <div className="flex gap-2">
              <input
                ref={(el) => setInputRef(key, el)}
                className={`${fieldClass} flex-1`}
                value={text}
                onChange={(e) => setText(i, e.target.value)}
                onKeyDown={(e) => {
                  const mark = matchFormatShortcut(e);
                  if (!mark) return;
                  e.preventDefault();
                  applyMarkAt(key, mark.marker, (next) => setText(i, next));
                }}
              />
              <button
                type="button"
                onClick={() => moveItem(i, -1)}
                disabled={i === 0}
                className="text-xs font-semibold text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveItem(i, 1)}
                disabled={i === items.length - 1}
                className="text-xs font-semibold text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => addSubItem(i)}
                title="Add a sub-item nested under this one"
                className="text-xs font-semibold whitespace-nowrap text-zinc-600 dark:text-zinc-300"
              >
                ⇥ Sub-item
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="text-xs font-semibold text-red-700 dark:text-red-400"
              >
                Remove
              </button>
            </div>

            {subItems.length > 0 ? (
              <div className="ml-6 space-y-2 border-l-2 border-black/5 pl-3 dark:border-white/10">
                {subItems.map((subItem, j) => {
                  const subKey = `${i}-${j}`;
                  return (
                    <div key={j} className="flex gap-2">
                      <input
                        ref={(el) => setInputRef(subKey, el)}
                        className={`${fieldClass} flex-1`}
                        value={subItem}
                        onChange={(e) => setSubItem(i, j, e.target.value)}
                        onKeyDown={(e) => {
                          const mark = matchFormatShortcut(e);
                          if (!mark) return;
                          e.preventDefault();
                          applyMarkAt(subKey, mark.marker, (next) => setSubItem(i, j, next));
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => moveSubItem(i, j, -1)}
                        disabled={j === 0}
                        className="text-xs font-semibold text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSubItem(i, j, 1)}
                        disabled={j === subItems.length - 1}
                        className="text-xs font-semibold text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSubItem(i, j)}
                        className="text-xs font-semibold text-red-700 dark:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
        + Item
      </Button>
    </div>
  );
}
