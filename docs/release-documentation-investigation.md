# Automated Release Documentation — Investigation Report

**Status:** Investigation only. No code changed, nothing committed or pushed. Written for approval before any implementation begins.

**Scope note:** This is a standalone project, unrelated to the learning-system phase numbering elsewhere in this repo's history.

---

## 1. Current repository architecture

- **Framework:** Next.js 16 (App Router), React 19, TypeScript strict, Supabase, Tailwind 4, Vitest. (Full stack detail already documented in `CLAUDE.md` §7 — not re-derived here.)
- **Branch structure:** Single branch, `main`. `git branch -a` shows nothing else, locally or on the remote. `main` is **not** branch-protected (confirmed via the GitHub API: `"protected": false`).
- **Commit history:** 181 commits total. **Only one pull request has ever existed** in this repo's history (`#1`, the initial Copilot-generated scaffold, merged 2026-07-06) — every one of the other 180 commits went straight to `main` with no PR. This is the single most important fact for everything that follows: any automation design that assumes a PR-based workflow (labels, PR titles, "merged PR" categorization) does not match how this repo is actually used.
- **Commit message conventions:** Not Conventional Commits (no `feat:`/`fix:`/`chore:` prefixes anywhere in the log). Instead, every commit since the scaffold follows a consistent house style: a plain-English summary line, then a multi-paragraph body explaining *why* the change was made (not just what), ending in `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. This is unusually rich for a commit log — closer to release-note prose than typical terse commit messages — because every commit in this repo has in practice been authored by a Claude Code session working directly with the project owner, not a human dashing off `git commit -m "fix bug"`.
- **GitHub Actions / workflows:** None. `.github/` does not exist in the repo at all — no workflows, no issue templates, no PR templates.
- **README:** Exists (`README.md`, 66 lines), hand-written, manually maintained, and **currently stale**: it describes 6 content categories (the live site has 8, per `sections.ts`), doesn't mention dark-mode-only (a deliberate, shipped decision per `CLAUDE.md` §2), and has no mention of the learning system, environmental/altitude engine, conversion analytics, or any of the other major features shipped in just the last few weeks of history. It was clearly written once, early on, and not touched as the project grew.
- **Release/tag/version conventions:** None exist today. `git tag -l` is empty. The GitHub API confirms zero tags and zero Releases on the repo (`GET /repos/haarbj/Haarchive/releases` → `[]`, `GET .../tags` → `[]`). `package.json`'s `"version": "0.1.0"` is inert — the package is `"private": true`, never published, and nothing in the codebase reads that field.
- **Deployment:** Vercel, connected directly to GitHub (confirmed via `CLAUDE.md` and the lack of any `vercel.json` or custom CI — it's the default zero-config git integration). Per Vercel's own docs, every push to `main` triggers an automatic production deployment; every other branch/PR gets a preview deployment. There is no `vercel.json` in the repo, meaning build/deploy behavior is whatever's configured in the Vercel dashboard (out of scope for repo inspection).
- **Existing automation to reuse:** None. No `scripts/` directory exists at all. No `husky`, `commitlint`, `semantic-release`, `changesets`, or `release-please` in `package.json`. No local git hooks configured (`.git/hooks/` contains only the default `.sample` files Git ships with). This is a genuine blank slate.
- **`docs/`:** Contains several investigation/audit-style markdown documents from past sessions (`haarchive-ecosystem-audit.md`, `seo-audit.md`, `marathon-pacing-calculator-design.md`, etc.) — this establishes a real, existing precedent for "write a standalone investigation doc under `docs/`" as this project's own house style for exactly this kind of deliverable, which is why this report lives there too.

## 2. Current release-notes architecture

`/release-notes` is a **statically-imported TypeScript data file**, not a database table, not MDX, not a CMS:

- **Data:** `src/lib/release-notes.ts` — a single exported array, `releaseNotes: ReleaseNote[]`, each entry `{ date, headline, detail }`. ~40 entries today, newest-first, spanning 2026-07-06 (launch) to 2026-07-30 (most recent).
- **Rendering:** `src/app/release-notes/page.tsx` — a plain Server Component that imports the array directly, groups entries by month, and renders them. No client-side fetching, no loading state, nothing dynamic.
- **How it's populated:** The file's own header comment is explicit and already well-thought-out: entries are *"sourced from this repo's own git history (`git log`), curated rather than reproduced commit-for-commit: a real shipped change gets one entry even if it took several commits, and pure internal refactors, copyediting, or one-line bug fixes with no visible effect are left out entirely."* It even documents the exact format going forward (`date` = ship date not start date, `headline` = reader-facing sentence fragment not a commit message, `detail` = 2-3 sentences on what/why). **This editorial philosophy is already exactly right** — the problem is not that nobody thought about how to write good release notes, it's that the process for actually keeping the file updated is entirely manual and has lapsed.
- **Is it actually stale right now?** Yes, confirmably. I fetched the *live* production page (`https://brodyhaar.com/release-notes`) and it matches the local file exactly: newest entry July 30. Today is well past that. In the time since, this repository has shipped (per `git log`, all real, user-facing, release-note-worthy by the file's own stated bar): the entire learning system (onboarding, mastery, knowledge checks, Notes, Bookmarks, Library), account-conversion instrumentation, a co-author access fix, a Knowledge Check progress-counter feature, a nav redesign, and an Environmental Calculator elevation/altitude overhaul — **none of which appear on the public page.** That's a concrete, current example of exactly the problem this project is meant to solve.
- **No existing admin/editorial workflow:** There is no `/admin/release-notes` page and nothing under `admin/` touches this file. It's edited directly in the codebase, by whoever (human or Claude session) is doing the work, as part of a commit.
- **Do the README and website share a content source?** No. The README is entirely separate hand-written prose; nothing links them today.
- **Other metadata mechanisms already wired to this file:** `src/app/sitemap.ts` already reads `releaseNotes[0]?.date` and uses it as the homepage's `lastModified` value in `sitemap.xml`. This means `release-notes.ts` is already a de facto "site last-updated" source for SEO purposes, beyond just the page itself — a real, live consumer to keep in mind so any redesign doesn't accidentally break it.

