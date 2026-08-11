# The Haarchive — SEO Audit

Status: **research and recommendations only. No code has been changed.** Every factual claim below was verified directly against the current codebase — grep/read citations are given as `file:line` throughout, in the same style as `docs/haarchive-ecosystem-audit.md`. Where something wasn't found, that's stated as a verified absence, not an assumption.

---

## 1. Executive summary

The Haarchive's content is genuinely strong for SEO in a way most sites in this space aren't: real cited research, a coherent topic hierarchy across 8 categories and 36 hand-authored pages, cross-linking between them (`src/lib/glossary.ts`, `src/lib/section-linkify.tsx`), and a deep Coaching/Athlete Library that's a real point of differentiation (no generic running blog has 7 coaching philosophies written with even-handed criticism/response pairs and named disagreements between them). That content simply isn't wearing any technical SEO infrastructure yet. There is:

- **No `robots.txt`** (verified absence — no `public/robots.txt`, no `src/app/robots.ts`).
- **No XML sitemap** (verified absence — no `src/app/sitemap.ts`, no static `public/sitemap.xml`).
- **No canonical URLs anywhere** — zero `alternates.canonical` in any of the 11 `generateMetadata` implementations or 30+ static `metadata` exports.
- **No structured data / JSON-LD anywhere** — zero occurrences in the entire codebase, despite the site already having the exact data (author bylines, citations, article dates, breadcrumb navigation, FAQ content) that would make `Article`, `BreadcrumbList`, and `FAQPage` schema close to a data-mapping exercise rather than new work.
- **The homepage itself (`src/app/page.tsx`) has no page-specific metadata at all** — it's the one page on the site relying entirely on the generic site-wide fallback in `layout.tsx`.
- **Every authenticated app page (~35 routes: dashboard, admin/\*, coach/\*, contribute/\*, settings, plan) has ordinary indexable metadata and no `noindex`** — real content is protected by a server-side login redirect, but nothing tells a crawler these URLs aren't meant to be indexed at all.

None of this requires touching the site's actual content, voice, or URLs. It's the kind of gap that's invisible until you go looking for it and then explains a lot at once — this is a content-rich site that would plausibly rank well once search engines can actually understand its structure, and right now they largely can't.

## 2. Current SEO architecture

**Framework**: Next.js 16, App Router, Server Components/Actions (confirmed in `README.md`, `package.json`). All content-library routes are server-rendered by default — no client-side-only rendering blocking crawlability for the pages that matter (calculators are `"use client"` but their surrounding page shells, and every educational page, render server-side).

**Metadata mechanism**: the built-in Next.js Metadata API only — `export const metadata` (static) or `export async function generateMetadata()` (dynamic), no third-party SEO package, no manual `<head>` tags. `src/app/layout.tsx` sets sitewide defaults (`title.default`, `title.template: "%s | The Haarchive"`, a real `siteDescription`, and sitewide `openGraph`/`twitter` blocks pointing at one static `/opengraph-image.png`) that every page inherits unless it overrides.

**Routing / page types** (see `src/app/` directly):
- `src/app/[slug]/page.tsx` — one generic template serving four distinct things: a category landing page, a hand-authored section page (`sections.ts`), a section with an embedded interactive tool, and a database-backed published article. This one file's `generateMetadata` (lines 199–253) covers the large majority of the site's real indexable URLs.
- `src/app/coaching-library/[coach]/page.tsx`, `src/app/athlete-library/[athlete]/page.tsx`, `src/app/training-plans/[plan]/page.tsx` — dedicated dynamic routes for the three structured-data libraries, each with `generateStaticParams` (confirmed via the build output: 7 coach pages, 4 athlete pages, 10 training-plan pages are all prerendered as static HTML).
- `src/app/community/[id]/page.tsx`, `src/app/contributors/[id]/page.tsx` — public, user-generated profile pages.
- Static utility pages with their own `export const metadata`: `/about`, `/faq`, `/privacy-policy`, `/release-notes`, `/search`, `/questions`, `/questions/ask`.
- `src/app/(app)/(protected)/*` — ~35 authenticated app routes (dashboard, admin, coach, contribute, settings, plan), gated by a server-side `redirect("/login")` in `(protected)/layout.tsx:11–15`, not middleware (no `middleware.ts` exists in the repo at all).

