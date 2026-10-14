"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/db/client";
import { formatRelativeTime } from "@/lib/format";
import { sendCoachAthleteMessage, markThreadRead, type SendMessageState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

type MessageRow = {
  id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
  read_at: string | null;
};

const POLL_INTERVAL_MS = 15_000;
// Long enough that a signed URL from one poll cycle is almost always still
// valid by the next, short enough that a copied/leaked link doesn't stay
// live indefinitely -- regenerated every poll regardless (see the effect
// below), so this is a ceiling, not something callers wait out.
const SIGNED_URL_EXPIRY_S = 3600;

// Same poll-based pattern as notification-bell.tsx (no Supabase Realtime
// anywhere in this repo -- see the Phase 1 migration's own reasoning),
// just a shorter interval since an open conversation benefits from feeling
// closer to live than a passive notification badge does.
export function MessageThread({
  coachAthleteId,
  currentUserId,
  initialMessages,
  initialLoadError,
}: {
  coachAthleteId: string;
  currentUserId: string;
  initialMessages: MessageRow[];
  initialLoadError: string | null;
}) {
  const [messages, setMessages] = useState(initialMessages);
  // Set whenever a message fetch (initial load, poll, or the post-send
  // refresh) actually fails -- distinct from "this conversation has no
  // messages yet," which is messages.length === 0 with loadError null.
  // Deliberately does NOT clear `messages` on a poll failure: a transient
  // blip shouldn't wipe a real, already-loaded conversation, only flag
  // that the most recent refresh didn't succeed.
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const [state, formAction, isPending] = useActionState<SendMessageState, FormData>(
    sendCoachAthleteMessage.bind(null, coachAthleteId),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  // Derived (via useMemo), not state -- createObjectURL is a pure enough
  // function of selectedImage that it belongs in render, not an effect;
  // the effect below only ever handles the one real side effect
  // (revoking the previous blob: URL), never a setState call.
  const imagePreviewUrl = useMemo(() => (selectedImage ? URL.createObjectURL(selectedImage) : null), [selectedImage]);
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);
  // message-images is a private bucket -- image_path alone isn't a
  // fetchable URL, it has to be exchanged for a signed one via the
  // authenticated client, which only succeeds because of
  // message_images_select_participant's real RLS policy (see that
  // migration). Re-signed every time the message list changes rather than
  // cached indefinitely -- simpler than diffing for just-added images, and
  // cheap enough at a 15s poll interval not to matter.
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const paths = [...new Set(messages.map((m) => m.image_path).filter((p): p is string => !!p))];
    let cancelled = false;
    const supabase = createClient();
    // Always resolved via a promise chain (even the "nothing to sign"
    // case), so the resulting setSignedUrls call is consistently inside a
    // callback rather than sometimes synchronous in the effect body.
    const request =
      paths.length === 0
        ? Promise.resolve({ data: [] as { path: string; signedUrl: string }[] })
        : supabase.storage.from("message-images").createSignedUrls(paths, SIGNED_URL_EXPIRY_S);
    request.then(({ data }) => {
      if (cancelled) return;
      const next = new Map<string, string>();
      for (const item of data ?? []) {
        if (item.signedUrl && item.path) next.set(item.path, item.signedUrl);
      }
      setSignedUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [messages]);

  useEffect(() => {
    markThreadRead(coachAthleteId);
    let cancelled = false;

    function poll() {
      const supabase = createClient();
      supabase
        .from("coach_athlete_messages")
        .select("id, sender_id, body, image_path, created_at, read_at")
        .eq("coach_athlete_id", coachAthleteId)
        .order("created_at", { ascending: true })
        .returns<MessageRow[]>()
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            setLoadError(error.message);
            return;
          }
          if (data) {
            setLoadError(null);
            setMessages(data);
          }
        });
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [coachAthleteId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  function clearSelectedImage() {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // A message just finished sending -- poll immediately instead of waiting
  // up to POLL_INTERVAL_MS for the sender's own message to reappear.
  useEffect(() => {
    if (isPending) return;
    formRef.current?.reset();
    const supabase = createClient();
    supabase
      .from("coach_athlete_messages")
      .select("id, sender_id, body, image_path, created_at, read_at")
      .eq("coach_athlete_id", coachAthleteId)
      .order("created_at", { ascending: true })
      .returns<MessageRow[]>()
      .then(({ data, error }) => {
        if (error) {
          setLoadError(error.message);
        } else if (data) {
          setLoadError(null);
          setMessages(data);
        }
        clearSelectedImage();
      });
  }, [isPending, coachAthleteId]);

  return (
    <div>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-control border border-black/10 p-4 dark:border-white/10">
        {messages.length === 0 && loadError ? (
          <FormError>Couldn&rsquo;t load this conversation ({loadError}). Try refreshing the page.</FormError>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No messages yet -- say hello.</p>
        ) : (
          messages.map((message) => {
            const isOwn = message.sender_id === currentUserId;
            const imageUrl = message.image_path ? signedUrls.get(message.image_path) : null;
            return (
              <div key={message.id} className={isOwn ? "text-right" : "text-left"}>
                {message.image_path ? (
                  <div className={`inline-block max-w-[85%] ${message.body ? "mb-1" : ""}`}>
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a signed, time-limited private-bucket URL, not a local/optimizable asset
                      <img
                        src={imageUrl}
                        alt="Attached"
                        className="max-h-64 rounded-control border border-black/10 object-contain dark:border-white/10"
                      />
                    ) : (
                      <div className="flex h-32 w-48 items-center justify-center rounded-control border border-black/10 text-xs text-zinc-400 dark:border-white/10">
                        Loading image…
                      </div>
                    )}
                  </div>
                ) : null}
                {message.body ? (
                  <p
                    className={`inline-block max-w-[85%] rounded-control px-3 py-2 text-sm ${
                      isOwn
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                        : "bg-black/5 text-zinc-900 dark:bg-white/10 dark:text-white"
                    }`}
                  >
                    {message.body}
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{formatRelativeTime(message.created_at)}</p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      {messages.length > 0 && loadError ? (
        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
          Couldn&rsquo;t refresh just now -- showing the last update that loaded.
        </p>
      ) : null}

      {imagePreviewUrl ? (
        <div className="mt-3 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: object URL preview, not a real asset */}
          <img src={imagePreviewUrl} alt="" className="h-16 w-16 rounded-control border border-black/10 object-cover dark:border-white/10" />
          <button
            type="button"
            onClick={clearSelectedImage}
            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          >
            Remove
          </button>
        </div>
      ) : null}

      <form ref={formRef} action={formAction} className="mt-3 flex items-start gap-2">
        <textarea
          name="body"
          rows={1}
          placeholder="Message…"
          className="min-w-0 flex-1 rounded-control border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
        />
        <label
          className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-control border border-black/10 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
          title="Attach an image"
        >
          📷
          <input
            ref={fileInputRef}
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => setSelectedImage(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Sending…" : "Send"}
        </Button>
      </form>
      {state.error && <FormError className="mt-2">{state.error}</FormError>}
    </div>
  );
}
