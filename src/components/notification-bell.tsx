"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/db/client";
import { useAuthStatus } from "@/lib/use-auth-status";
import { formatRelativeTime } from "@/lib/format";
import { notificationHref } from "@/lib/notifications/notification-href";
import type { NotificationType } from "@/lib/notifications/types";

type NotificationRow = {
  id: string;
  type: NotificationType;
  content: string;
  read_at: string | null;
  related_entity_id: string | null;
  created_at: string;
};

const POLL_INTERVAL_MS = 45_000;
const LIST_LIMIT = 20;

const ICON_BUTTON_SIZE_CLASSES: Record<"md" | "sm", string> = {
  md: "h-12 w-12",
  sm: "h-10 w-10",
};

type NotificationBellProps = {
  // "md" (default, 48px) is the original size, still used in the mobile
  // menu where a larger touch target genuinely matters more. "sm" (40px)
  // matches the desktop header icon cluster's other buttons (search,
  // Questions, ThemeToggle, BugReportTrigger) -- see bug-report-trigger.tsx
  // for the same size prop, added for the same reason.
  size?: "md" | "sm";
};

export function NotificationBell({ size = "md" }: NotificationBellProps) {
  const authStatus = useAuthStatus();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Nothing to clear on sign-out: the component renders null below
    // whenever authStatus isn't "authenticated", so stale state here is
    // never actually shown.
    if (authStatus !== "authenticated") return;
    let cancelled = false;

    // Inline .then() (rather than an async function invoked directly)
    // mirrors useAuthStatus.ts's own fetch-on-mount shape -- both are the
    // same "read once, then subscribe/poll for updates" pattern.
    function poll() {
      const supabase = createClient();
      supabase
        .from("notifications")
        .select("id, type, content, read_at, related_entity_id, created_at")
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT)
        .returns<NotificationRow[]>()
        .then(({ data }) => {
          if (!cancelled) setNotifications(data ?? []);
        });
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // Re-poll on navigation too, same reasoning as useAuthStatus: this
    // component lives in the header and never unmounts across routes.
  }, [authStatus, pathname]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (authStatus !== "authenticated") return null;

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .in(
        "id",
        unread.map((n) => n.id),
      );
  }

  function handleSelect(notification: NotificationRow) {
    if (!notification.read_at) markRead(notification.id);
    const href = notificationHref(notification.type, notification.related_entity_id);
    setOpen(false);
    if (href) router.push(href);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        className={`relative flex items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white ${ICON_BUTTON_SIZE_CLASSES[size]}`}
      >
        <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M4 15h12l-1.2-1.6a2 2 0 0 1-.4-1.2V8.5a4.4 4.4 0 0 0-8.8 0v3.7a2 2 0 0 1-.4 1.2L4 15Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M8.2 17.5a1.8 1.8 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[var(--z-dropdown)] mt-2 w-80 rounded-xl border border-black/10 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-zinc-900">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Notifications
            </span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-2 py-4 text-sm text-zinc-500 dark:text-zinc-400">Nothing yet.</p>
            ) : (
              notifications.map((n) => {
                const href = notificationHref(n.type, n.related_entity_id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleSelect(n)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/10 ${
                      n.read_at ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-900 dark:text-white"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at ? (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                      ) : (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0">
                        <span className="block">{n.content}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                          {formatRelativeTime(n.created_at)}
                          {href ? " · View" : ""}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