**Content model powering the metadata**: `src/lib/sections.ts`'s `Section`/`Category` types carry `title` and `mission` (used directly as page title/description), plus an optional `lastUpdated: string` field populated on 22 of the 36 sections — currently read nowhere in any metadata generation.

## 3. Critical issues

| # | Issue | Evidence | Classification |
|---|---|---|---|
| 1 | No `robots.txt` | Verified absent from `public/` and `src/app/` | **CRITICAL** |
| 2 | No XML sitemap | Verified absent | **CRITICAL** |
| 3 | No canonical URLs anywhere | Zero `alternates` in any metadata export, checked across all 11 `generateMetadata` calls | **CRITICAL** |
| 4 | `/articles?tag=X` (and any future tag-filtered index) serves identical `title`/`description` to the unfiltered page, with no canonical pointing back | `src/app/[slug]/page.tsx:199-223` (metadata) vs. `:257,329,450` (tag filtering logic) — the metadata function never reads `searchParams` | **HIGH** (duplicate-content risk, not critical on its own, but compounds with #3's total absence of canonicals) |
| 5 | No structured data anywhere | Zero `application/ld+json` / schema.org references in the codebase | **HIGH** |

(Full classified list continues in §9 — Technical SEO Findings.)

## 4. High-impact opportunities

Ranked by impact-to-effort; full detail in §7's opportunity table.

1. Ship `robots.txt` + `sitemap.ts` (near-zero effort, unblocks everything downstream).
2. Add `alternates.canonical` to the existing metadata functions (mechanical, touches 11 files).
3. Add `Article`/`BreadcrumbList`/`FAQPage` JSON-LD (the data already exists — this is a mapping exercise, not new content work).
4. Add `robots: { index: false }` to the ~35 authenticated app routes.
5. Give the homepage its own deliberate metadata instead of the generic fallback.
6. Surface `lastUpdated` as `openGraph.modifiedTime` / `dateModified` schema on the 22 sections that already have it.
7. Enforce real alt text on contributor-uploaded article images (currently optional, defaults to `""`).
8. Build the missing pillar/hub layer described in §6 — the site has strong clusters and almost no pillar pages tying them together for a crawler (or a reader) to follow.

## 5. Top 10 recommended changes

1. **`robots.txt`** disallowing `/dashboard`, `/admin`, `/coach`, `/contribute`, `/settings`, `/plan`, `/login`, `/signup`, `/pending`, `/search` (query-param results), allowing everything else, pointing at the sitemap.
2. **`sitemap.ts`** covering all `sections.ts` entries, all published articles, all coach/athlete/training-plan pages, `/about`, `/faq`, `/privacy-policy`, `/questions`. Use each entry's real `lastUpdated`/`publishedAt` where available.
3. **Canonical URLs** on every existing `generateMetadata`/`metadata` export — mechanical, one `alternates: { canonical: ... }` line per page type.
4. **`noindex` on authenticated app routes** — a `robots` metadata field on `(protected)/layout.tsx`'s route group (or per-page) belt-and-suspenders alongside the `robots.txt` disallow.
5. **`Article` JSON-LD** on database-backed articles (author, `datePublished`, citations already modeled in `article_citations` — this is real E-E-A-T signal the site already has and isn't surfacing).
6. **`BreadcrumbList` JSON-LD** to pair with the visual breadcrumb nav that already exists (`article-overview.tsx:35`, `article-layout.tsx:59-74`) — genuinely close to free.
7. **Homepage-specific metadata** in `src/app/page.tsx` instead of inheriting the generic layout default.
8. **A canonical tag on `/[slug]?tag=X`** pointing back to the untagged URL, so tag filtering doesn't fragment page authority or create duplicate-titled URLs in the index.
9. **Required (not optional) alt text on contributor article images** — `content_block.ts`'s `image` variant already has an `alt` field; it's just not enforced (`alt?: string`, `src/lib/sections.ts:94`; rendered as `alt={block.alt ?? ""}`).
10. **Pillar pages for the 3–4 strongest existing clusters** (see §6) — not new URLs so much as a small number of genuinely new hub pages that tie already-strong content together, since right now a reader (and a crawler) reaches "the aerobic base" story through six or seven separately-ranked pages with no single page asserting Haarchive's authority on the topic as a whole.

## 6. Content/topic gaps — topical authority mapping

**Strong existing clusters** (real depth, real cross-linking, genuinely differentiated from a typical running blog):
- **Aerobic base / polarized training** — `the-aerobic-base`, `exercise-physiology`, `research-library`, `data-and-analytics` all cite Seiler's actual research (not just Fitzgerald's popularization of it — `0e98dcb`, "Credit Seiler, not Fitzgerald, as the source of polarized training," is exactly the kind of correction that builds topical trust). Cross-linked via `section-linkify.tsx`.
- **Coaching philosophy comparison** — the Coaching Library's even-handed criticism/response/other-coach-critique structure (`src/lib/coaches/data.ts`) is a genuinely rare content shape. No generic running site has 7 coaches' philosophies presented this way, each with a documented historical context and named points of disagreement.
- **Marathon-specific training** — `marathon-training`, `workout-library`, Marathon Pacing Calculator's physiology engine, and the Athlete Library's marathon case studies (Deena Kastor, Moses Mosop) reinforce each other.
- **Recovery & injury** — `recovery`, `nutrition-and-fueling`, RED-S coverage, the ACWR dashboard tool — real depth, recently reinforced by this session's Lydiard/80-20 synthesis work (see `docs/lydiard-synthesis/report.md`, `docs/podcast-synthesis/synthesis-map.md`).

**Weak or thin clusters**:
- `getting-started` (1 section) and `foundations` (2 sections) remain the thinnest categories on the site, per this session's own repeated finding while doing content synthesis work.
- **Trail/ultra running** — flagged explicitly as a likely content gap in `docs/podcast-synthesis/synthesis-map.md:100-103` ("Ultra/trail running — POSSIBLE NEW PAGE"), based on real digested source material (Jason Koop, Western States data) that was never turned into a page.
- **Pregnancy/postpartum running** — flagged even more strongly in the same synthesis map (`:358-361`) as *"almost certainly a full content gap"*, sourced from a credentialed perinatal-fitness-specialist interview that's fully digested and unused.
- **Masters/aging running** — a credentialed source is already digested (`synthesis-map.md:407-410`) and unused.

**Missing pillar pages** — the single biggest structural gap. The site has real cluster depth but almost no page that functions as a top-of-funnel pillar a crawler (or a new visitor) would land on for a broad query like "polarized training," "how to train for a marathon," or "how to choose a running coach." Category landing pages (`the-science`, `coaching-and-training`) are index/directory pages, not pillar content — they list what's inside rather than making the case for the topic themselves. Three candidates, using content that already exists:
1. A **polarized-training pillar** pulling together `the-aerobic-base`, `research-library`'s Seiler material, and the Coaching Library's cross-references — currently spread across 4 separate pages competing for overlapping search intent (see keyword-cannibalization note below) rather than one authoritative hub linking out to all of them.
2. A **"how to choose a coaching philosophy" pillar** sitting above the Coaching Library's comparison table — the comparison table exists (`src/components/coaches/coach-comparison-table.tsx`) but isn't wrapped in prose that would itself rank for a comparison-intent query.
3. A **marathon-training pillar** connecting `marathon-training`, the Marathon Pacing Calculator, and the relevant Athlete Library case studies into one hub, rather than three separately-discoverable destinations.

**Keyword cannibalization / overlapping intent** (already partially documented in `docs/haarchive-ecosystem-audit.md`, which this audit treats as historical research per that doc's own header — worth re-verifying current state before acting on it): Pace & HR, CV-Threshold, and Tinman calculators answer overlapping "predict my race time" intent under three different page titles; that audit already recommended a Performance Prediction consolidation. This SEO audit adds: those three pages also likely compete with each other in search results for the same queries today, splitting authority that a single stronger page (or a shared pillar linking to model-specific detail) would consolidate. **Not recommending changing their URLs** — only noting the cannibalization risk exists and should factor into whichever way that pre-existing consolidation question gets resolved.

**Pages that should link to one another and currently don't (verified gaps, not guesses)**: the metadata function for `[slug]/page.tsx` doesn't expose `lastUpdated` anywhere a reader or crawler can see it, so there's no visible "freshness" signal connecting, say, a recently-updated section back to older related ones. This is a metadata gap more than a missing-link gap, but it affects how a crawler judges which pages in a cluster are actively maintained.

## 7. Internal linking opportunities

- **Auto-linking already exists and works well** — `src/lib/linkify.tsx` composes a curated glossary (`glossary.ts`) and a regex-based "see X in Y" section-reference matcher (`section-linkify.tsx`). This is a real, differentiated internal-linking system most sites don't have. It's under-leveraged only in that it's scoped to `ContentBlocks`-rendered content — the Coaching Library, Athlete Library, and Training Plans pages (each with their own bespoke templates) don't run through it, so a mention of "polarized training" on a coach's page doesn't auto-link the way it would in a `sections.ts` essay.
- **Breadcrumb navigation exists as a visual/accessible element** (`aria-label="Breadcrumb"`, `article-overview.tsx:35`) but isn't paired with `BreadcrumbList` schema — see §5/§8.
- **The tag system on articles** (`article.tags`, filtered via `?tag=`) is real internal-linking infrastructure but currently a dead end for SEO: filtered results share metadata with the unfiltered page (§3, issue #4) and there's no dedicated `/tag/[tag]` landing page a crawler could actually rank — not recommending building one speculatively (that risks the "hundreds of thin pages" failure mode explicitly ruled out for this audit), but worth naming as the reason tag pages currently contribute nothing to internal link equity.
- **`lastUpdated` and citation data exist but aren't surfaced as links or signals** — see JSON-LD opportunities below.

## 8. Schema opportunities

All verified as **currently absent, zero implementation cost blocked on anything else** — the data already exists in the app, this is purely a mapping/serialization task:

| Schema type | Target pages | Data already available |
|---|---|---|
| `Article` | Database-backed articles (`[slug]/page.tsx`'s article branch) | `article.title`, `author` (via `attribution.ts`), `publishedAt`, `coverImageUrl`, citations (`article_citations` table, already rendered by `article-citations.tsx`) |
| `BreadcrumbList` | Every content-library page | The visual breadcrumb already renders the exact hierarchy needed (`article-layout.tsx:59-74`) |
| `FAQPage` | `/faq` | `questions` table rows already filtered `is_faq = true` (`src/app/faq/page.tsx:21-26`) — this is close to a direct field mapping |
| `Organization`/`WebSite` (sitewide) | Root layout | Site name, description, and logo/OG image already defined in `layout.tsx` |
| `Person` | Coaching Library / Athlete Library pages | Bios, historical context, and primary sources already modeled in `coaches/data.ts` / `athletes/data.ts` |
| `HowTo` (selective, not blanket) | A small number of genuinely step-based workout pages, if any exist in `workout-library` | Would need per-page evaluation — **do not apply blanket HowTo schema to every page**, only where content is genuinely a numbered procedure |

## 9. Technical SEO findings

Full classification, verified against the actual codebase:

| Area | Finding | Classification |
|---|---|---|
| robots.txt | Absent | **CRITICAL** |
| XML sitemap | Absent | **CRITICAL** |
| Canonical tags | Absent everywhere | **CRITICAL** |
| noindex on private routes | Absent (auth redirect exists, but no explicit index directive) | **HIGH** |
| Structured data | Absent everywhere | **HIGH** |
| Homepage-specific metadata | Absent (`src/app/page.tsx` has no metadata export at all) | **MEDIUM** |
| `?tag=` duplicate metadata | Confirmed — identical title/description regardless of filter | **HIGH** |
| `/search?q=` indexability | No canonical, no noindex, static generic title regardless of query | **HIGH** |
| Open Graph coverage | Present sitewide, and correctly overridden per-page on `[slug]`, coaching-library, athlete-library, training-plans (4 of the dynamic route types) | **NOT AN ISSUE** for those; **MEDIUM** for `community/[id]` and `contributors/[id]`, which have `generateMetadata` but no OG override, confirmed via grep — public profile pages sharing the generic sitewide OG image |
| Twitter/X card metadata | Mirrors Open Graph coverage — same pattern, same gap on community/contributor pages | **MEDIUM** |
| Title template | Correctly implemented sitewide (`layout.tsx`'s `title.template`) | **NOT AN ISSUE** |
| Meta descriptions | Present on essentially every indexable page (via `mission`, `subtitle`, or hand-written copy); length/quality not individually audited per-page at this pass — worth a follow-up content pass, not a technical fix | **LOW** |
| Image alt text (curated site imagery) | Required by design on `ImageSlot` (`alt` is a required prop, `src/components/ui/image-slot.tsx`) | **NOT AN ISSUE** |
| Image alt text (contributor article images) | Optional, defaults to empty string (`src/lib/sections.ts:94`, `content-blocks.tsx`'s `image` block) | **MEDIUM** |
| Image optimization | `next/image` used throughout for curated assets; contributor/arbitrary-URL images correctly use plain `<img>` with the established eslint-disable convention (can't be optimized without remote-pattern config, a deliberate tradeoff, not a bug — see `CLAUDE.md` §8) | **NOT AN ISSUE** |
| Lazy loading | `ImageSlot` defaults to `loading="lazy"`, `priority` only where explicitly set | **NOT AN ISSUE** |
| JavaScript rendering / crawlability | Content-library pages are server-rendered by default; only interactive calculators are client components, and those sit inside server-rendered page shells with real static content around them | **NOT AN ISSUE** |
| Core Web Vitals risk | No custom fonts beyond system-ui/Inter fallback, no heavy client bundles on content pages, `next/image` throughout — no obvious risk found in this pass; would need real field data (CrUX/Lighthouse) to say more, which is outside a code-only audit | **LOW** (unverified, not "not an issue" — flagged as needing measurement, not assumed fine) |
| Mobile rendering | Addressed extensively earlier this session (site-header mobile menu, tap targets, container widths) — see `CLAUDE.md` §9 for the documented state | **NOT AN ISSUE** (recently and directly verified) |
| 404 handling | No custom `not-found.tsx` exists anywhere in `src/app` — falls back to Next's bare default 404, with none of the site's own chrome/navigation/search | **HIGH** (real user- and crawl-experience gap, not just missed styling — a dead end with no path back into the site) |
| Redirects | No `next.config.ts` redirects, no `middleware.ts` — the only redirect in the codebase is the auth-gate's `redirect("/login")` | **NOT AN ISSUE** (nothing currently needs a redirect; noted so a future URL change doesn't silently 404 without one) |
| Duplicate URLs | The `?tag=` pattern above is the only confirmed structural duplicate-URL risk | **HIGH** (already counted above) |
| Trailing slash behavior | Default Next.js behavior (no trailing slash, no custom `trailingSlash` config) — consistent, not an issue | **NOT AN ISSUE** |
| Query parameters (general) | Only two confirmed cases: `?tag=` on the articles index and `?q=` on `/search`, both covered above | **HIGH** (both, already counted) |
| Internal search indexing | `/search` is a real page a crawler can reach and index with no per-query differentiation | **HIGH** (already counted) |
| Accessibility/SEO overlap | Heading hierarchy is real and consistent (`Heading` component + `ContentBlocks`' own `h2`/`h3` handling, `heading-id.ts` for anchors); breadcrumb nav is properly labeled; alt text gap noted above is the one real overlap issue | **NOT AN ISSUE** beyond the alt-text item already listed |

## 10. Phased implementation roadmap

For each item: whether it's safe for Claude Code to implement directly, or needs your review first, and why.

### Phase 1 — Technical foundation (do first)

| Item | Claude Code can do automatically? |
|---|---|
| `robots.txt` (disallow authenticated routes + `/search`, allow the rest, reference the sitemap) | **Yes** — mechanical, low-risk, easily reviewed in a diff |
| `sitemap.ts` covering all static/dynamic indexable routes | **Yes** — pulls from data already in `sections.ts`/`coaches/data.ts`/`athletes/data.ts`/training-plans/published articles; needs your review only on which article-query fields to trust for `lastmod` |
| `alternates.canonical` on all 11 existing metadata functions + static exports | **Yes** — mechanical addition, one line per page type |
| `robots: { index: false }` on the ~35 authenticated routes | **Yes**, but **flag for your review**: confirm you actually want every one of dashboard/admin/coach/contribute/settings/plan excluded (near-certain yes, but it's a real indexing-behavior decision worth a deliberate yes rather than a silent default) |
| Custom `not-found.tsx` using the site's own chrome/search | **Yes** — straightforward, matches existing page patterns (`faq`, `privacy-policy`) closely |
| Canonical + noindex handling for `/search?q=` and `/[slug]?tag=X` | **Yes** for the canonical; **your review** on whether `/search` should be `noindex` outright vs. canonical-only, since that's a real policy choice about whether search-result pages should ever be indexable |

### Phase 2 — Architecture (topical authority, internal linking)

| Item | Claude Code can do automatically? |
|---|---|
| Extend `linkify.tsx`'s auto-linking to Coaching Library / Athlete Library / Training Plans templates | **Yes**, mechanical extension of an existing pattern — moderate effort, no design judgment needed |
| Build the 3 candidate pillar pages (polarized training, choosing a coaching philosophy, marathon training) | **No — needs your review/direction first.** This is real new content requiring editorial judgment about what the page argues and how it's voiced, not a mechanical task. I can draft one once you tell me which to prioritize and confirm the framing. |
| Resolve the Pace & HR / CV-Threshold / Tinman cannibalization | **No — this depends on the pre-existing consolidation decision from `docs/haarchive-ecosystem-audit.md`**, which was never acted on. Needs your call on whether to consolidate, not just an SEO patch. |

### Phase 3 — On-page SEO (metadata, headings, schema)

| Item | Claude Code can do automatically? |
|---|---|
| `Article` JSON-LD on published articles | **Yes** — direct mapping from data already loaded on the page |
| `BreadcrumbList` JSON-LD | **Yes** — mirrors the visual breadcrumb already computed |
| `FAQPage` JSON-LD on `/faq` | **Yes** — direct mapping from the same query already powering the page |
| `Person` schema on Coaching/Athlete Library pages | **Yes** — direct mapping from `coaches/data.ts`/`athletes/data.ts` |
| Homepage-specific metadata | **Yes**, but **flag for your review**: this is real copywriting (a title/description meant to represent the whole site), worth a quick sign-off rather than a silent default |
| Surface `lastUpdated` as `openGraph.modifiedTime` | **Yes** — mechanical, data already exists on 22 sections |
| Enforce required alt text on contributor article images | **Yes** for the validation change; **your review** on whether it should hard-block publishing or just warn, since it affects the contributor-editing UX, not just SEO |

### Phase 4 — Content (new pages, topic clusters, gaps)

| Item | Claude Code can do automatically? |
|---|---|
| Trail/ultra running content (source material already digested in `docs/podcast-synthesis/`) | **No — needs your review first**, same as every other content-synthesis decision this session has gone through: real editorial judgment on scope, placement, and voice |
| Pregnancy/postpartum running content (already flagged as a strong, credentialed gap) | **No — needs your review first**, for the same reason, plus this is medically-adjacent content that specifically warrants a deliberate go-ahead |
| Masters/aging running content | **No — needs your review first** |

### Phase 5 — Authority (backlink-worthy resources, external promotion)

This is explicitly outside what a codebase audit or Claude Code can implement — it's about what gets built and then actively promoted/cited externally, not a code change. The one relevant note from this audit: the Coaching Library's even-handed, well-cited comparison structure (§6) is the site's strongest candidate for something other sites would actually want to link to, more so than any single blog-style article — worth keeping in mind if you pursue outreach, but the actual promotion work is yours to do, not something to hand back to me as a task.

---

## Appendix — URL inventory by type

Patterns rather than a mechanical per-URL dump, per this audit's own §5 instruction to prefer "pages consistently do X" over "page N has issue Y" — each page type's metadata/heading/schema pattern is uniform within the type, verified against 2–3 representative examples.

| Page type | Example URL(s) | Title source | Description source | H1 | Canonical | Schema | Indexable? | Issue pattern |
|---|---|---|---|---|---|---|---|---|
| Homepage | `/` | Layout default only | Layout default only | Hero heading (`about-page.tsx`) | None | None | Yes | No page-specific metadata |
| Category landing | `/the-science`, `/coaching-and-training` | `category.title` | `category.mission` | `<Heading>{category.title}</Heading>` | None | None | Yes | No canonical, no schema |
| Section (essay/reference) | `/exercise-physiology`, `/marathon-training` | `section.title` | `section.mission` | `<Heading>{section.title}</Heading>`, real `h2`/`h3` via `ContentBlocks` | None | None | Yes | No canonical, no schema, `lastUpdated` unused |
| Section with interactive tool | `/pace-calculator`, `/environmental-calculator` | `section.title` | `section.mission` | Same as above | None | None | Yes | Same as above |
| Database-backed article | `/[article-slug]` (via `[slug]/page.tsx`'s article branch) | `article.title` | `article.subtitle` | `ArticleHero`'s title | None | None | Yes | No canonical, no `Article` schema despite having every field it needs |
| Article, tag-filtered | `/articles?tag=X` | Identical to unfiltered `/articles` | Identical to unfiltered `/articles` | Same H1, filtered body content | None | None | Yes (unintentionally, likely) | Confirmed duplicate metadata across distinct crawlable URLs |
| Coaching Library | `/coaching-library/lydiard` (7 total, static-generated) | Set via that page's own `generateMetadata` | Same | Coach name | None | None | Yes | No canonical, no `Person` schema |
| Athlete Library | `/athlete-library/peter-snell` (4 total, static-generated) | Own `generateMetadata` | Same | Athlete name | None | None | Yes | Same pattern |
| Training Plans | `/training-plans/breeze-12` (10 total, static-generated) | Own `generateMetadata` | Same | Plan name | None | None | Yes | Same pattern |
| Public profile | `/community/[id]`, `/contributors/[id]` | Own `generateMetadata` | Own `generateMetadata` | Display name | None | No OG override (confirmed) | Yes | No canonical, generic OG image, no `Person` schema |
| Utility pages | `/faq`, `/privacy-policy`, `/about`, `/release-notes` | Static `metadata` export | Static `metadata` export | `<Heading>` | None | None (`/faq` is the clearest missed `FAQPage` opportunity) | Yes | No canonical |
| Search | `/search?q=X` | Static, identical regardless of query | None set | "Search" heading | None | None | Yes (should very likely not be) | Confirmed: no query-specific title, no canonical, no noindex |
| Authenticated app pages | `/dashboard`, `/admin/*`, `/coach/*`, `/contribute/*`, `/settings`, `/plan*` (~35 routes) | Real, page-specific titles | Real, page-specific descriptions | Real H1s | None | None | **Technically yes** (redirects to `/login` for a logged-out request, but no explicit noindex) | The core Phase 1 finding — see §3/§9 |
| Login/signup/pending | `/login`, `/signup`, `/pending` | Real titles | — | Real H1s | None | None | Yes, and arguably shouldn't be | Same noindex gap, smaller blast radius |

---

*End of audit. Nothing in this document has been implemented. See §10 for what's safe to build automatically versus what needs your sign-off first.*
