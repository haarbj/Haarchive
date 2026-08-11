# CLAUDE.md — The Haarchive

Persistent source of truth for working on this repository. Read this before making changes. It documents what actually exists in the codebase today — conventions, components, and decisions to reuse and respect — not aspirational architecture. Where something is a proposal rather than shipped reality (e.g. `docs/haarchive-ecosystem-audit.md`), that's called out explicitly.

---

## 1. Project identity

The Haarchive is a long-term distance-running knowledge hub: physiology, psychology, philosophy, coaching, training, recovery/fueling, research, and practical application, built by Brody Haar. It has since grown a full coaching platform on top of that same content (a deterministic training-plan engine, an AI layer that explains/adapts what the engine produces, and a coach-facing team platform) — but the content library is still the foundation everything else sits on.

**Core philosophy: "Why comes before what."** The site's own "Why This Exists" section states this directly: *"Every section here is built the same way: start with the mechanism (why oxygen delivery, muscle fiber type, or hormonal response works the way it does) and only then get to the workout it produces. The goal is to get you to the point where you could write your own plan, because you understand the system well enough to reason about it instead of just following it."* (`src/components/about-page.tsx`). Every content addition should honor this: explain the mechanism, then the prescription — never a prescription with no mechanism behind it.

This is **not** a generic fitness blog, a motivational site, or a training-plan marketplace. It should read like an educational/research archive that happens to be about running. If a piece of writing or a design choice would look at home on a typical running-brand landing page, it's probably wrong for this site.

---

## 2. Product/design philosophy

- **Research publication / knowledge archive > fitness brand.** Editorial, thoughtful, restrained, premium — not flashy, not sales-y.
- **Information density is acceptable**; hierarchy and whitespace are what make it navigable, not less content. The site consistently uses eyebrow labels, clear heading scale, and generous section dividers rather than shrinking content to look sparse.
- **No generic "runner at sunrise" stock photography.** No unnecessary visual decoration.
- **Visuals should communicate ideas, mechanisms, systems, or evidence.** A diagram that explains a mechanism is worth more than a photo that just fills space. See `src/components/ui/diagram.tsx` and the supercompensation-curve SVG in `about-page.tsx` for the standing example.
- **Real screenshots of Haarchive's own tools** are preferred over generic illustrations when showcasing functionality (see `public/homepage/calculator-screenshot.png`, captured directly from the live Pace & Heart Rate Calculator via Playwright — not a mockup).
- **Authentic personal photography over staged/fake photography.** Never fabricate an image or implied event.
- **Not every section needs an image.** Empty space next to a paragraph is not, by itself, a reason to add one.

### The design system as it actually exists (do not invent a new one)

**Dark mode only — this is intentional, not incomplete.** `src/app/layout.tsx` hardcodes `className="... dark"` onto `<html>` unconditionally:

> *"'dark' is hardcoded, not conditional — the site is dark-mode-only by design (light mode looked bad), so every dark: utility across the app should always win. No toggle, no system-preference check, no client script: this is the one true state, rendered server-side."*

Components still carry both light-mode and `dark:` Tailwind classes throughout the codebase (e.g. `text-zinc-900 dark:text-white`) — that's a deliberate leftover, not a bug: it keeps every component's diff small and reversible rather than stripping `dark:` from hundreds of files for a visual result that's already what ships. **Do not remove the light-mode classes**, and do not design new components assuming a real light/dark toggle exists for end users — there isn't one, and reintroducing one would be a real architectural decision, not a casual change.

**Design tokens** live in `src/app/globals.css`'s `@theme` block (Tailwind v4 — these become real utility classes, e.g. `bg-surface`, `rounded-card`, `max-w-dashboard`):

- Colors: `--background`/`--foreground`, `--surface`/`--surface-muted`, `--hairline`, `--heading`/`--body-text`/`--muted`, and seven semantic accents — `--accent-tip` (sky), `--accent-warning` (amber), `--accent-research` (violet), `--accent-success` (emerald), `--accent-error` (red), `--accent-forest`, `--accent-navy` — each with a dark-mode override in the `:root.dark` block below it.
- Radii: `--radius-pill`, `--radius-card` (1rem), `--radius-control` (0.75rem).
- Shadows: `--shadow-card`, `--shadow-card-hover`, `--shadow-dropdown`, `--shadow-modal`.
- Container widths (see §7 below): `--container-content` (1080px), `--container-dashboard` (900px), `--container-narrow` (680px), `--container-auth` (400px), `--container-article-prose` (72ch).
- `src/design/spacing.ts` documents (doesn't enforce) which numeric Tailwind spacing utility plays which semantic role (`mt-1`/`mt-1.5` for tight label gaps, `mt-14`/`mt-16` for section breaks, etc.) — a reference for consistency, not a new utility class. A prior attempt at a named `--spacing-*` scale silently broke `max-w-sm`/`max-w-xl`/`max-w-2xl` sitewide (spacing keys collide with container/breakpoint keys in Tailwind's theme namespace) — don't reintroduce that.
- Typography: Inter, system-ui fallback (`body` in `globals.css`). Headings use `font-semibold tracking-tight`; an "eyebrow" label (`text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500`) precedes most section headings — see `src/lib/section-styles.ts`'s `eyebrowClass`/`sectionHeadingClass`/`sectionDividerClass`/`sectionProseClass`, shared across `about-page.tsx`, `training-philosophy-page.tsx`, `contact-page.tsx`, and `coach-page.tsx`.
- Borders: hairline borders (`border-black/10 dark:border-white/10`) are the default separator/card-edge treatment throughout, not heavier dividers.
- `--breakpoint-xs: 480px` is an explicit phone-width cutoff, on top of Tailwind's default `sm`(640)/`md`(768)/`lg`(1024) scale.

