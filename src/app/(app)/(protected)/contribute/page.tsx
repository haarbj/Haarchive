import type { Metadata } from "next";

import { getAppSession } from "@/lib/auth/session";
import { hasContentPermission } from "@/lib/auth/permissions";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";

export const metadata: Metadata = {
  title: "Contribute",
};

// The contributor home base -- gated by contribute/layout.tsx. Phase 1 only
// ships permissions + this landing page; the cards below become real
// features (drafts, review queue, assigned questions, suggestions) in later
// phases, but the entry point exists now since contributor experience was
// explicitly prioritized over further admin tooling.
export default async function ContributePage() {
  const session = await getAppSession();
  const isContributor = hasContentPermission(session?.permissions ?? [], "content_contributor");
  const isReviewer = hasContentPermission(session?.permissions ?? [], "reviewer");

  return (
    <Container variant="dashboard">
      <Heading>Contribute</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        This is where trusted athletes, coaches, and researchers help improve Haarchive&rsquo;s content.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold tracking-wide uppercase">
        {session?.isAdmin && (
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900">
            Admin
          </span>
        )}
        {isContributor && (
          <span className="rounded-full border border-black/10 px-3 py-1 text-zinc-700 dark:border-white/10 dark:text-zinc-200">
            Content Contributor
          </span>
        )}
        {isReviewer && (
          <span className="rounded-full border border-black/10 px-3 py-1 text-zinc-700 dark:border-white/10 dark:text-zinc-200">
            Reviewer
          </span>
        )}
      </div>

      <div className="mt-10 space-y-4">
        <CardLink href="/contribute/profile" className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">My Profile</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Set your bio, title, expertise, and profile picture — shown publicly once you&rsquo;re
              credited on an article.
            </p>
          </div>
          <span className="text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
            Open →
          </span>
        </CardLink>

        <CardLink href="/contribute/articles" className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">My Drafts</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Create and edit article drafts, then submit them for review.
            </p>
          </div>
          <span className="text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
            Open →
          </span>
        </CardLink>

        {isReviewer || session?.isAdmin ? (
          <CardLink href="/contribute/review" className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">Review Queue</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Review drafts and leave feedback.
              </p>
            </div>
            <span className="text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
              Open →
            </span>
          </CardLink>
        ) : null}
        <Card padding="md">
          <p className="font-semibold text-zinc-900 dark:text-white">Assigned Questions</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Help answer reader questions assigned to you. Coming soon.
          </p>
        </Card>
        <CardLink href="/contribute/suggestions" className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              Suggestions & Citations
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Suggest improvements to Foundations pages and submit research citations.
            </p>
          </div>
          <span className="text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
            Open →
          </span>
        </CardLink>
      </div>
    </Container>
  );
}
