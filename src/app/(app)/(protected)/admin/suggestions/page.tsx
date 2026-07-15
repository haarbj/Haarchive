import type { Metadata } from "next";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { loadAllUsers } from "@/lib/admin/users";
import { sectionMap } from "@/lib/sections";
import { SUGGESTION_STATUS_LABELS, type SuggestionStatus } from "@/lib/content-suggestions/constants";
import { CITATION_STATUS_LABELS, type CitationStatus } from "@/lib/articles/constants";
import { ReviewSuggestionForm } from "./review-suggestion-form";
import { ReviewCitationForm } from "./review-citation-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Suggestions & Citations",
};

type SuggestionRow = {
  id: string;
  section_slug: string;
  suggestion: string;
  reason: string | null;
  status: SuggestionStatus;
  submitted_by: string | null;
};

type CitationRow = {
  id: string;
  paper_title: string;
  authors: string | null;
  year: number | null;
  link_or_doi: string | null;
  topic: string | null;
  claim_supported: string | null;
  status: CitationStatus;
  submitted_by: string | null;
};

export default async function AdminSuggestionsPage() {
  const admin = createServiceRoleClient();
  const [{ data: suggestions }, { data: citations }, users] = await Promise.all([
    admin
      .from("content_suggestions")
      .select("id, section_slug, suggestion, reason, status, submitted_by")
      .order("created_at", { ascending: false })
      .returns<SuggestionRow[]>(),
    admin
      .from("article_citations")
      .select("id, paper_title, authors, year, link_or_doi, topic, claim_supported, status, submitted_by")
      .is("article_id", null)
      .order("created_at", { ascending: false })
      .returns<CitationRow[]>(),
    loadAllUsers(),
  ]);

  const nameById = new Map(users.map((u) => [u.id, u.displayName]));

  return (
    <Container variant="dashboard">
      <BackLink href="/admin">Back to Admin</BackLink>
      <Heading>Suggestions & Citations</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Nothing here changes a Foundations page automatically — accepting a suggestion or citation just marks
        it reviewed; integrating it into the actual page content is still a manual edit.
      </p>

      <div className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Foundations suggestions</h2>
        {(suggestions ?? []).length > 0 ? (
          (suggestions ?? []).map((s) => (
            <Card key={s.id} padding="md">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                {sectionMap.get(s.section_slug)?.title ?? s.section_slug}
              </p>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{s.suggestion}</p>
              {s.reason ? (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Reason: {s.reason}</p>
              ) : null}
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {s.submitted_by ? (nameById.get(s.submitted_by) ?? "Runner") : "Runner"} ·{" "}
                {SUGGESTION_STATUS_LABELS[s.status]}
              </p>
              {s.status === "open" ? <ReviewSuggestionForm id={s.id} /> : null}
            </Card>
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No suggestions yet.</p>
        )}
      </div>

      <div className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Research citations</h2>
        {(citations ?? []).length > 0 ? (
          (citations ?? []).map((c) => (
            <Card key={c.id} padding="md">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{c.paper_title}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {c.authors ?? ""}
                {c.year ? ` (${c.year})` : ""}
                {c.link_or_doi ? ` · ${c.link_or_doi}` : ""}
              </p>
              {c.topic ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Topic: {c.topic}</p> : null}
              {c.claim_supported ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Claim: {c.claim_supported}</p>
              ) : null}
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {c.submitted_by ? (nameById.get(c.submitted_by) ?? "Runner") : "Runner"} ·{" "}
                {CITATION_STATUS_LABELS[c.status]}
              </p>
              {c.status === "submitted" ? <ReviewCitationForm id={c.id} /> : null}
            </Card>
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No citations submitted.</p>
        )}
      </div>
    </Container>
  );
}