## 3. Current README architecture

Covered above in §1. To restate the specific finding: the README is **entirely static/manual**, structurally organized into "What's here" / "Stack" / "Development" / "Checks" / "Project structure" — all reasonable sections for a README to have — but every one of them has drifted from what's actually true today. There is no mechanism, convention, or reminder anywhere that ties README maintenance to shipped work.

## 4. Git/GitHub/deployment architecture

The actual lifecycle today is:

```
Claude Code session (local) → git commit → git push origin main
                                                  │
                                                  ▼
                                    Vercel (git-integrated, no Action)
                                    detects push → builds → deploys
                                                  │
                                                  ▼
                                          brodyhaar.com (live)
```

There is no GitHub Actions step anywhere in this chain. Nothing runs *between* a push landing on GitHub and Vercel picking it up. `release-notes.ts` and `README.md` are ordinary source files that only change when someone (a Claude session, in practice) edits them directly, same as any other file — there's no separate "documentation build" step.

## 5. Best-practice research

I looked at GitHub's own documentation first, then broader ecosystem practice.

**GitHub's native "automatically generated release notes"** (`docs.github.com/.../automatically-generated-release-notes`): this feature summarizes *merged pull requests*, categorized by PR label via an optional `.github/release.yml` config, and is triggered either manually (a button when drafting a Release) or via the `generate_release_notes: true` flag on the Releases API. **This doesn't fit this repo**: with 180 of 181 commits going straight to `main` with no PR and no labels, there is nothing for this feature to categorize. Adopting it would require adopting a PR-based workflow first — a much bigger process change than what was asked for, and one the project doesn't currently need for any other reason.

