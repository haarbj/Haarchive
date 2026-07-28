import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { isAdminEmail } from "@/lib/auth/session";
import { ARTICLE_STATUS_LABELS, type ArticleStatus } from "@/lib/articles/constants";
import { formatClock, formatDate, formatDistance, formatRelativeTime } from "@/lib/format";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "User Detail",
};

// Fixed at the access-control migration's own seed id -- same constant
// admin/users/page.tsx and admin/actions.ts already use.
const BRONCOS_TEAM_ID = "00000000-0000-0000-0000-000000000001";

type PageProps = { params: Promise<{ id: string }> };

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const admin = createServiceRoleClient();

  const { data: authUser } = await admin.auth.admin.getUserById(id);
  if (!authUser?.user) notFound();

  const [
    { data: profile },
    { data: athleteProfile },
    { data: communityProfile },
    { data: contributorProfile },
    { data: memberships },
    { data: permissionRows },
    { data: goals },
    { data: raceResults },
    { data: injuries },
    { data: trainingPlans },
    { data: connectedAccounts },
    { data: savedCalculations },
    { data: authoredArticles },
    { data: articleContributorRows },
    { data: contentSuggestions },
  ] = await Promise.all([
    admin.from("profiles").select("display_name, avatar_url, units, created_at").eq("id", id).maybeSingle(),
    admin
      .from("athlete_profiles")
      .select("birth_year, weight_kg, current_weekly_mileage, running_days_per_week")
      .eq("user_id", id)
      .maybeSingle(),
    admin.from("community_profiles").select("bio, location").eq("user_id", id).maybeSingle(),
    admin.from("contributor_profiles").select("title, bio").eq("user_id", id).maybeSingle(),
    admin.from("team_memberships").select("team_id, role").eq("user_id", id).returns<{ team_id: string; role: string }[]>(),
    admin.from("user_permissions").select("permission").eq("user_id", id).returns<{ permission: string }[]>(),
    admin
      .from("goals")
      .select("id, race_name, distance_m, goal_time_s, goal_date")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .returns<{ id: string; race_name: string; distance_m: number; goal_time_s: number | null; goal_date: string | null }[]>(),
    admin
      .from("race_results")
      .select("id, race_name, race_date, distance_m, finish_time_s")
      .eq("user_id", id)
      .order("race_date", { ascending: false })
      .returns<{ id: string; race_name: string; race_date: string; distance_m: number; finish_time_s: number }[]>(),
    admin
      .from("injuries")
      .select("id, injury_type, body_part, start_date, end_date, affects_training")
      .eq("user_id", id)
      .order("start_date", { ascending: false })
      .returns<{ id: string; injury_type: string; body_part: string; start_date: string; end_date: string | null; affects_training: boolean }[]>(),
    admin
      .from("training_plans")
      .select("id, name, status, start_date, end_date")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .returns<{ id: string; name: string; status: string; start_date: string; end_date: string }[]>(),
    admin
      .from("connected_accounts")
      .select("provider, last_synced_at")
      .eq("user_id", id)
      .returns<{ provider: string; last_synced_at: string | null }[]>(),
    admin.from("saved_calculations").select("id").eq("user_id", id).returns<{ id: string }[]>(),
    admin
      .from("articles")
      .select("id, slug, title, status")
      .eq("primary_author_id", id)
      .order("created_at", { ascending: false })
      .returns<{ id: string; slug: string; title: string; status: ArticleStatus }[]>(),
    admin
      .from("article_contributors")
      .select("article_id, contributor_role, articles(id, slug, title, status)")
      .eq("user_id", id)
      .neq("contributor_role", "author")
      .returns<{ article_id: string; contributor_role: string; articles: { id: string; slug: string; title: string; status: ArticleStatus } | null }[]>(),
    admin
      .from("content_suggestions")
      .select("id, section_slug, status")
      .eq("submitted_by", id)
      .returns<{ id: string; section_slug: string; status: string }[]>(),
  ]);

  const email = authUser.user.email ?? "(no email)";
  const isAdmin = isAdminEmail(email);
  const isCoach = (memberships ?? []).some((m) => m.team_id === BRONCOS_TEAM_ID && m.role === "coach");
  const isAthlete = (memberships ?? []).some((m) => m.team_id === BRONCOS_TEAM_ID && m.role === "athlete");
  const permissions = new Set((permissionRows ?? []).map((p) => p.permission));

  let rosterCount = 0;
  if (isCoach) {
    const { count } = await admin
      .from("team_memberships")
      .select("id", { count: "exact", head: true })
      .eq("team_id", BRONCOS_TEAM_ID)
      .eq("role", "athlete");
    rosterCount = count ?? 0;
  }

  return (
    <Container variant="dashboard">
      <BackLink href="/admin/users">Back to Users</BackLink>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading>{profile?.display_name ?? "Runner"}</Heading>
          <p className="mt-1 text-zinc-600 dark:text-zinc-300">{email}</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Joined {profile?.created_at ? formatDate(profile.created_at) : "unknown"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <Badge tone="error">Admin</Badge>}
          {isCoach && <Badge tone="research">Coach</Badge>}
          {isAthlete && <Badge tone="tip">Athlete</Badge>}
          {permissions.has("content_contributor") && <Badge tone="success">Contributor</Badge>}
          {permissions.has("reviewer") && <Badge tone="warning">Reviewer</Badge>}
        </div>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {athleteProfile && (
          <Card padding="md">
            <h2 className="font-semibold text-zinc-900 dark:text-white">Athlete Profile</h2>
            <dl className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              {athleteProfile.birth_year && (
                <div className="flex justify-between">
                  <dt>Birth year</dt>
                  <dd>{athleteProfile.birth_year}</dd>
                </div>
              )}
              {athleteProfile.current_weekly_mileage != null && (
                <div className="flex justify-between">
                  <dt>Weekly mileage</dt>
                  <dd>{athleteProfile.current_weekly_mileage} mi</dd>
                </div>
              )}
              {athleteProfile.running_days_per_week != null && (
                <div className="flex justify-between">
                  <dt>Days/week</dt>
                  <dd>{athleteProfile.running_days_per_week}</dd>
                </div>
              )}
            </dl>
          </Card>
        )}

        {isCoach && (
          <Card padding="md">
            <h2 className="font-semibold text-zinc-900 dark:text-white">Coach Activity</h2>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              {rosterCount} athlete{rosterCount === 1 ? "" : "s"} on roster
            </p>
          </Card>
        )}

        {goals && goals.length > 0 && (
          <Card padding="md">
            <h2 className="font-semibold text-zinc-900 dark:text-white">Goals</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              {goals.map((g) => (
                <li key={g.id}>
                  {g.race_name} — {formatDistance(g.distance_m)}
                  {g.goal_time_s ? ` in ${formatClock(g.goal_time_s)}` : ""}
                  {g.goal_date ? ` · ${formatDate(g.goal_date)}` : ""}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {raceResults && raceResults.length > 0 && (
          <Card padding="md">
            <h2 className="font-semibold text-zinc-900 dark:text-white">
              Race Results <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">({raceResults.length})</span>
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              {raceResults.slice(0, 5).map((r) => (
                <li key={r.id}>
                  {r.race_name} — {formatDistance(r.distance_m)} in {formatClock(r.finish_time_s)} · {formatDate(r.race_date)}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {injuries && injuries.length > 0 && (
          <Card padding="md">
            <h2 className="font-semibold text-zinc-900 dark:text-white">
              Injuries <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">({injuries.length})</span>
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              {injuries.map((injury) => (
                <li key={injury.id}>
                  {injury.injury_type} ({injury.body_part}) — {formatDate(injury.start_date)}
                  {injury.end_date ? ` – ${formatDate(injury.end_date)}` : " – ongoing"}
                  {injury.affects_training ? " · affecting training" : ""}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {trainingPlans && trainingPlans.length > 0 && (
          <Card padding="md">
            <h2 className="font-semibold text-zinc-900 dark:text-white">
              Training Plans <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">({trainingPlans.length})</span>
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              {trainingPlans.slice(0, 5).map((plan) => (
                <li key={plan.id}>
                  {plan.name} — {plan.status} ({formatDate(plan.start_date)} – {formatDate(plan.end_date)})
                </li>
              ))}
            </ul>
          </Card>
        )}

        {connectedAccounts && connectedAccounts.length > 0 && (
          <Card padding="md">
            <h2 className="font-semibold text-zinc-900 dark:text-white">Connected Accounts</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              {connectedAccounts.map((acct) => (
                <li key={acct.provider} className="capitalize">
                  {acct.provider} — {acct.last_synced_at ? `synced ${formatRelativeTime(acct.last_synced_at)}` : "never synced"}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {savedCalculations && savedCalculations.length > 0 && (
          <Card padding="md">
            <h2 className="font-semibold text-zinc-900 dark:text-white">Saved Calculations</h2>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{savedCalculations.length} saved</p>
          </Card>
        )}

        {communityProfile && (communityProfile.bio || communityProfile.location) && (
          <Card padding="md">
            <h2 className="font-semibold text-zinc-900 dark:text-white">Community Profile</h2>
            {communityProfile.location && (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{communityProfile.location}</p>
            )}
            {communityProfile.bio && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{communityProfile.bio}</p>}
            <Link
              href={`/community/${id}`}
              className="mt-2 inline-block text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
            >
              View public profile →
            </Link>
          </Card>
        )}

        {(contributorProfile || (authoredArticles && authoredArticles.length > 0)) && (
          <Card padding="md">
            <h2 className="font-semibold text-zinc-900 dark:text-white">Contributor Activity</h2>
            {contributorProfile?.title && (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{contributorProfile.title}</p>
            )}
            {authoredArticles && authoredArticles.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                {authoredArticles.map((article) => (
                  <li key={article.id}>
                    <Link
                      href={`/admin/articles/${article.id}`}
                      className="underline decoration-black/20 underline-offset-2 hover:decoration-black dark:decoration-white/20 dark:hover:decoration-white"
                    >
                      {article.title}
                    </Link>{" "}
                    — {ARTICLE_STATUS_LABELS[article.status]}
                  </li>
                ))}
              </ul>
            )}
            {articleContributorRows && articleContributorRows.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                {articleContributorRows
                  .filter((row) => row.articles)
                  .map((row) => (
                    <li key={row.article_id}>
                      {row.contributor_role === "reviewer" ? "Reviewing" : "Contributing to"}{" "}
                      <Link
                        href={`/admin/articles/${row.articles!.id}`}
                        className="underline decoration-black/20 underline-offset-2 hover:decoration-black dark:decoration-white/20 dark:hover:decoration-white"
                      >
                        {row.articles!.title}
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
            {contentSuggestions && contentSuggestions.length > 0 && (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                {contentSuggestions.length} content suggestion{contentSuggestions.length === 1 ? "" : "s"} submitted
              </p>
            )}
          </Card>
        )}
      </div>
    </Container>
  );
}
