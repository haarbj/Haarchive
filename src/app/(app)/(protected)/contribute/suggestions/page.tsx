import type { Metadata } from "next";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { listFoundationsSuggestionTargets } from "@/lib/content-suggestions/foundations-targets";
import { SUGGESTION_STATUS_LABELS, type SuggestionStatus } from "@/lib/content-suggestions/constants";
import { CITATION_STATUS_LABELS, type CitationStatus } from "@/lib/articles/constants";
import { sectionMap } from "@/lib/sections";
import { SuggestionForm } from "./suggestion-form";
import { CitationForm } from "./citation-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Suggestions & Citations",
};

type SuggestionRow = { id: string; section_slug: string; suggestion: string; status: SuggestionStatus };
type CitationRow = { id: string; paper_title: string; status: CitationStatus };

export default async function SuggestionsPage() {
  const session = await getAppSession(); // non-null: contribute/layout.tsx already gated
  const admin = createServiceRoleClient();

  const [{ data: mySuggestions }, { data: myCitations }] = await Promise.all([
    admin
      .from("content_suggestions")
      .select("id, section_slug, suggestion, status")
      .eq("submitted_by", session!.userId)
      .order("created_at", { ascending: false })
      .returns<SuggestionRow[]>(),
    admin
      .from("article_citations")
      .select("id, paper_title, status")
      .eq("submitted_by", session!.userId)
      .is("article_id", null)
      .order("created_at", { ascending: false })
      .returns<CitationRow[]>(),
  ]);

  const targets = listFoundationsSuggestionTargets();

  return (
    <Container variant="dashboard">
      <BackLink href="/contribute">Back to Contribute</BackLink>
      <Heading>Suggestions & Citations</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Foundations pages stay hand-curated, but you can flag what should change and why — an admin reviews
        it and integrates the change manually. Citations here aren&rsquo;t tied to any specific article.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Card padding="md">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Suggest a Foundations update</h2>
          <div className="mt-4">
            <SuggestionForm targets={targets} />
          </div>
        </Card>

        <Card padding="md">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Submit a research citation</h2>
          <div className="mt-4">
            <CitationForm />
          </div>
        </Card>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            Your suggestions
          </h2>
          <div className="mt-3 space-y-2">
            {(mySuggestions ?? []).length > 0 ? (
              (mySuggestions ?? []).map((s) => (
                <Card key={s.id} padding="sm">
                  <p className="text-sm text-zinc-900 dark:text-white">{s.suggestion}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {sectionMap.get(s.section_slug)?.title ?? s.section_slug} · {SUGGESTION_STATUS_LABELS[s.status]}
                  </p>
                </Card>
              ))
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing submitted yet.</p>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            Your citations
          </h2>
          <div className="mt-3 space-y-2">
            {(myCitations ?? []).length > 0 ? (
              (myCitations ?? []).map((c) => (
                <Card key={c.id} padding="sm">
                  <p className="text-sm text-zinc-900 dark:text-white">{c.paper_title}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{CITATION_STATUS_LABELS[c.status]}</p>
                </Card>
              ))
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing submitted yet.</p>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}
