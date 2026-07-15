import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

type ProfileRow = { display_name: string; avatar_url: string | null };
type ContributorRow = { title: string | null; bio: string | null; expertise: string[] };
type PublishedArticleRow = { slug: string; title: string; subtitle: string | null };

async function loadContributor(id: string) {
  const supabase = await createClient();
  const [{ data: profile }, { data: contributor }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", id).maybeSingle<ProfileRow>(),
    supabase
      .from("contributor_profiles")
      .select("title, bio, expertise")
      .eq("user_id", id)
      .maybeSingle<ContributorRow>(),
  ]);
  // Only a real, filled-out contributor_profiles row makes this page exist
  // publicly -- someone who merely holds the content_contributor/reviewer
  // permission but hasn't saved a profile yet has no public page to guess at.
  if (!profile || !contributor) return null;
  return { profile, contributor };
}

// article_contributors_select_published (RLS) already restricts this to
// rows belonging to a published article, so there's no need for the
// service-role client here -- same public-read boundary as the article
// bylines themselves.
async function loadPublishedArticlesByAuthor(userId: string): Promise<PublishedArticleRow[]> {
  const supabase = await createClient();
  const { data: contributorRows } = await supabase
    .from("article_contributors")
    .select("article_id")
    .eq("user_id", userId)
    .eq("contributor_role", "author")
    .returns<{ article_id: string }[]>();

  const articleIds = (contributorRows ?? []).map((row) => row.article_id);
  if (articleIds.length === 0) return [];

  const { data: articles } = await supabase
    .from("articles")
    .select("slug, title, subtitle, published_at")
    .in("id", articleIds)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .returns<(PublishedArticleRow & { published_at: string | null })[]>();

  return articles ?? [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await loadContributor(id);
  return { title: result?.profile.display_name ?? "Contributor" };
}

export default async function ContributorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadContributor(id);
  if (!result) notFound();
  const { profile, contributor } = result;
  const articles = await loadPublishedArticlesByAuthor(id);

  return (
    <Container variant="content">
      <div className="flex items-center gap-5">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL, see contributor-profile-form.tsx
          <img
            src={profile.avatar_url}
            alt=""
            className="h-20 w-20 rounded-full border border-black/10 object-cover dark:border-white/10"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-black/5 dark:bg-white/10" />
        )}
        <div>
          <Heading variant="compact">{profile.display_name}</Heading>
          {contributor.title && (
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">{contributor.title}</p>
          )}
        </div>
      </div>

      {contributor.bio && (
        <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{contributor.bio}</p>
      )}

      {contributor.expertise.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            Areas of expertise
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {contributor.expertise.map((item) => (
              <span
                key={item}
                className="rounded-full border border-black/10 px-3 py-1 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-200"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          Articles
        </p>
        {articles.length > 0 ? (
          <div className="mt-3 space-y-2">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/${article.slug}`}
                className="block rounded-lg border border-black/10 px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-card-hover dark:border-white/10"
              >
                <p className="font-semibold text-zinc-900 dark:text-white">{article.title}</p>
                {article.subtitle ? (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{article.subtitle}</p>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">No published articles yet.</p>
        )}
      </div>
    </Container>
  );
}