---

## 3. Visual asset strategy

Priority order for any new visual, highest to lowest:

1. **Scientific diagrams / information graphics** — hand-authored inline SVG via `<Diagram>` (`src/components/ui/diagram.tsx`), not a raster file. Zero asset weight, inherits dark mode for free via the site's own `--accent-*` custom properties (e.g. `stroke="var(--accent-research)"`). Convention: thin line art (~1.25–1.5px stroke), one accent color, no fills/gradients/3D, no red/yellow/green "good/bad" coloring.
2. **Screenshots of Haarchive's own tools** — real output from the live site (see the calculator-screenshot precedent above), not a mockup or a generic illustration of "a calculator."
3. **Authentic personal photography** — real photos of Brody, real training artifacts. Never invented, never staged to look like something that didn't happen.
4. **Editorial/archival materials** — a notebook page, a handwritten workout, a training log, a physiology sketch. Preferred over a posed photo when the point is to emphasize an idea over a person (see the Coaching Philosophy section's use of Brody's own training log from coach Mike Scannell instead of a Lydiard-era artifact that would have raised a rights question).
5. **Consistent illustrations** — a shared icon+accent-chip system (see `src/lib/tool-visuals.ts` and `src/lib/category-visuals.ts`), never a full-color wash.
6. **Photography only when it meaningfully contributes** — last resort, and only when nothing above fits.

