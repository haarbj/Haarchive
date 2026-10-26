import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { formatRelativeTime } from "@/lib/format";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

type RelationshipRow = { id: string; athlete_id: string; coach_id: string; tier: "free" | "paid" };
type Profile = { id: string; display_name: string };
type LastMessageRow = {
  coach_athlete_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
  sender_id: string;
  read_at: string | null;
};

export default async function MessagesIndexPage() {
  const session = await getAppSession();
  if (!session) return null;

  const supabase = await createClient();

  // isPrivateCoach and isCoachedAthlete are independent (see AppSession's
  // own comment) -- a coach who is also someone else's athlete needs a way
  // to reach their own conversation too, not just their roster's. Resolved
  // up front regardless of role, since the dual-role coach branch below
  // needs it alongside the roster list.
  let ownCoachRelationship: { id: string; coachName: string } | null = null;
  if (session.isCoachedAthlete) {
    const { data: relationship } = await supabase
      .from("coach_athletes")
      .select("id, coach_id, tier")
      .eq("athlete_id", session.userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle<{ id: string; coach_id: string; tier: "free" | "paid" }>();
    // Free-tier barrier: messaging is a paid-only feature (see the
    // task's own "free-tier barrier" section) -- the composer is hidden,
    // not discouraged, so a free-tier athlete gets no messaging entry
    // point at all rather than a conversation with no way to send.
    if (relationship && relationship.tier !== "free") {
      const { data: coachProfile } = await supabase
        .from("profiles")
        .select("display_name, coach_display_name")
        .eq("id", relationship.coach_id)
        .maybeSingle<{ display_name: string; coach_display_name: string | null }>();
      ownCoachRelationship = {
        id: relationship.id,
        coachName: coachProfile?.coach_display_name || coachProfile?.display_name || "your coach",
      };
    }
  }

  if (session.isPrivateCoach) {
    const isDualRole = !!ownCoachRelationship;

    const { data: allRelationships } = await supabase
      .from("coach_athletes")
      .select("id, athlete_id, coach_id, tier")
      .eq("coach_id", session.userId)
      .eq("status", "active")
      .returns<RelationshipRow[]>();
    // Free-tier athletes never appear in the coach's inbox either -- the
    // relationship exists (so the coach's roster/schedule tools see
    // them), but messaging is a paid-only surface.
    const relationships = (allRelationships ?? []).filter((r) => r.tier !== "free");

    const athleteIds = relationships.map((r) => r.athlete_id);
    const { data: profiles } = athleteIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", athleteIds).returns<Profile[]>()
      : { data: [] as Profile[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    const relIds = (relationships ?? []).map((r) => r.id);
    const { data: recentMessages } = relIds.length
      ? await supabase
          .from("coach_athlete_messages")
          .select("coach_athlete_id, body, image_path, created_at, sender_id, read_at")
          .in("coach_athlete_id", relIds)
          .order("created_at", { ascending: false })
          .returns<LastMessageRow[]>()
      : { data: [] as LastMessageRow[] };

    const lastByRel = new Map<string, LastMessageRow>();
    const unreadByRel = new Map<string, number>();
    for (const m of recentMessages ?? []) {
      if (!lastByRel.has(m.coach_athlete_id)) lastByRel.set(m.coach_athlete_id, m);
      if (!m.read_at && m.sender_id !== session.userId) {
        unreadByRel.set(m.coach_athlete_id, (unreadByRel.get(m.coach_athlete_id) ?? 0) + 1);
      }
    }

    return (
      <Container variant="content">
        <BackLink href="/coaching">Coaching</BackLink>
        <Heading>Messages</Heading>

        {isDualRole && ownCoachRelationship ? (
          <div className="mt-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Your Own Coach</p>
            <div className="mt-3">
              <Link href={`/coaching/messages/${ownCoachRelationship.id}`}>
                <Card padding="md" className="transition hover:border-black/20 dark:hover:border-white/20">
                  <p className="font-medium text-zinc-900 dark:text-white">Message {ownCoachRelationship.coachName}</p>
                </Card>
              </Link>
            </div>
          </div>
        ) : null}

        <div className={isDualRole ? "mt-10" : "mt-8"}>
          {isDualRole ? (
            <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
              Your Athletes
            </p>
          ) : null}
          {relationships && relationships.length > 0 ? (
            <div className="space-y-2">
              {relationships.map((rel) => {
                const last = lastByRel.get(rel.id);
                const unread = unreadByRel.get(rel.id) ?? 0;
                return (
                  <Link key={rel.id} href={`/coaching/messages/${rel.id}`}>
                    <Card padding="md" className="transition hover:border-black/20 dark:hover:border-white/20">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-zinc-900 dark:text-white">{nameById.get(rel.athlete_id) ?? "Athlete"}</p>
                        {unread > 0 ? <Badge tone="tip">{unread} new</Badge> : null}
                      </div>
                      {last ? (
                        <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
                          {last.body ?? "📷 Photo"} · {formatRelativeTime(last.created_at)}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">No messages yet.</p>
                      )}
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState>No athletes yet.</EmptyState>
          )}
        </div>
      </Container>
    );
  }

  // An athlete who isn't also a coach only ever has one active coach in
  // this MVP -- skip the list and go straight to the one conversation that
  // exists.
  if (ownCoachRelationship) redirect(`/coaching/messages/${ownCoachRelationship.id}`);
  redirect("/coaching");
}
