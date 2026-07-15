import type { Metadata } from "next";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { formatRelativeTime } from "@/lib/format";
import { CreateInviteForm } from "./create-invite-form";
import { BackLink } from "@/components/ui/back-link";
import { CardLink } from "@/components/ui/card-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Admin",
};

type CoachInvite = {
  id: string;
  email: string;
  created_at: string;
  redeemed_at: string | null;
};

export default async function AdminPage() {
  // coach_invites has zero RLS policies for authenticated/anon by design
  // (see the access-control migration) -- this page is already gated on
  // isAdmin by admin/layout.tsx, so the service-role read here is safe.
  const admin = createServiceRoleClient();
  const { data: invites } = await admin
    .from("coach_invites")
    .select("id, email, created_at, redeemed_at")
    .order("created_at", { ascending: false })
    .returns<CoachInvite[]>();

  return (
    <Container variant="dashboard">
      <BackLink href="/dashboard">Back to Dashboard</BackLink>
      <Heading>Admin</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Invite coaches. Athletes with an @brophybroncos.org email join automatically, no invite needed.
      </p>

      <div className="mt-10 space-y-8">
        <CardLink href="/admin/questions" className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">Questions</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Triage reader questions and topic suggestions into the content pipeline.
            </p>
          </div>
          <span className="text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
            Open →
          </span>
        </CardLink>

        <CardLink href="/admin/users" className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              Users & Permissions
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Grant Content Contributor, Reviewer, and Training Dashboard access.
            </p>
          </div>
          <span className="text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
            Open →
          </span>
        </CardLink>

        <CardLink href="/admin/articles" className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">Articles</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Manage contributors, review status, and publish drafts.
            </p>
          </div>
          <span className="text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
            Open →
          </span>
        </CardLink>

        <CardLink href="/admin/suggestions" className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              Suggestions & Citations
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Review Foundations page suggestions and research citation submissions.
            </p>
          </div>
          <span className="text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
            Open →
          </span>
        </CardLink>

        <CardLink href="/admin/contributor-applications" className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              Contributor Applications
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Review and approve requests to write, answer questions, or review submissions.
            </p>
          </div>
          <span className="text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
            Open →
          </span>
        </CardLink>

        <CardLink href="/admin/messages" className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">Messages</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Read messages sent through the /contact form.
            </p>
          </div>
          <span className="text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
            Open →
          </span>
        </CardLink>

        <CreateInviteForm />

        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            Coach invites
          </p>
          {invites && invites.length > 0 ? (
            <div className="mt-3 space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-zinc-900"
                >
                  <span className="font-medium text-zinc-900 dark:text-white">{invite.email}</span>
                  <span className="text-zinc-600 dark:text-zinc-300">
                    {invite.redeemed_at ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Redeemed {formatRelativeTime(invite.redeemed_at)}
                      </span>
                    ) : (
                      <span>Created {formatRelativeTime(invite.created_at)} · pending</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">No invites yet.</p>
          )}
        </div>
      </div>
    </Container>
  );
}