**For personal photography specifically:**
- Never invent or fake a photo of Brody, or imply a staged event actually happened.
- If an authentic coaching/personal photo doesn't exist for a given spot, don't force a stand-in — use a coaching artifact, training log, notebook, workout, or diagram instead (this has already happened once: the Coaching Philosophy section's original plan called for a Lydiard-era photo; it was replaced with Brody's own training log instead, specifically to avoid a rights question and because it's more honestly tied to his own story).
- Personal photos should tell an actual story (a specific race, a specific medal, a specific moment), not just fill a box. Every timeline photo on the homepage has a one-line note in `public/homepage/README.md` explaining exactly what it shows and why.

### `ImageSlot` (`src/components/ui/image-slot.tsx`)

The single component every homepage/about-page image goes through. Until a real asset exists, it renders a clearly-labeled placeholder (dashed border, muted icon, the exact `alt` text and sourcing guidance a future contributor needs) — not a broken image, not a stock photo. This keeps the page's real visual rhythm (spacing, proportions) honest before the asset exists, rather than merely promised.

Key props:
- `src` — omit entirely until the real file exists (renders the placeholder).
- `alt` — required even before `src` exists; writing real alt text is part of deciding what the image should show, not a finishing touch.
- `kind: "photo" | "portrait" | "diagram" | "screenshot" | "archival"` — drives the placeholder icon/label and the default `bordered` behavior (see below).
- `aspect: "video" | "portrait" | "square" | "wide"` — a fixed aspect-ratio box with `object-cover`, for a photo with room to spare at the edges.
- `naturalSize={{ width, height }}` — the escape hatch for "every edge is real content" (a full page of handwriting, a UI screenshot, a stack of books each with a legible title): renders at the source file's own real proportions, full width, no crop, no forced box, no letterboxing. Every image currently on the homepage that isn't a fixed-aspect photo uses this (`how-i-learn-books.jpg`, `coaching-training-log.jpg`, `calculator-screenshot.png`) — cropping or "contain"-fitting each of them into a forced box was tried first and rejected as either cutting off content or adding visible letterbox bars.
- `bordered` — per-`kind` default (`screenshot`/`archival` get a hairline border by default, since they usually have their own busy/light internal background and need an edge to read as a distinct image against the dark page; `photo`/`portrait`/`diagram` don't, since they usually have enough natural contrast on their own). Overridable per call site, but default to the kind's own convention rather than deciding fresh each time.
- `compact` — icon + short label only, for avatar/thumbnail-scale slots (the five "My Story" timeline photos) where there's no room for the full label/alt text.
- `fit: "cover" | "contain"` — ignored once `naturalSize` is set.

Every **real** (non-placeholder) image should be wrapped in `<Figure>` (`src/components/ui/figure.tsx`), which owns a consistent caption/attribution style underneath — even before there's real caption copy to show, since `Figure` renders nothing extra until `caption`/`attribution` is actually set.

### The homepage asset manifest

`public/homepage/README.md` is the living manifest for every homepage image: file, which `<ImageSlot>` call site it fills, wired-up status, aspect treatment, and a paragraph of sourcing/design reasoning per asset. **Read and update this file whenever a homepage image changes** — it's the project's own precedent for "document the reasoning, not just the current state," and future sessions rely on it to avoid re-deriving decisions already made (e.g. why the books photo uses `naturalSize` and not a forced `aspect` box).

---

## 4. Homepage narrative

`src/components/about-page.tsx` (rendered at `/`) — structure, purpose, and appropriate visual treatment for each section:

1. **Hero** — "Distance Running Knowledge Hub" framing, primary CTA into the content library. No imagery; this is a typographic hero.
2. **Featured essay** ("Why Running Is Valuable for Everyone") — reuses that article's own real `cover_image_url` from the `articles` table via a `imageUrl` prop on `FeaturedEssay`, rather than a homepage-specific asset. If that article's cover image ever changes, update the hardcoded reference in `about-page.tsx`.
3. **Tools & Accounts** — explains the free-calculators-plus-optional-account model. Carries the one real tool screenshot (`calculator-screenshot.png`, `naturalSize`, no browser chrome, no colored frame — a `<Figure>` caption does the "this is a picture" job through text instead, since the results card already has its own ring styling baked into the captured pixels and a second border read as a rendering glitch).
4. **Why This Exists** — the site's thesis statement, paired with the hand-authored supercompensation-curve `<Diagram>` (not a raster file) as the priority visual type for a mechanism explanation.
5. **My Story** — a five-stop timeline (Brophy → Run22 → Vanderbilt → "Stepping off the plan" [deliberately no photo — it's about reading, not a place] → Marathon → Coaching), each a small compact `<ImageSlot>` photo, not one portrait. The progression itself is the point.
6. **How I Learn** — the real coaching/running book stack photo (`naturalSize`) plus an influences grid (Seiler, Daniels, Canova, Vigil, Magness) with no imagery — archival material was considered and deliberately rejected in favor of no image at all here, matching the same "don't force a photo" direction that moved Lydiard away from a portrait elsewhere on the site.
7. **Coaching Philosophy** — Brody's real training log from coach Mike Scannell (`naturalSize`, sized at `max-w-md` so the handwriting is actually legible), an archival artifact standing in for a portrait, on purpose.
8. **What You'll Find Here** — the eight-category list, each with a small tinted icon chip (`src/lib/category-visuals.ts`, `CATEGORY_VISUALS`) — a low-alpha gradient wash + Lucide icon, matching the same technique as `FeaturedTool`'s icon tile since this row sits directly on the page's own background rather than an always-dark card. The same icon carries through to that category's own landing page (`src/app/[slug]/page.tsx`'s category-landing branch) for visual continuity.
9. **Looking Ahead** — plain prose, no imagery.
10. **Footer** (`src/components/site-footer.tsx`) — site chrome, not page content.

**Do not add imagery to a section just because it has empty space.** Several sections above (How I Learn's influences grid, Looking Ahead, the Featured Essay text) were deliberately left unillustrated after real consideration, not by default. If a future task proposes an image, ask first whether it explains something a paragraph doesn't, per §2 above — and check `public/homepage/README.md`'s "Recommended, not yet wired up" section for what's already been scoped but intentionally deferred.

---

## 5. Content philosophy

- **Explain mechanisms before prescribing workouts** — the "why before what" rule from §1, applied at the paragraph level, not just the page level.
- **Prefer primary research and high-quality evidence.** The site's established citation convention is `(Author, Source, Year)` inline — e.g. `(Achten et al., Medicine & Science in Sports & Exercise, 2002)`, `(Lydiard, Running to the Top)`, `(Seiler, Vienna 2017 Clinic)`. Cite the actual author of a claim, not a blanket source, especially when a document is a secondary interpretation of someone else's method (see `docs/lydiard-synthesis/synthesis-map.md` for a worked example of getting this right across many overlapping sources).
- **Distinguish evidence from coaching philosophy and personal experience.** The `ContentBlock` callout system (`src/lib/sections.ts`) has five variants for exactly this: `tip`, `mistake`, `research`, `takeaway`, `advanced` (the last defaults `collapsed: true`). A `research` callout is where "here's what a specific study found, and here's the honest caveat" lives — see `exercise-physiology`'s "Reconciling this with the sodium-centered framework above" for the pattern.
- **Do not present one coaching system as universally correct.** The Coaching Library (`src/lib/coaches/data.ts`) is explicitly structured around this: every coach entry has `criticisms` (each with a real `explanation` and a real `response`, never a dismissal), an `otherCoachesCritique` array (a *different*, named coach's documented real position on this one, never a fabricated quote), and `relatedPhilosophies` entries that name both what's shared and what genuinely differs. New coach content should follow this same even-handed shape.
- **Explain disagreement when it's real, don't flatten it.** Two live examples already on the site: `research-library`'s "Don't Fix Your Form" section explicitly flags its own tension with `training-philosophy`'s deliberately-coached-technique stance as *"a genuine unresolved disagreement, not an oversight on either page."* And Lydiard's own skepticism of weight training for distance runners sits in real, preserved tension with the site's separately-sourced favorable heavy-low-rep-lifting coverage (see `docs/lydiard-synthesis/report.md`'s "Disagreements preserved, not flattened" section for the reasoning).
- **Avoid exaggerated claims and generic running clichés.** No "unlock your potential," no motivational-poster language.
- **Write for intelligent runners without formal exercise-physiology training.** Technical concepts get explained, not skipped and not dumbed down — see how `exercise-physiology` walks through the actual ATP-yield math (36 vs. 2 molecules) rather than just asserting "aerobic is more efficient."
- **Preserve nuance when evidence is genuinely mixed.** `nutrition-and-fueling`'s carbohydrate-mouth-rinse section is a good template: it states a real, cited effect, then immediately cites a study that found no clear dose-response, then a 2025 meta-analysis's actual conclusion ("real but small and context-dependent") — never smoothed into a single confident claim.
- **Never invent citations, research findings, personal experiences, or credentials.** This is an absolute rule, not a style preference — see §15.

---

## 6. Information architecture

Eight `category` values in `src/lib/sections.ts`'s `categories` array, in declared order (section counts as of this writing — check the file directly, since these change):

| Category slug | Title | Sections |
|---|---|---|
| `getting-started` | Getting Started | `how-to-start-running` |
| `foundations` | Foundations | `training-philosophy`, `the-philosophy-of-running` |
| `the-science` | The Science | `exercise-physiology`, `the-aerobic-base`, `research-library`, `data-and-analytics`, `what-a-race-result-can-tell-you`, `mostly-easy-genuinely-hard` |
| `coaching-and-training` | Coaching & Training | `coaching-library`, `athlete-library`, `marathon-training`, `workout-library`, `trail-and-ultra-training`, `strength-training`, `5k-training`, `training-plans` |
| `recovery-and-fueling` | Recovery & Fueling | `nutrition-and-fueling`, `recovery`, `training-across-the-menstrual-cycle`, `pregnancy-and-postpartum-running`, `training-through-the-decades` |
| `mind-and-recovery` | Mental Performance | `sports-psychology`, `goal-setting`, `self-talk`, `daily-practice`, `performing-under-pressure`, `for-coaches` |
| `writing-and-resources` | Writing & Resources | `articles`, `resources`, `contact` |
| `tools` | Tools | ten calculator sections plus `choosing-a-pace-calculator` (an essay, not a calculator — see §7), see §7 |

Note: `mind-and-recovery`'s **slug** is intentionally kept as-is even though its **title** is now "Mental Performance" — Recovery content was later split out into its own `recovery-and-fueling` category, and renaming the slug would break existing links into it. Don't "fix" this slug/title mismatch without a real reason; it's a documented, deliberate choice (see the comment at its declaration in `sections.ts`).

**New content goes where a reader would naturally look for it.** Before adding a new top-level category, check whether the content actually belongs inside an existing, possibly-thin one — `getting-started` (1 section) and `foundations` (2 sections) are both intentionally thin and are the right home for genuinely new foundational material before a new category is justified. The Lydiard-folder synthesis work (`docs/lydiard-synthesis/`) is a recent, real example of this reasoning in practice: new content went into existing thin sections and a new *subsection* of an existing page (`workout-library`'s technique/footwear cluster), not a new top-level page.

`coaching-library` and `athlete-library` are members of `coaching-and-training` but have **no `content` array** in `sections.ts` — they're rendered by their own data-driven directory components (see §7).

---

## 7. Component and architecture conventions

**Framework:** Next.js 16 (App Router — Server Components/Actions, not static export), React 19, TypeScript strict mode, Tailwind CSS 4. Supabase (Postgres + Auth + Row-Level Security enforced at the database, not just the app). Zod for shared validation. Vitest for unit tests. Deployed on Vercel, git-integrated, no custom CI workflow.

**Routing** (`src/app/`):
- `src/app/[slug]/page.tsx` — the single generic template that renders **every** content-library page: a category landing (grid of member sections/tools), a section page with hand-authored `content` (an "essay"), a section with a dedicated interactive tool component (`sectionTools` map), a database-backed article (`content.length > 0` + `articleSlugs` membership), or the fallback "planned topics" list for a section with no `content` yet. Adding a new topic to an existing pattern is a **data change** in `sections.ts`, not a new route.
- `src/app/(app)/` — the authenticated app shell (sign-in required content lives under `(app)/(protected)/`: dashboard, plan, coach, admin, settings, contribute). `(app)/login`, `(app)/signup`, `(app)/pending` are the unauthenticated entry points.
- `src/app/coaching-library/[coach]/`, `src/app/athlete-library/[athlete]/`, `src/app/training-plans/[plan]/` — dedicated dynamic routes for the three data-driven library types (see below), distinct from the generic `[slug]` template.
- `src/app/api/coach/` — route handlers backing the AI adapt/explain tool-calling surface.
- `src/app/auth/` — OAuth callback and Strava connect/callback.

**Content architecture — three distinct patterns, don't conflate them:**
1. **`src/lib/sections.ts`** (~3,300+ lines) — the typed `ContentBlock[]` model for every hand-authored educational page (essays, physiology explainers, workout references). Block types: `heading` (level 2/3), `paragraph` (optional inline link), `list` (one level of sub-items via `ListItem`), `quote`, `callout` (5 variants, see §5), `image` (an arbitrary contributor-pasted URL, not a local asset — see §8), `calculator` (embeds an `InlineCalculator` by id). Rendered by `src/components/content-blocks.tsx`, the one place that knows how to turn a `ContentBlock` into markup — reuse it (as Training Plans' interactive home page does) rather than hand-rolling prose JSX for anything backed by this model.
2. **`src/lib/coaches/data.ts`** + `src/lib/coaches/types.ts` — a rich, per-coach structured type (`Coach`), not a `ContentBlock[]` array: `philosophy`, `corePrinciples`, `historicalContext`, `misunderstandings`, `criticisms`, `dailyLife` (7 required narrative beats), `decisionScenarios`, `workoutReactions`, `primarySources`, `notableAthletes`, `genome` (a 10-category 0–100 illustrative profile), etc. Rendered by the shared `CoachPage` template (`src/components/coaches/coach-page.tsx`) so every coach gets identical structure. `src/lib/athletes/data.ts` / `types.ts` mirror this exactly for the Athlete Library, one page per real, well-documented athlete whose coach already has a Coaching Library page (so the cross-link always resolves). **Never invent** a quote, training detail, or result in either file — omit a field rather than speculate (both files' own header comments say this explicitly).
3. **Database-backed articles** — full essays with citations, authored through `/contribute/articles`, rendered via `ArticleHero` + `ArticleLayout` once published (`src/lib/articles/`).

**Reusable UI components to reach for before writing new markup** (`src/components/ui/`):
- `Container` (`variant: "content" | "dashboard" | "narrow" | "auth"`) — the single place page width is decided; see §7's container table below. Always use this instead of a hand-rolled `max-w-*` wrapper.
- `Card` / `CardLink` — the card recipe an earlier audit found repeated ~56 times near-verbatim across 34 files before being extracted; `padding: "sm" | "md" | "lg" | "none"` ties to the radius that size actually used.
- `Badge` (`tone`) — reuses the same `--accent-*` tokens as `ContentCallout`, so a color choice made once in `globals.css` governs both.
- `Heading` (`variant: "page" | "compact"`), `BackLink`, `TextLink`, `Figure`, `Diagram`, `ImageSlot` (see §3).
- `LabeledInput`, `FormError`, `ConfirmButton`, `SuccessPanel`, `EmptyState`, `ListRow`.
- Shared style-string modules (not components, but reuse the string): `src/lib/form-styles.ts` (`fieldClass`, `labelClass` — the single canonical form-field definition, previously copy-pasted into 7 files), `src/lib/tool-styles.ts` (calculator UI vocabulary — `statCardClass`, `heroCardClass`, `segmentedButtonClass`, etc.), `src/lib/section-styles.ts` (the eyebrow/heading/divider/prose recipe for a "flagship essay" page).

**Container variants** (`src/components/ui/container.tsx`, widths mirrored in `src/design/layout.ts` and `globals.css`'s `--container-*` tokens — keep both in sync by hand if a width ever changes):

| Variant | Width | Use for |
|---|---|---|
| `content` | 1080px | Home, category landings, every section page (tool, article, list, placeholder) |
| `dashboard` | 900px | Authenticated list/detail pages: dashboard, coach, admin, plan, **settings** |
| `narrow` | 680px | A form with supporting content around it (generate a plan/season, an error state) |
| `auth` | 400px | A single-column form and nothing else — sign in/up, pending |

`settings` was moved from `auth` to `dashboard` recently, specifically because it's a multi-section page (profile, community profile, race results, injuries), not a bare single-column form — the 400px cap was invisible on mobile (never the binding constraint at phone widths) but cramped on desktop next to every other authenticated module. If a future page has the same "bare form" shape as sign-in, `auth` is still correct; if it grows into multiple real sections, it should move to `dashboard` the same way.

**Tool/calculator architecture:** every calculator is a client component in `src/components/*.tsx` (`pace-calculator.tsx`, `hr-threshold-calculator.tsx`, `cv-threshold-calculator.tsx`, `gap-calculator.tsx`, `race-pace-calculator.tsx`, `pace-percent-calculator.tsx`, `tinman-calculator.tsx`, `marathon-pacing-calculator.tsx`, `environmental-calculator.tsx`, `heat-tracker.tsx`), backed by a pure, tested math module in `src/lib/` (`hr-model.ts`, `cv-threshold-math.ts`, `grade-pace-physics.ts`, `race-pace-math.ts`, `pace-percent-math.ts`, `tinman-calculator-math.ts`, `heat-physics.ts`, etc.) — keep the math pure and separately testable rather than inline in the component, matching the existing split. `src/lib/tool-visuals.ts` (`TOOL_VISUALS`) gives each calculator's `ToolCard` its own icon + accent-gradient chip, confined to a small ~44px area rather than a full-card color wash (an earlier version tried that and it was too much color at ten-cards-wide). `src/lib/environmental/*` implements a genuinely reused shared-engine pattern (`AdjustmentEngine<T>` for heat/humidity/wind/elevation, combined via `combine.ts`) — Marathon Pacing Calculator's own mile-cost model calls the *same* engine instances the Environmental Calculator uses, not a copy. Prefer this pattern (a shared, pure, tested engine consumed by multiple UI layers) over duplicating physics/math per tool.

**Coaching engine / AI layer** (mentioned since future tasks may touch it): `src/lib/coaching-engine/` is deterministic, plain, tested TypeScript (pace/HR zones, race-time prediction, mileage progression, periodization, calendar scheduling) — every number on screen should trace to a function a unit test can verify. `src/lib/ai/` only ever narrates or adapts what the engine already computed (via tool-calling into real coaching-engine functions), never generates a number from scratch. Don't blur this line: if a task asks the AI layer to produce a number, route it through a coaching-engine function instead.

**Auth/DB architecture:** Supabase clients split by context — `src/lib/db/client.ts` (browser), `server.ts` (Server Components/Actions), `service-role.ts` (privileged, server-only operations), `proxy.ts`. `src/lib/auth/` holds session (`session.ts`), permission (`permissions.ts`), and multi-workspace (`workspaces.ts`) helpers. Schema is version-controlled SQL under `supabase/migrations/` (35 migrations as of this writing), applied via `npx supabase db push` — RLS policies are part of the schema, not an app-layer afterthought. `src/lib/validation/` holds one Zod schema file per domain (articles, athlete-profile, auth, contact, plan, questions, ...), shared between client forms and server actions.

**Known architectural patterns worth naming explicitly, since a future task will likely need one of them:**
- `ImageSlot` / `Figure` / `Diagram` — see §3.
- `ContentBlocks` — see above; the one renderer for the `sections.ts` content model.
- `linkifyContent` (`src/lib/linkify.tsx`) — composes two independent auto-linking mechanisms into every paragraph/list-item/callout rendered through `ContentBlocks`: (1) `src/lib/glossary.ts`, a curated, hand-maintained (never heuristic/NLP) list of recurring terms and the one real anchor that actually defines each; (2) `src/lib/section-linkify.tsx`, a regex-based convention that turns prose like *"see Reversing the Size Principle in Strength Training"* into a real link, matched against every section's own title and heading text. A `Set<string>` threaded through one page's render ensures each glossary term links only on its first occurrence, not every mention.
- `ToolCard` / `TOOL_VISUALS` and `CATEGORY_VISUALS` — the icon+accent-chip pattern, see §3 and §7 above.
- `CoachPage` / `AthletePage` templates — see above.

---

## 8. Image handling

- **Local assets only, under `public/`** — organized by feature (`public/homepage/`, `public/coaches/`, `public/data/`). There is **no `images.remotePatterns` configuration in `next.config.ts`**, which means `next/image` only works, unoptimized-config-wise, for local files today. That's the right fit for curated site imagery (a founder photo, a diagram, a coach portrait — all ship with the codebase). **Do not add remote-image config speculatively** — the current `next.config.ts` only sets `experimental.serverActions.bodySizeLimit` (9 MB, sized to match `MAX_IMAGE_BYTES` in the article-image-upload action plus multipart overhead) and nothing else; there's no standing need for remote patterns today.
- **Arbitrary user/contributor-uploaded URLs** (an article's inline image, a contributor's avatar pasted from an external host) go through a plain `<img>` with the established `{/* eslint-disable-next-line @next/next/no-img-element */}` convention — see `content-blocks.tsx`'s `image` block and `article-hero.tsx`'s author-avatar rendering. This is intentional, not an oversight: `next/image` can't optimize a URL it doesn't control the domain of without remote-pattern config, and adding that config for arbitrary contributor URLs would be a real security/ops tradeoff, not a free win.
- **Curated site imagery goes through `next/image`** via `ImageSlot` (see §3), which itself decides `fill` (fixed `aspect`) vs. explicit `width`/`height` (`naturalSize`) based on the asset's own shape.
- **Naming convention:** descriptive, feature-prefixed filenames (`timeline-brophy.jpg`, `calculator-screenshot.png`, `coaching-training-log.jpg`), not generic names or hashes.
- **Alt text is written before the asset exists**, as part of `ImageSlot`'s required `alt` prop on the placeholder — treat writing alt text as part of deciding what an image should show, not a finishing touch bolted on after the fact.
- **Responsive behavior:** `sizes` on `ImageSlot` defaults to `"(min-width: 1024px) 50vw, 100vw"`, overridable per call site (the timeline thumbnails override this since they're small and grid-laid-out, not half-page). `naturalSize` images render `h-auto w-full` — they scale responsively while preserving their real aspect ratio exactly, rather than being fit into a breakpoint-dependent box.
- **Known limitation, not a bug to "fix":** two of the homepage's source photo files are large (`timeline-coaching.jpg` 9.9MB, `timeline-vanderbilt.jpg` 2.8MB) — `next/image` optimizes what actually ships to a visitor regardless, so this isn't a runtime performance problem, just repo-history weight worth knowing about if it ever matters.

---

## 9. Responsive design

- **`--breakpoint-xs: 480px`** is an explicit phone-width marker on top of Tailwind's default `sm`/`md`/`lg` scale — use it for anything that needs to key off the phone boundary specifically; most layout already reflows correctly via `flex-wrap` without it.
- **Mobile is not a shrunk desktop layout for navigation.** `src/components/site-header.tsx` renders a genuinely different structure on mobile once the menu is open: the header itself becomes `fixed inset-0` (a true full-viewport panel, not an inline accordion that pushes page content down while leaving it visible/scrollable underneath), with the menu list as the only `flex-1 overflow-y-auto` region so only it scrolls, not the whole page. Mobile search lives as a persistent row inside the header chrome (never hidden behind the hamburger — search must always be one tap away). The mobile "Learn" submenu shows **category names only**, not every section under every category — a full sub-list flattened the entire ~40-link site map into one screen, which was the exact problem worth avoiding; each category's own landing page is the real drill-down step and doesn't need to be reproduced in the nav.
- **Known mobile pitfalls already found and fixed in this codebase** — don't reintroduce them:
  - A `p-1` icon-button padding around a small glyph produces roughly a 22px tap target, well under a reasonable touch-safety minimum — the dismiss button on `FeatureAnnouncement` was fixed to an explicit `h-9 w-9` (~36px) target with a `-mr-2` pullback so the larger target doesn't visually shift the row's right edge.
  - A badge/label next to a long title can wrap onto its own line inside a flex-wrap row on a narrow phone, pushing a banner to three stacked lines before the actual content starts — `FeatureAnnouncement`'s badge is `hidden` below `sm:` specifically for this reason (a nice-to-have label isn't worth tripling banner height on the smallest screens).
  - A full-length card description at one column on a narrow phone turns a tools grid into a long scroll for what's meant to be a quick jump — `ToolCard`'s mission text uses `line-clamp-2`.
  - Container width caps that look fine on a phone (where they're never the binding constraint) can still be wrong on desktop for a page with real content richness — see the Settings `auth` → `dashboard` fix in §7. Always check both ends, not just mobile, before assuming a narrow container is "safe."
- **Two-column form grids** (`sm:grid-cols-2`, used throughout the settings forms and elsewhere) collapse to one column below `sm:` by default — this is the expected, correct behavior, not something to override per form.

---

## 10. Performance

- **Image optimization** runs through `next/image` for every curated asset (see §8) — don't bypass it for a local file.
- **Keep pages fast despite content richness.** `sections.ts` pages are large but server-rendered static content; the generic `[slug]/page.tsx` template and `ContentBlocks` renderer are what make that scale without a bespoke page per topic.
- **Avoid unnecessary client-side JavaScript.** Calculators are client components because they need interactivity; content-library pages, article pages, and category landings are not — don't add `"use client"` to a page that's just rendering `sections.ts` content.
- **Lazy-loading:** `ImageSlot` sets `loading="lazy"` by default, `priority` only where explicitly passed (above-the-fold hero imagery).
- **Avoid large image payloads** — see §8's naming/size guidance; a new homepage asset shouldn't repeat the multi-megabyte source-file pattern without a reason.
- **Avoid unnecessary dependencies.** The dependency list (`package.json`) is deliberately small: no charting library (the Heat Tracker's WBGT chart is a hand-built SVG, per the README), no CSS-in-JS, no state-management library beyond React itself. Reach for an existing pattern (a shared engine, a shared style-string module, a shared UI component) before adding a package.

---

## 11. Accessibility

- **Semantic HTML** — real `<h1>`–`<h3>` hierarchy (via `Heading` and `ContentBlocks`' own heading levels), `<figure>`/`<figcaption>` for images, `<nav>`/`<button>`/`<a>` used for their actual roles.
- **Heading hierarchy:** `Heading` component's `variant="page"` renders an `<h1>`; `ContentBlocks` renders `heading` blocks as `<h2>` (default) or `<h3>` (`level: 3`) with `id`s generated by `src/lib/heading-id.ts` for anchor-jump navigation and the table-of-contents/section-linkify machinery.
- **Alt text** is required (not optional-with-empty-string-default) on every `ImageSlot` call, written as real descriptive content — see §3/§8.
- **Focus states:** the shared `fieldClass` (`src/lib/form-styles.ts`) includes an explicit `focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:outline-none` — reuse it rather than a custom focus treatment per form field.
- **Contrast:** dark-mode-only (see §2) — the `--heading`/`--body-text`/`--muted` token scale is tuned for the actual dark background that always renders, not for a light background that never does in production.
- **Charts/diagrams:** `Diagram` renders with `role="img"` and a real `aria-label` (the same text passed as `alt` to `ImageSlot`-style components) when it has real content, so a screen reader gets the diagram's meaning even though it's inline SVG, not an `<img>`.
- **Reduced motion:** `globals.css` already gates smooth-scroll on `@media (prefers-reduced-motion: reduce)` (`html { scroll-behavior: auto }`). Any future animation should check this same media query rather than assuming motion is always welcome.
- **Native form controls and dark mode:** `fieldClass` sets `[color-scheme:light_dark]` specifically so browser-native chrome (date pickers, number-input spin buttons) renders in a theme that matches the page instead of defaulting to a light-mode rendering that's nearly invisible on a dark card — a real bug this fixed, not a defensive addition. Keep this on any new native input.

---

## 12. Development workflow

From `package.json`:

```bash
npm run dev         # next dev — local development server
npm run build        # next build — production build
npm run start         # next start — serve a production build
npm run lint          # eslint
npm run test           # vitest run — full suite, once
npm run test:watch      # vitest — watch mode
```

**There is no dedicated `typecheck` script.** Type-check with:

```bash
npx tsc --noEmit -p .
```

**Validate every change with the appropriate subset of: `npx tsc --noEmit -p .`, `npm run lint` (or `npx eslint <changed files>` for a faster targeted check), and `npm run test`** (or `npx vitest run <path>` for a targeted run) before considering a task complete. This project's own test suite (`tests/`, mirroring `src/lib/`'s structure — `tests/coaching-engine/`, `tests/ai/`, `tests/strava/`, `tests/validation/`, `tests/lib/`, `tests/contribute-articles/`, `tests/search/`, `tests/dashboard/`, `tests/questions/`, `tests/fixtures/`) is real and should stay green — a change that breaks an existing test needs the underlying issue fixed, not the test loosened to match new, wrong behavior (unless the test itself encoded the old, now-intentionally-changed behavior, in which case update it deliberately and say so).

No dedicated CI workflow exists in-repo (deployed on Vercel, git-integrated) — the checks above are the actual gate, run manually or by whatever the working session's own tooling invokes.

---

## 13. Git / change discipline

- **Inspect before modifying.** Read the actual current file content — this project's own content and data files (`sections.ts`, `coaches/data.ts`) are large and change between sessions; don't assume a remembered line number or structure is still accurate. (A real example from this project's own history: a synthesis effort built a "what's already covered" reference from a narrow grep, then had to substantially revise its plan after actually reading the target files and finding far more existing coverage than the grep suggested — see `docs/lydiard-synthesis/report.md`'s "Why the scope narrowed so much" section.)
- **Make the smallest reasonable change.** Reuse the existing component/pattern/style-string module (§7) rather than recreating it.
- **Avoid unnecessary rewrites and avoid changing unrelated components** — a request about one page's container width doesn't justify touching other pages' containers "while you're in there."
- **Preserve existing functionality.** Don't refactor working code as a side effect of an unrelated task.
- **Avoid introducing dependencies without a real, stated reason** (see §10).
- **Explain meaningful architectural changes** — if a change genuinely does need to touch a shared pattern (a design token, a shared engine, a container variant), say so explicitly and why, the way this file's own §7 documents the recent Settings container change.
- **Run relevant validation after changes** — see §12.
- **Do not commit changes unless explicitly asked.** When asked, follow standard commit hygiene: stage only the relevant files, write a message explaining *why*, never `--no-verify`/`--no-gpg-sign` unless explicitly requested, never force-push without explicit confirmation.

---

## 14. Current known issues / decisions

Clearly distinguished by kind:

**Intentional design decisions — do not casually reverse:**
- Dark-mode-only, hardcoded on `<html>`, no toggle (§2). Reversing this is a real product decision, not a styling tweak.
- `mind-and-recovery`'s slug/title mismatch (§6) — kept for link stability, not an oversight.
- No `images.remotePatterns` in `next.config.ts` (§8) — local assets and plain `<img>` for arbitrary URLs is the deliberate split, not a gap.
- `naturalSize` over a forced `aspect` box for any image where "every edge is real content" (§3/§8) — arrived at after multiple rejected crop/contain attempts on the homepage's own images; don't re-litigate this per new image without a real reason to.
- Race Pace Calculator, GAP Calculator, and similar tools intentionally keep their math in a separate pure `src/lib/*-math.ts`/`*-physics.ts` module from the component (§7) — this split is what makes each one unit-testable and is the template for any new calculator.

**Current implementation (accurate as of this writing, but a data file, not a fixed architecture — check the source before relying on exact counts):**
- The category/section table in §6.
- The container-variant table in §7.
- The Karvonen heart-rate-formula inconsistency described in `docs/haarchive-ecosystem-audit.md` (two calculators once computed different HR zones for the same female-runner inputs) **has already been fixed** — both `pace-calculator.tsx` and `hr-threshold-calculator.tsx` now import `bpmFromPercent`/`estimateMaxHr` from the shared `src/lib/hr-model.ts`. Treat that audit document as a point-in-time research/roadmap artifact, not a live bug list — some of its recommendations (this one, `hr-model.ts`'s extraction) have already shipped; others haven't. Check the current code, not the audit's prose, before treating any of its findings as still-open.

**Known limitation (real, but not currently being fixed — worth knowing, not necessarily acting on unless asked):**
- Two large homepage source photos (§8).
- Several tools independently reimplement pace/speed/time conversion and the mile-in-meters constant with some drift between an exact `1609.344` and a truncated `1609.34` in a handful of files outside the calculators (`docs/haarchive-ecosystem-audit.md` §5) — flagged, not yet swept repo-wide as of this writing.

**Future idea (proposed, not built — do not build speculatively):**
- Everything in `docs/haarchive-ecosystem-audit.md` beyond what's confirmed shipped above (a unified Performance Prediction tool, an athlete-profile read/write layer, a race-agnostic fatigue engine, altitude as a fifth environmental-adjustment engine, etc.) is a **research and recommendations document** — its own header says so explicitly. Don't treat any of it as already-decided architecture, and don't start building toward it unless a task explicitly asks to act on a specific recommendation from it.
- `public/homepage/README.md`'s "Recommended, not yet wired up" section (the "What You'll Find Here" category icons — since done, see §4 — and the "How I Learn" influences-grid imagery, deliberately still undone) is the same kind of scoped-but-deferred idea list for homepage imagery specifically.

---

## 15. How Claude should behave on future tasks

**Before making a change:**
1. Understand the existing implementation by reading the actual current files — not a remembered summary of them.
2. Find the existing component/pattern/style-string module that should be reused (§7) before writing anything new.
3. Check whether the requested behavior already exists elsewhere in the codebase (a grep for one or two literal strings undersold real existing coverage once already on this project — see §13's cited example; read the actual target file, not just a keyword match).
4. Make the smallest coherent change that satisfies the request.
5. Preserve the site's visual and editorial identity (§2, §5) — an addition that reads like a generic fitness-brand page or a motivational-poster line is a wrong addition even if it's technically correct.
6. Test the affected area directly where practical (a calculator's actual output, a page's actual rendered structure).
7. Run the appropriate lint/type/build/test checks (§12) before calling the task done.
8. Report what changed and what was verified — cite real file paths and line numbers where useful, matching this project's own documentation convention (see `docs/haarchive-ecosystem-audit.md` for the style).

**For design requests:**
- Do not automatically add images — ask (internally, then act) whether a visual actually improves comprehension, per §2/§4.
- Do not default to stock photography, ever.
- Do not redesign unrelated parts of the site while addressing the actual request.
- Favor consistency with existing patterns (§7) over a novel one-off treatment.
- Prefer diagrams, data visualization, and authentic artifacts over photography when a visual is genuinely warranted (§3).

**For content requests:**
- Preserve the Haarchive's editorial voice (§5) — mechanism before prescription, evidence distinguished from philosophy, disagreement stated honestly rather than flattened.
- Do not flatten a nuanced or contested claim into generic advice to make it shorter or more confident-sounding.
- Do not invent citations, research findings, personal experiences, quotes, or credentials — for the Coaching/Athlete Library specifically, omit a field entirely rather than speculate (this is stated directly in both data files' own header comments).

**For image requests:**
- Never fabricate an image of Brody, or imply a staged event actually happened.
- If an authentic personal image isn't available, design around the absence (an archival artifact, a diagram, no image at all) rather than inventing one or forcing a generic substitute into the slot.