**Conventional Commits + release-please / semantic-release**: the standard "fully automated" pattern — commits prefixed `feat:`/`fix:`/`chore:` drive automatic SemVer bumps, `CHANGELOG.md` generation, and tagged GitHub Releases. Widely recommended for packages with external consumers. Two things rule this out here: (1) this repo has never used Conventional Commits, and multiple sources I checked specifically flag that *retrofitting Conventional Commits onto an existing history is disruptive* — every future commit would need the discipline, with no benefit to the 181 commits already written; (2) both tools fundamentally output a *developer-facing* changelog (Added/Fixed/Changed bullet lists derived mechanically from prefixes) — exactly the raw, technical format the user's own editorial constraint (Part 7) rules out for the public page. It's more the right shape for something like `CHANGELOG.md` than for `/release-notes`.

**Changelog vs. release notes, in general:** every source I checked draws the same line this project already draws on its own: a changelog/commit log is for developers, a release-notes page is user-facing curated communication. *"Using commit log diffs as changelogs is a bad idea — they're full of noise... Commit logs are for developers, while a changelog is for users."* Keep a Changelog's own standard (Added/Changed/Fixed/etc. categories) is itself still framed as more technical than what a consumer-facing "here's what's new" page should read like. This validates the project's existing `release-notes.ts` header comment almost word for word.

**LLM-generated release notes and hallucination risk:** this is real and documented, not a hypothetical concern. Sources specifically warn that models "may invent details not present in code diffs, misattribute changes, exaggerate or omit modifications," and that AI-generated changelogs specifically need human review, "particularly with version numbers and dates." The consistent mitigation across sources is: never auto-publish LLM output directly — route it through a draft/PR/review step a human confirms before it goes live. This directly informs the recommendation below.

**Avoiding commit loops when a workflow commits back to the repo:** GitHub's own behavior already solves most of this for free — a push made using the default, auto-provisioned `GITHUB_TOKEN` **does not trigger other `push`-triggered workflows** (this is intentional, built-in loop prevention). Loops only become a real risk when a workflow uses a personal access token or GitHub App token instead (needed only if you must bypass branch protection) — which doesn't apply here, since `main` isn't protected. `[skip ci]` in the commit message is the standard extra failsafe layered on top when using a PAT. For this repo, sticking to `GITHUB_TOKEN` for any bot commit is both simpler and sufficient.

**Semantic versioning for a continuously-deployed web app with no external consumers:** the standard case for SemVer is signaling breaking changes to *something that depends on your version number* (a downstream package, an API contract). This project has no published package, no API consumers, and — confirmed above — no version number surfaced anywhere on the live site today. The research doesn't support introducing SemVer machinery here; a date-based "release" concept (which `release-notes.ts` already uses) is the better fit and requires no new machinery to introduce.

## 6. Options considered

**Option A — GitHub Actions workflow, triggered on push/tag/release.**
Runs in GitHub's infrastructure, not tied to any one machine, works identically whether a commit was made locally or through the GitHub web UI. Standard, well-documented, no dependency on any particular contributor's laptop being configured a certain way.

