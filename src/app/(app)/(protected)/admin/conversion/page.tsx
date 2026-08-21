import type { Metadata } from "next";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { formatRelativeTime } from "@/lib/format";
import { summarizeConversionEvents, KNOWN_FEATURES, type ConversionEventRow } from "@/lib/conversion/aggregate";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Conversion Funnel",
};

// A row-count cap, not pagination -- matches admin/bug-reports' own
// precedent for a small internal review surface, and this page only ever
// needs aggregate counts, never the full row list rendered on screen.
// High enough that hitting it during this feature's early life would
// itself be a signal worth noticing.
const MAX_EVENTS = 20_000;

const FEATURE_LABELS: Record<string, string> = {
  knowledge_check: "Knowledge Check",
  bookmark: "Bookmark",
  notes: "Notes",
  learning_progress: "Learning Progress",
  project: "Project",
  calculator: "Calculator",
  other: "Other / unrecognized",
};

export default async function AdminConversionPage() {
  // conversion_events has exactly one RLS policy (insert, for anon +
  // authenticated -- see its migration) and no select policy for anyone
  // but service-role. This page is already gated on isAdmin by
  // admin/layout.tsx, so the service-role read here is safe, matching
  // admin/bug-reports' and admin/page.tsx's own precedent exactly.
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("conversion_events")
    .select("event_type, feature, user_id, anon_id, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_EVENTS)
    .returns<ConversionEventRow[]>();

  const summary = summarizeConversionEvents(data ?? []);

  return (
    <Container variant="dashboard">
      <BackLink href="/admin">Back to Admin</BackLink>
      <Heading>Conversion Funnel</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Aggregate counts only, from every anonymous/authenticated interaction with an existing &ldquo;Sign in to
        &hellip;&rdquo; CTA. No per-visitor or per-account detail is shown here.
      </p>

      {summary.totalEvents === 0 ? (
        <div className="mt-10">
          <EmptyState>
            No conversion events recorded yet. This is expected immediately after shipping the instrumentation --
            check back once real traffic has had a chance to hit the site.
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
            {summary.totalEvents} event{summary.totalEvents === 1 ? "" : "s"} recorded
            {summary.dateRange.earliest && summary.dateRange.latest ? (
              <>
                {" "}
                from {formatRelativeTime(summary.dateRange.earliest)} to {formatRelativeTime(summary.dateRange.latest)}.
              </>
            ) : null}
          </p>

          {/* ---------- Overall funnel ---------- */}
          <section className="mt-10">
            <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              Overall funnel
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Card padding="sm">
                <p className="text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">CTA shown</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{summary.overall.cta_shown}</p>
              </Card>
              <Card padding="sm">
                <p className="text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">CTA clicked</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{summary.overall.cta_clicked}</p>
              </Card>
              <Card padding="sm">
                <p className="text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
                  Google signup clicked
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                  {summary.overall.google_signup_clicked}
                </p>
              </Card>
              <Card padding="sm">
                <p className="text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
                  Accounts created
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                  {summary.overall.account_created}
                </p>
              </Card>
              <Card padding="sm">
                <p className="text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
                  First learning action
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                  {summary.overall.first_learning_action}
                </p>
              </Card>
            </div>
            {summary.overall.other > 0 && (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                {summary.overall.other} event{summary.overall.other === 1 ? "" : "s"} with an unrecognized event
                type (not shown above, not dropped).
              </p>
            )}
            {/* Deliberately no funnel percentage/conversion-rate math here --
                anon_id does persist across a single browser session (the
                same httpOnly cookie survives the OAuth redirect round trip),
                but google_signup_clicked and account_created are not
                recorded against a specific originating feature (see
                aggregate.ts's own header comment), so a computed "X% of CTA
                clicks became accounts" figure would silently assume an
                attribution this schema doesn't actually support. */}
            <p className="mt-4 max-w-2xl text-xs text-zinc-500 dark:text-zinc-400">
              Google signup and account creation are not broken down by feature below -- the current schema
              records which page a Google signup was clicked from, but not which specific CTA (if any) led there,
              so a per-feature signup/account count would imply an attribution the data doesn&rsquo;t actually
              support.
            </p>
          </section>

          {/* ---------- By feature ---------- */}
          <section className="mt-10">
            <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              By feature
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-left text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:border-white/10 dark:text-zinc-300">
                    <th className="py-2 pr-4">Feature</th>
                    <th className="py-2 pr-4">CTA shown</th>
                    <th className="py-2 pr-4">CTA clicked</th>
                    <th className="py-2">First learning action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...KNOWN_FEATURES, "other"].map((feature) => {
                    const row = summary.byFeature[feature];
                    if (feature === "other" && row.ctaShown === 0 && row.ctaClicked === 0 && row.firstLearningAction === 0) {
                      return null;
                    }
                    return (
                      <tr key={feature} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                        <td className="py-2 pr-4 font-medium text-zinc-900 dark:text-white">
                          {FEATURE_LABELS[feature] ?? feature}
                          {feature === "project" && (
                            <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                              (no live CTA yet)
                            </span>
                          )}
                          {feature === "calculator" && (
                            <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                              (CTA not currently reachable -- see report)
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-200">{row.ctaShown}</td>
                        <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-200">{row.ctaClicked}</td>
                        <td className="py-2 text-zinc-700 dark:text-zinc-200">{row.firstLearningAction}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Container>
  );
}
