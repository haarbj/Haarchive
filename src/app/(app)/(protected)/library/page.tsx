import type { Metadata } from "next";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { resolveTopicMetadata } from "@/lib/library/resolve-content";
import { hasReadableContent } from "@/lib/mastery/readable-content";
import { buildHistoryTimeline, type RawHistoryEvent } from "@/lib/library/history";
import type { LibraryNote } from "@/lib/library/notes";
import type { Note, NoteRow } from "@/lib/notes/types";
import { mapNoteRow } from "@/lib/notes/types";
import type { MasteryLevel } from "@/lib/mastery/algorithm";
import { formatRelativeTime } from "@/lib/format";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { CardLink } from "@/components/ui/card-link";
import { EmptyState } from "@/components/ui/empty-state";
import { MyNotesSection } from "@/app/(app)/(protected)/library/my-notes-section";
import { SavedTopicsSection, type SavedTopicCard } from "@/app/(app)/(protected)/library/saved-topics-section";

export const metadata: Metadata = {
  title: "Library",
  robots: { index: false, follow: false },
};

const LEVEL_LABELS: Record<MasteryLevel, string> = {
  exploring: "Exploring",
  familiar: "Familiar",
  proficient: "Proficient",
  advanced: "Advanced",
  mastered: "Mastered",
};

type MasteryRow = {
  topic_id: string;
  level: MasteryLevel;
  last_event_at: string | null;
  topics: { slug: string; title: string } | null;
};

// Resolves a set of content slugs against sections.ts first (free, sync,
// the common case for real taxonomy topics), then batches exactly one DB
// query for whatever's left over -- a DB-backed contributor article, a
// different slug namespace entirely (see resolve-content.ts's own
// comment). Returns a plain title-only fallback (no category) for a slug
// that resolves to neither, rather than silently dropping it -- a note or
// bookmark on now-deleted content should still show *something*.
async function resolveManyContentSlugs(
  slugs: string[],
): Promise<Map<string, { title: string; categorySlug: string | null; categoryTitle: string | null }>> {
  const resolved = new Map<string, { title: string; categorySlug: string | null; categoryTitle: string | null }>();
  const unresolved: string[] = [];

  for (const slug of new Set(slugs)) {
    const meta = resolveTopicMetadata(slug);
    if (meta) resolved.set(slug, meta);
    else unresolved.push(slug);
  }

  if (unresolved.length > 0) {
    const supabase = await createClient();
    const { data: articles } = await supabase
      .from("articles")
      .select("slug, title")
      .in("slug", unresolved)
      .eq("status", "published");
    for (const article of articles ?? []) {
      resolved.set(article.slug, { title: article.title, categorySlug: null, categoryTitle: "Articles" });
    }
  }

  for (const slug of unresolved) {
    if (!resolved.has(slug)) resolved.set(slug, { title: slug, categorySlug: null, categoryTitle: null });
  }

  return resolved;
}

