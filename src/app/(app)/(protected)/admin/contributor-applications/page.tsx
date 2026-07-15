import type { Metadata } from "next";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { CONTRIBUTION_TYPE_LABELS, type ContributionType } from "@/lib/validation/contributor-application";
import { ReviewApplicationForm } from "./review-application-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contributor Applications",
};

type ApplicationStatus = "pending" | "approved" | "rejected";

type Application = {
  id: string;
  name: string;
  email: string;
  contribution_types: ContributionType[];
  background: string;
  topic_idea: string | null;
  motivation: string;
  status: ApplicationStatus;
  admin_notes: string | null;
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function AdminContributorApplicationsPage() {
  const admin = createServiceRoleClient();
  const { data: applications } = await admin
    .from("contributor_applications")
    .select("id, name, email, contribution_types, background, topic_idea, motivation, status, admin_notes")
    .order("created_at", { ascending: false })
    .returns<Application[]>();

  return (
    <Container variant="dashboard">
      <BackLink href="/admin">Back to Admin</BackLink>
      <Heading>Contributor Applications</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Approving grants Content Contributor access immediately — the applicant needs an account (signed up
        with the same email) before that can take effect.
      </p>

      <div className="mt-10 space-y-4">
        {(applications ?? []).length > 0 ? (
          (applications ?? []).map((a) => (
            <Card key={a.id} padding="md">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{a.name}</p>
                  <a
                    href={`mailto:${a.email}`}
                    className="text-sm text-zinc-600 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-zinc-300 dark:decoration-white/30 dark:hover:decoration-white/70"
                  >
                    {a.email}
                  </a>
                </div>
                <p className="text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">
                  {STATUS_LABELS[a.status]}
                </p>
              </div>

              <p className="mt-3 text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">
                Wants to: {a.contribution_types.map((t) => CONTRIBUTION_TYPE_LABELS[t] ?? t).join(", ")}
              </p>

              <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
                <p>
                  <span className="font-semibold">Background:</span> {a.background}
                </p>
                {a.topic_idea ? (
                  <p>
                    <span className="font-semibold">Topic idea / sample:</span> {a.topic_idea}
                  </p>
                ) : null}
                <p>
                  <span className="font-semibold">Why:</span> {a.motivation}
                </p>
                {a.admin_notes ? (
                  <p className="text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold">Admin notes:</span> {a.admin_notes}
                  </p>
                ) : null}
              </div>

              {a.status === "pending" ? <ReviewApplicationForm id={a.id} /> : null}
            </Card>
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No applications yet.</p>
        )}
      </div>
    </Container>
  );
}
