"use client";

import { useLayoutEffect, useRef, type ClipboardEvent, type CompositionEvent, type KeyboardEvent } from "react";

import { fieldClass as baseFieldClass } from "@/lib/form-styles";
import {
  captureSelectionOffsets,
  renderMarkupIntoElement,
  restoreSelectionOffsets,
  serializeElementToMarkup,
} from "./editable-markup-dom";

const fieldClass = `w-full ${baseFieldClass}`;

type MarkKind = "bold" | "italic" | "underline";

const FORMAT_MARKS: { kind: MarkKind; marker: string; label: string; title: string; className: string; shortcutKey: string }[] = [
  { kind: "bold", marker: "**", label: "B", title: "Bold", className: "font-bold", shortcutKey: "b" },
  { kind: "italic", marker: "_", label: "I", title: "Italic", className: "italic", shortcutKey: "i" },
  {
    kind: "underline",
    marker: "++",
    label: "U",
    title: "Underline",
    className: "underline decoration-dotted",
    shortcutKey: "u",
  },
];

function matchFormatShortcut(e: { metaKey: boolean; ctrlKey: boolean; key: string }) {
  if (!(e.metaKey || e.ctrlKey)) return null;
  return FORMAT_MARKS.find((m) => m.shortcutKey === e.key.toLowerCase()) ?? null;
}

// Shared by both components below -- owns the contenteditable ref, the
// string<->DOM round-trip, and every operation (typing, toolbar clicks,
// paste) that needs to read/restore a selection expressed in markup-string
// offsets rather than DOM Range terms.
function useEditableMarkup({
  value,
  onChange,
  multiline,
}: {
  value: string;
  onChange: (value: string) => void;
  multiline: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Sentinel: null forces the very first effect run (mount) to always
  // build the DOM. Set to the same string as `value` immediately whenever
  // *we* are the one calling onChange, so the effect below can tell "this
  // value changed because the parent reset it from outside" (rebuild)
  // apart from "this value changed because of our own last edit" (skip --
  // rebuilding here would blow away the caret position mid-keystroke).
  const lastEmitted = useRef<string | null>(null);
  const isComposing = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === lastEmitted.current) return;
    renderMarkupIntoElement(el, value);
    lastEmitted.current = value;
  }, [value]);

  function commit(nextValue: string, selection: { start: number; end: number } | null) {
    const el = ref.current;
    if (!el) return;
    lastEmitted.current = nextValue;
    onChange(nextValue);
    renderMarkupIntoElement(el, nextValue);
    if (selection) restoreSelectionOffsets(el, selection.start, selection.end);
  }

  function insertTextAtSelection(text: string) {
    const el = ref.current;
    if (!el) return;
    const sel = captureSelectionOffsets(el);
    if (!sel) return;
    const current = serializeElementToMarkup(el);
    const next = current.slice(0, sel.start) + text + current.slice(sel.end);
    const caret = sel.start + text.length;
    commit(next, { start: caret, end: caret });
  }

  function applyMark(kind: MarkKind) {
    const el = ref.current;
    if (!el) return;
    const sel = captureSelectionOffsets(el);
    if (!sel) return;
    const marker = FORMAT_MARKS.find((m) => m.kind === kind)!.marker;
    const current = serializeElementToMarkup(el);
    const selected = current.slice(sel.start, sel.end);
    const next = current.slice(0, sel.start) + marker + selected + marker + current.slice(sel.end);
    commit(next, { start: sel.start + marker.length, end: sel.start + marker.length + selected.length });
  }

  function applyLink() {
    const el = ref.current;
    if (!el) return;
    const sel = captureSelectionOffsets(el);
    if (!sel) return;
    const href = window.prompt("Link URL (e.g. /nutrition-and-fueling or https://...)");
    if (!href) return;
    const current = serializeElementToMarkup(el);
    const text = current.slice(sel.start, sel.end) || href;
    const inserted = `[${text}](${href})`;
    const next = current.slice(0, sel.start) + inserted + current.slice(sel.end);
    const caret = sel.start + inserted.length;
    commit(next, { start: caret, end: caret });
  }

  function handleInput() {
    if (isComposing.current) return;
    const el = ref.current;
    if (!el) return;
    // Read the selection AFTER the browser's own native edit for this
    // keystroke has already happened, then immediately rebuild from the
    // reparsed string -- this is what makes hand-typing "**bold**" snap
    // live the moment the closing ** lands, not just toolbar clicks.
    const sel = captureSelectionOffsets(el);
    commit(serializeElementToMarkup(el), sel);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const mark = matchFormatShortcut(e);
    if (mark) {
      e.preventDefault();
      applyMark(mark.kind);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      applyLink();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      // Matches a plain <textarea>'s Enter (a literal newline character;
      // content-blocks.tsx has no white-space:pre anywhere, so this stays
      // visually inert on the published page) vs. a plain <input>'s Enter
      // (no-op) -- multiline here means "paragraph/quote/callout text",
      // not "list/bullet item".
      if (multiline) insertTextAtSelection("\n");
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    // Never import HTML from the clipboard -- plain text only, so a
    // pasted "**bold**" lands as literal characters (matching what
    // hand-typing produces) rather than importing someone else's markup.
    e.preventDefault();
    insertTextAtSelection(e.clipboardData.getData("text/plain"));
  }

  function handleCompositionEnd(e: CompositionEvent<HTMLDivElement>) {
    isComposing.current = false;
    void e;
    handleInput();
  }

  return {
    ref,
    applyMark,
    applyLink,
    handlers: {
      onInput: handleInput,
      onKeyDown: handleKeyDown,
      onPaste: handlePaste,
      onCompositionStart: () => {
        isComposing.current = true;
      },
      onCompositionEnd: handleCompositionEnd,
    },
  };
}