**Option B — Local git hook (post-commit).**
Rejected as the primary mechanism: only runs on whichever machine has the hook installed, doesn't fire for commits made through GitHub's web UI or by a collaborator who hasn't set up the hook, and hooks aren't version-controlled by Git itself (they'd need a separate install step). Given this repo's work happens through Claude Code sessions that could run from different machines, a local hook is the wrong place to put anything that must be reliable.

**Option C — GitHub Actions + generated content (LLM- or heuristic-driven), auto-publishing.**
Rejected as the *primary* release-notes mechanism specifically because of the hallucination risk documented above, and because it's the pattern most likely to produce exactly what Part 7 rules out — a bot with no product context turning a diff into either a raw commit-log dump or a plausible-sounding but wrong summary, publishing it without review. Not worth the runtime LLM dependency the user already leans against, either.

**Option D — Hybrid.** *(Recommended — see §7.)*
Commit-time editorial judgment (by whoever/whatever is actually making the change, with full context — no summarization-from-a-diff involved) for anything requiring judgment or prose, paired with CI-time automation *only* for what's mechanically safe to fully automate (extracting already-true facts, or flagging a gap for a human to look at) — never CI-time content generation.

## 7. Recommended architecture

The core insight from the investigation: **the entity best positioned to write a good release note is whoever is making the change, at the moment they make it** — not a CI job reading a diff afterward with none of the context. Every commit in this repo today is written by a Claude Code session that already understands *why* the change matters to a reader, because it just built it. `release-notes.ts`'s own header comment already asks for exactly that judgment call. The actual gap isn't missing tooling — it's that this step gets skipped under time pressure and nothing catches the omission.

So the design has two tiers, and only one of them is genuinely automated in the CI sense:

**Tier 1 — Editorial (commit-time, not CI, not new infrastructure):** Codify, in `CLAUDE.md` and reinforced in `release-notes.ts`'s own comment, that a commit shipping a public-facing change updates `release-notes.ts` **in that same commit** — not a follow-up commit, not a separate workflow. This is a process/convention change, not code. It costs nothing to build and has zero commit-loop or hallucination risk because there's no automation involved at all — it's the same discipline already documented, just actually followed.

**Tier 2 — Mechanical safety net (CI, fully automatic, zero judgment calls):**
1. **README "Current Status" sync.** A small, clearly-delimited block in the README (between HTML comment markers) containing only facts that can be extracted with no interpretation: the latest release-note headline + date (verbatim from `release-notes.ts`), a link to `/release-notes`, and maybe a test-count/build-status badge. A tiny script regenerates just that block from `release-notes.ts` (and optionally `package.json`/CI status), and a GitHub Action runs it on every push to `main`, committing only if the block's content actually changed. Zero prose is generated — it's templating over already-true data, so there's nothing to hallucinate.
2. **Missing-release-note detector.** On the same push-to-`main` trigger: if the pushed commit(s) touch product code (`src/app/**`, `src/components/**`, `src/lib/**`, `supabase/migrations/**`, excluding test files) **and** don't also touch `src/lib/release-notes.ts`, post a note in the workflow's job summary (and optionally open/update a single tracking GitHub Issue) flagging it for follow-up. It does not write a release note itself — it only flags that Tier 1 may have been skipped. Deliberately biased toward over-flagging (a human/agent dismissing an occasional false positive is cheap; silently missing a real feature is the problem being solved).

Both Tier 2 jobs use the default `GITHUB_TOKEN` (confirmed sufficient since `main` isn't branch-protected), which — per GitHub's own documented behavior — cannot retrigger a `push`-based workflow, closing off the commit-loop risk without needing `[skip ci]` markers, though I'd still add one as a cheap, explicit failsafe.

**What this deliberately does not include:** a runtime LLM call anywhere in the pipeline, a CHANGELOG.md, SemVer/tags, Conventional Commits, or routine GitHub Releases automation. See §11/§12 for the reasoning on each.

## 8. Artifact strategy

| Artifact | Update frequency | Trigger | Source of truth | Automatic? |
|---|---|---|---|---|
| `release-notes.ts` (→ `/release-notes`) | Per meaningful user-facing change | Same commit as the change itself | Itself (hand-curated) | No — this is where editorial judgment belongs, by design |
| README — prose sections | Rare, on real structural/stack changes | Manual, as needed | The repo itself | No |
| README — "Current Status" block | Every push to `main` (if changed) | GitHub Action | `release-notes.ts` | Yes — pure data extraction, no prose generated |
| Missing-release-note flag | Every push to `main` | GitHub Action, path-based heuristic | The push's own diff | Yes (detection only — never writes content) |
| `sitemap.xml` `lastModified` | Already automatic today | Already wired to `release-notes.ts[0].date` | `release-notes.ts` | Already automatic — unchanged by this proposal |
| GitHub Release | Occasional (e.g. monthly), optional | Manual, or a light periodic job | Links to `/release-notes`, doesn't duplicate it | Optional, low-priority, not part of the core build |
| `CHANGELOG.md` | N/A | — | — | Not recommended — see §11 |
| Tags / SemVer | N/A | — | — | Not recommended — see §11 |

## 9. Proposed workflow (full lifecycle)

```
1. A change is made (Claude Code session or otherwise) that a returning
   reader/user would actually notice.
        │
        ▼
2. The SAME commit updates release-notes.ts with a curated entry,
   following the file's own existing header-comment conventions
   (date = ship date, headline = reader sentence, detail = 2-3 sentences,
   no commit-log language). This is a convention, enforced by CLAUDE.md,
   not by code.
        │
        ▼
3. git push origin main
        │
        ├──────────────────────────────┐
        ▼                              ▼
4a. Vercel (existing, unchanged)   4b. GitHub Action (new)
    builds + deploys automatically     - regenerates README's status
    on every push                        block from release-notes.ts,
        │                                 commits ONLY if it changed
        ▼                              - checks whether this push touched
5a. brodyhaar.com/release-notes         product code without touching
    is live and current                 release-notes.ts; if so, flags
                                         it in the job summary (does not
                                         write content)
```

A missed step 2 doesn't break anything — the site stays up either way — it just gets caught by 4b's flag for someone to fix in a follow-up commit, rather than silently drifting for weeks the way it has been.

## 10. Risks

- **Commit loops:** Addressed structurally — default `GITHUB_TOKEN` commits don't retrigger push workflows (GitHub's own documented behavior), and the status-sync job only commits when content genuinely changed (an idempotence check, e.g. `git diff --quiet` before committing), so it can't cascade even in principle.
- **Noisy release notes:** Avoided by design — nothing is auto-published to `release-notes.ts`. The only fully-automatic writes are the mechanical README block (facts only) and an issue/flag (no prose about the change itself, just "check this").
- **Accidental overwrites of manually-edited content:** The status-sync script should only ever touch the content strictly between its own marker comments in the README, never the surrounding hand-written prose — same "don't touch what you don't own" discipline the rest of this codebase already follows (e.g. `ImageSlot`, `Container` variants). `release-notes.ts` itself is never touched by any automation.
- **Hallucinated summaries:** Structurally avoided by not having a CI job generate prose from a diff at all. The only prose-writing step is Tier 1 — a human/Claude session with full context, at commit time, same as it already is today.
- **Authentication/token security:** Default `GITHUB_TOKEN`, scoped to the single job run, no PAT or GitHub App needed since `main` isn't branch-protected — the smallest realistic credential footprint.
- **Concurrent runs:** Two pushes landing close together could both trigger the Action; GitHub Actions' default concurrency is per-workflow-run, not blocking, so both could try to commit a status update. Mitigated by (a) the idempotence check meaning a second run typically finds nothing new to commit, and (b) optionally setting a `concurrency` group on the workflow so a newer run cancels/waits for an in-flight one rather than racing it.
- **Failed updates:** If the status-sync job fails (e.g. a transient GitHub API error), nothing is left half-written — a git commit is atomic, so a failed job simply doesn't commit, and the next push's run picks up the (now slightly larger) diff. No partial-state risk.
- **Rerunning a failed workflow:** Safe by the same idempotence property — reruns either find no change to commit (no-op) or produce the same correct result.
- **Duplicate release-note entries:** Not applicable to the automated tier (it never writes to `release-notes.ts`); for the manual/editorial tier, this is a human/agent discipline question, same as any other hand-edited file, not something automation introduces risk to.
- **Manually edited release notes:** Since `release-notes.ts` is *only ever* hand-edited (never touched by automation), there's no conflict class here at all — automation and manual editing never write to the same file.
- **Force pushes / commits directly to main:** The proposed Action triggers on `push` to `main` regardless of how the push arrived (force-push or ordinary), so it still runs; a force-push rewriting history could in principle make the "which commits are new since last run" comparison for the missing-release-note check less precise, but since that check is advisory-only (a flag, not a gate), an imprecise result in a rare force-push scenario has no real consequence.
- **Editorial quality:** The one risk this design *doesn't* eliminate, on purpose — Tier 1 still depends on the commit-time discipline being followed. That's an accepted tradeoff: the alternative (CI-generated prose) trades a process risk for a hallucination risk, which is the worse trade per the research above.

## 11. Implementation plan (for when approved)

Small, independently verifiable steps, in order:

1. **Codify the convention.** Add a short section to `CLAUDE.md` (§12/§13 area) stating the Tier 1 rule explicitly, and lightly tighten `release-notes.ts`'s own header comment if anything's ambiguous. No code changes. Verifiable by reading the diff.
2. **Add the README status block.** Manually seed the `<!-- STATUS:START -->...<!-- STATUS:END -->` markers and their initial content once, by hand, so the file's shape is correct before any automation touches it. Verifiable by viewing the rendered README on GitHub.
3. **Write the sync script** (`scripts/sync-readme-status.mjs` or similar), runnable locally via `node scripts/...`. Verify it correctly regenerates only the marked block, leaves everything else byte-for-byte untouched, and is a no-op when nothing's changed. Testable without any GitHub Actions involvement at all.
4. **Write the missing-release-note check** as its own small script, runnable locally against a given commit range, before wiring it into CI. Verify it correctly flags a synthetic "touched src/, didn't touch release-notes.ts" case and correctly stays quiet on a "touched only tests/docs" case.
5. **Add the GitHub Actions workflow file**, wiring steps 3 and 4 together, triggered on `push` to `main`, using default `GITHUB_TOKEN`, with the idempotence guard before any commit. Test first via `workflow_dispatch` (manual trigger) against a throwaway branch before relying on the real `push` trigger, so nothing runs unsupervised on `main` until it's been watched succeed once.
6. **Only then** rely on it firing automatically on real pushes to `main`, and watch the first few real runs.

Each step above can be committed and reviewed independently — none of them depend on a later step existing yet.

## 12. Recommendation

**Build:**
- The Tier 1 convention (documentation-only change to `CLAUDE.md` / `release-notes.ts`'s comment) — this alone would likely close most of the actual gap, since the editorial philosophy was already right.
- The README "Current Status" block + its sync script + the GitHub Action that runs it on every push, committing only on real change.
- The missing-release-note detector as a same-workflow, second step — flag-only, never content-generating.

**Deliberately not build:**
- Any runtime LLM call, anywhere in the pipeline. The research supports this and it matches the stated preference — the project doesn't need it because the actual author of every change already has full context at commit time.
- `CHANGELOG.md` as a separate file. It would either duplicate `release-notes.ts` or become the raw commit-log dump the editorial constraint explicitly rules out for the public surface; `git log` already serves the "raw technical history" need for anyone who wants it.
- Conventional Commits / semantic-release / release-please. No PR workflow for them to hook into, retrofitting onto 181 existing free-form commits isn't worth it, and their native output format is more technical than this project's public voice.
- SemVer or git tags as a routine, automated practice. Nothing in the codebase or deployment reads a version number today, and there's no external consumer for one to mean anything to.
- Automated GitHub Releases on every push. Low value without PRs/labels to categorize by, and would either duplicate `release-notes.ts` or need its own LLM-authored summary — both already rejected above. A very occasional, manually-created Release that just links to `/release-notes` is fine if ever wanted, but it's genuinely optional and not part of this build.
- A local git hook as the enforcement mechanism — doesn't fire reliably across machines/GitHub-web commits, which this project's actual workflow needs to support.