export default async function LibraryPage() {
  const session = await getAppSession();
  if (!session) return null; // the (protected) layout already redirects; this satisfies TS

  const supabase = await createClient();

  const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Phase 5.2 audit fix: bookmarks used to be a 4th, separate `await` after
  // this block resolved -- a real round-trip tacked onto every Library
  // page load with no dependency on the other three queries. Folded into
  // the same Promise.all so all four run concurrently.
  const [notesResult, masteryResult, historyEventsResult, bookmarksResult] = await Promise.all([
    supabase.from("notes").select("*").order("updated_at", { ascending: false }).returns<NoteRow[]>(),
    supabase
      .from("user_topic_mastery")
      .select("topic_id, level, last_event_at, topics(slug, title)")
      .order("last_event_at", { ascending: false })
      .returns<MasteryRow[]>(),
    supabase
      .from("learning_events")
      .select("event_type, created_at, topics(slug)")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .returns<{ event_type: string; created_at: string; topics: { slug: string } | null }[]>(),
    supabase.from("bookmarks").select("*").order("created_at", { ascending: false }),
  ]);

  const notes: Note[] = (notesResult.data ?? []).map(mapNoteRow);
  const masteryRows = (masteryResult.data ?? []).filter((r) => r.topics);
  const bookmarks = bookmarksResult.data ?? [];
  const rawHistoryEvents: RawHistoryEvent[] = (historyEventsResult.data ?? [])
    .filter((e) => e.topics)
    .map((e) => ({ eventType: e.event_type, topicSlug: e.topics!.slug, createdAt: e.created_at }));

  // One batched resolution pass covering every content_slug/topic_slug
  // this page needs a title/category for -- notes, bookmarks, and history
  // events all draw from the same map, so a topic's title is only ever
  // looked up once regardless of how many sections reference it, and this
  // is the only round-trip to `articles` this page ever makes (Phase 9
  // audit fix: a history-only slug not already covered by notes/bookmarks
  // used to trigger a second, separate resolution pass further down --
  // folded into this one instead).
  const allSlugs = [
    ...notes.map((n) => n.contentSlug),
    ...bookmarks.map((b) => b.topic_slug as string),
    ...rawHistoryEvents.map((e) => e.topicSlug),
  ];
  const resolvedMeta = await resolveManyContentSlugs(allSlugs);

  // ---------- Continue Reading ----------
  // History, not recommendation (see this file's own header comment) --
  // the user's own real recent activity, most-recently-touched first,
  // short of Mastered (a Mastered topic has nothing left to "continue").
  // Deliberately does not reuse recommendNextTopic()'s path-walking logic
  // at all -- that's a different question ("what should I do next") from
  // this one ("what was I in the middle of").
  //
  // Phase 5.1 audit fix: also excludes topics with no readable content
  // (every calculator, heat-tracker, training-plans) -- a tool-only topic
  // can pick up a mastery row from a single tool_used, and without this
  // filter it showed up here labeled "Exploring" with a "Continue ->" CTA
  // that had nothing real to continue (these topics are structurally
  // incapable of ever leaving Exploring -- see readable-content.ts). Same
  // signal the dashboard's own mastery explanation already uses, reused
  // here rather than re-defined, so the two can't drift apart.
  const continueReading = masteryRows
    .filter((row) => row.level !== "mastered" && hasReadableContent(row.topics!.slug))
    .slice(0, 8)
    .map((row) => ({
      slug: row.topics!.slug,
      title: row.topics!.title,
      level: row.level,
      lastEventAt: row.last_event_at,
      categoryTitle: resolveTopicMetadata(row.topics!.slug)?.categoryTitle ?? null,
    }));

  // ---------- My Notes ----------
  const libraryNotes: LibraryNote[] = notes.map((note) => {
    const meta = resolvedMeta.get(note.contentSlug)!;
    return {
      ...note,
      topicTitle: meta.title,
      categorySlug: meta.categorySlug,
      categoryTitle: meta.categoryTitle,
    };
  });

  // ---------- Saved Topics ----------
  const savedTopics: SavedTopicCard[] = bookmarks.map((bookmark) => {
    const slug = bookmark.topic_slug as string;
    const meta = resolvedMeta.get(slug)!;
    const masteryRow = masteryRows.find((r) => r.topics!.slug === slug);
    return {
      bookmarkId: bookmark.id as string,
      topicSlug: slug,
      title: meta.title,
      categoryTitle: meta.categoryTitle,
      level: masteryRow?.level ?? null,
      lastVisited: masteryRow?.last_event_at ?? (bookmark.created_at as string),
    };
  });

  // ---------- Learning History ----------
  // History events can reference topics that have neither a note nor a
  // bookmark (e.g. a topic only ever read, never annotated) -- those slugs
  // are already included in the single resolution pass above (allSlugs),
  // so every history topic's title is guaranteed to be in resolvedMeta.
  const historyTopicTitles = new Map<string, string>();
  for (const [slug, meta] of resolvedMeta) historyTopicTitles.set(slug, meta.title);
  const historyDays = buildHistoryTimeline(rawHistoryEvents, historyTopicTitles);

  return (
    <Container variant="dashboard">
      <Heading>Library</Heading>
      <p className="mt-3 max-w-2xl text-base text-zinc-600 dark:text-zinc-300">
        Your own private research notebook -- everything you&rsquo;ve read, noted, and saved, in one quiet place.
      </p>

      <section className="mt-14">
        <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          Continue Reading
        </p>
        {continueReading.length === 0 ? (
          <div className="mt-3">
            <EmptyState>Nothing in progress yet -- start reading, and it will show up here.</EmptyState>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {continueReading.map((topic) => (
              <CardLink key={topic.slug} href={`/${topic.slug}`} padding="sm">
                {topic.categoryTitle ? (
                  <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                    {topic.categoryTitle}
                  </p>
                ) : null}
                <p className="mt-1 font-semibold text-zinc-900 dark:text-white">{topic.title}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{topic.lastEventAt ? formatRelativeTime(topic.lastEventAt) : "Not yet opened"}</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">{LEVEL_LABELS[topic.level]}</span>
                </div>
                <span className="mt-2 inline-flex text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
                  Continue →
                </span>
              </CardLink>
            ))}
          </div>
        )}
      </section>

      <section className="mt-14">
        <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">My Notes</p>
        <MyNotesSection notes={libraryNotes} />
      </section>

      <section className="mt-14">
        <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          Saved Topics
        </p>
        <SavedTopicsSection topics={savedTopics} />
      </section>

      <section className="mt-14">
        <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          Learning History
        </p>
        {historyDays.length === 0 ? (
          <div className="mt-3">
            <EmptyState>Nothing recorded in the last 30 days.</EmptyState>
          </div>
        ) : (
          <div className="mt-3 space-y-6">
            {historyDays.map((day) => (
              <div key={day.dateKey}>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{day.label}</p>
                <ul className="mt-2 space-y-1.5">
                  {day.entries.map((entry, index) => (
                    <li key={index} className="text-sm text-zinc-600 dark:text-zinc-300">
                      <Link href={`/${entry.topicSlug}`} className="hover:underline">
                        {entry.summary}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}