function FormatToolbar({
  onApplyMark,
  onApplyLink,
}: {
  onApplyMark: (kind: MarkKind) => void;
  onApplyLink: () => void;
}) {
  return (
    <div className="flex gap-1">
      {FORMAT_MARKS.map(({ kind, label, title, className }) => (
        <button
          key={kind}
          type="button"
          title={title}
          aria-label={title}
          // Prevents the editable surface from losing its selection
          // before the click handler gets a chance to read it.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onApplyMark(kind)}
          className={`rounded border border-black/10 px-2 text-xs text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5 ${className}`}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        title="Link"
        aria-label="Link"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onApplyLink}
        className="rounded border border-black/10 px-2 text-xs text-zinc-600 underline hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
      >
        Link
      </button>
    </div>
  );
}

// Multiline field with a Bold/Italic/Underline/Link toolbar -- replaces
// FormattableTextarea. Cmd/Ctrl+B/I/U/K work too. Unlike the textarea it
// replaces, formatting renders live in the box: typing "**bold**" (or
// selecting text and clicking a button) shows real bold/italic/underline
// text immediately, not the raw marker characters -- no separate preview
// needed to check it. It still stores and reads back the exact same
// **/_/++ /[text](href) marker-syntax string the rest of the app already
// uses (Zod schema, Supabase column, the published-page renderer) --
// nothing downstream changes.
export function FormattableEditable({
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
  const { ref, applyMark, applyLink, handlers } = useEditableMarkup({ value, onChange, multiline: true });

  return (
    <div className="space-y-1">
      <FormatToolbar onApplyMark={applyMark} onApplyLink={applyLink} />
      <div className="relative">
        {value === "" && placeholder ? (
          <span className="pointer-events-none absolute top-2.5 left-4 text-base text-zinc-400 dark:text-zinc-500">
            {placeholder}
          </span>
        ) : null}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          className={`${fieldClass} block whitespace-pre-wrap`}
          style={{ minHeight: `${rows * 1.5}em` }}
          {...handlers}
        />
      </div>
    </div>
  );
}

// Single-line equivalent for bullet/list-item fields -- no visible
// toolbar (a per-row toolbar would roughly double the height of any list
// with several items), but the same Cmd/Ctrl+B/I/U/K shortcuts and live
// rendering work identically, and typing the marker syntax by hand always
// works regardless.
export function InlineFormattableField({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { ref, handlers } = useEditableMarkup({ value, onChange, multiline: false });

  return (
    <div className={`relative ${className}`}>
      {value === "" && placeholder ? (
        <span className="pointer-events-none absolute top-2.5 left-4 text-base text-zinc-400 dark:text-zinc-500">
          {placeholder}
        </span>
      ) : null}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="false"
        aria-label={placeholder}
        className={`${fieldClass} block`}
        {...handlers}
      />
    </div>
  );
}
