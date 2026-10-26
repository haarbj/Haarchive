import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { MessageThread } from "./message-thread";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

type RelationshipRow = { coach_id: string; athlete_id: string; tier: "free" | "paid" };
type Profile = { display_name: string; coach_display_name: string | null };
type MessageRow = {
  id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
  read_at: string | null;
};

export default async function MessageThreadPage({ params }: { params: Promise<{ coachAthleteId: string }> }) {
  const session = await getAppSession();
  if (!session) return null;
  const { coachAthleteId } = await params;

  const supabase = await createClient();
  // coach_athletes_select_as_coach / _select_as_athlete already scope this
  // to relationships the caller is actually part of.
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("coach_id, athlete_id, tier")
    .eq("id", coachAthleteId)
    .maybeSingle<RelationshipRow>();
  if (!relationship) notFound();
  // Free-tier barrier, defense in depth: messaging is paid-only, so even
  // a direct URL to a free-tier relationship's thread 404s rather than
  // rendering a composer that shouldn't exist for it.
  if (relationship.tier === "free") notFound();

  const viewerIsAthlete = session.userId === relationship.athlete_id;
  const otherUserId = viewerIsAthlete ? relationship.coach_id : relationship.athlete_id;
  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("display_name, coach_display_name")
    .eq("id", otherUserId)
    .maybeSingle<Profile>();
  // coach_display_name only ever applies when the athlete is looking at
  // their coach -- the coach viewing their athlete always sees the
  // athlete's regular display_name, which has no coach-identity concept.
  const otherName = viewerIsAthlete
    ? otherProfile?.coach_display_name || otherProfile?.display_name
    : otherProfile?.display_name;

  // error is passed through (not discarded) -- a real query failure (a
  // missing column from an unapplied migration, an RLS surprise, etc.)
  // must not render indistinguishably from "this conversation has no
  // messages yet." Caught live on staging: an unapplied migration broke
  // this exact query, and silently falling back to an empty array made it
  // look like the message never sent rather than like something was
  // actually broken.
  const { data: messages, error: messagesError } = await supabase
    .from("coach_athlete_messages")
    .select("id, sender_id, body, image_path, created_at, read_at")
    .eq("coach_athlete_id", coachAthleteId)
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();

  return (
    <Container variant="content">
      {/* An athlete only ever has one active coach in this MVP (see
          MessagesIndexPage), so /coaching/messages would just redirect
          straight back to this same thread -- a "Messages" back-link that
          loops to itself. Send them to their coaching home instead, which
          is a real place to go back to. */}
      <BackLink href={viewerIsAthlete ? "/coaching" : "/coaching/messages"}>
        {viewerIsAthlete ? "My Coaching" : "Messages"}
      </BackLink>
      <Heading>{otherName ?? "Conversation"}</Heading>
      <div className="mt-8">
        <MessageThread
          coachAthleteId={coachAthleteId}
          currentUserId={session.userId}
          initialMessages={messages ?? []}
          initialLoadError={messagesError ? messagesError.message : null}
        />
      </div>
    </Container>
  );
}
