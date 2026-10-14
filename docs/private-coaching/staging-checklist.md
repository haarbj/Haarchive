# Private Coaching — Staging & Private-Beta Checklist

Companion to `prd.md`/`trd.md` in this directory. This is the punch list for getting the already-built, already-security-tested private coaching MVP onto a real Supabase staging project and in front of a small beta, without adding scope. Nothing here changes the schema, adds a dependency, or touches production.

## 0. Where things stand

- 7 migrations (`20260825010000`–`070000`), reviewed twice for security (2 blockers + 5 highs + 2 lows found and fixed pre-apply).
- 53/53 adversarial RLS tests pass against real Postgres 17 (`npm run test:rls:up && npm run test:rls` — see `tests/rls/README.md`). Covers coach isolation, athlete isolation, messaging column-level privileges, relationship revocation, invite lifecycle, service-role boundary, and a named regression test per original audit finding.
- `tsc`, `eslint`, `npm test` (1425 tests), `npm run build` all pass on current `main`.
- **Not yet tested:** the actual Supabase Auth/PostgREST/Storage stack (the RLS harness deliberately doesn't reproduce it — pure Postgres only). Staging is what closes that gap.

## 1. Staging environment ($0)

- [ ] Create a new, separate Supabase project (free tier) — do not reuse or point at production.
- [ ] Copy `.env.example` into the staging Vercel project's Environment Variables (Preview or a dedicated staging env), pointing at the *staging* project's URL/anon key/service-role key. All values are already documented there; nothing new was introduced by private coaching (confirmed — no new `process.env.*` reads anywhere under `src/lib/private-coaching/`, `src/app/(app)/(protected)/coaching/`, or `src/app/(app)/coaching-invite/`).
- [ ] In the staging Supabase project's Auth settings, set **Site URL** and **Redirect URLs** to the staging domain (this is dashboard config, not code — easy to forget and it silently breaks OAuth/email-confirmation redirects if skipped).
- [ ] Confirm `ADMIN_EMAILS` is set on staging too, or `/admin` is unreachable there.
- [ ] No new services needed: invite delivery is copy-a-link (same pattern as the existing team `coach_invites`), messaging/notifications are poll-based (15s/45s), no email/SMS provider, no realtime infra.

## 2. Apply migrations to staging

```bash
npx supabase migration list           # capture current remote state first
npx supabase link --project-ref <STAGING_PROJECT_REF>
npx supabase db push                  # first real remote migration apply — staging only
npx supabase migration list           # confirm all 7 private-coaching migrations now show applied
```

Do not run this against production. Migrations are chronologically last (`20260825*`, after `20260822020000_four_domain_category_backfill.sql`) and were validated to apply cleanly and in order against a full 54-migration history by the RLS harness — staging should behave the same, but this is still the first time they hit a real Supabase Postgres instance (GoTrue-managed `auth.users`, real `auth.uid()` via PostgREST, real Storage), which the harness's shim only approximates.

## 3. Manual two-coach/two-athlete adversarial pass (real Supabase Auth this time)

Redo the harness's matrix by hand, through the actual UI, with 4 real accounts (Coach A/B, Athlete A/B) and an unrelated Athlete C. This is the one thing the Postgres-only harness structurally cannot cover — real GoTrue sessions, real PostgREST role selection, real browser cookies.

**Coach isolation** — Coach A can see/message/schedule for Athlete A; cannot open Athlete B's profile, see their workouts, message them, or see Coach B's roster (try navigating directly to a guessed/copied URL, not just checking nav — the point is confirming RLS still holds even if someone tries the URL directly).

**Athlete isolation** — Athlete A sees their own schedule, can complete/comment/message/check in; cannot reach Athlete B's data or Coach A's templates via direct URL.

**Revocation** — With Coach A → Athlete A live: send a message, create a workout, have Athlete A complete it. Then remove Athlete A from the roster. Confirm Coach A can no longer message, schedule, or read Athlete A's coaching data — and confirm Athlete A can no longer see anything coach-authored either.

**Invite edge cases** — pending invite grants no access yet; a second invite to the same email while one is already pending is rejected with a clear message (not a silent duplicate); revoking a pending invite works.

## 4. Product smoke test (full lifecycle, both roles)

**Coach:** sign up → get `private_coach` permission granted (admin-only today, via `/admin/users` — no self-serve upgrade path exists yet, confirm this is intentional for a small beta) → `/coaching` → invite athlete → roster shows them once accepted → create a template → schedule a workout from it → publish → athlete completes it → review the completion → comment → message → check the athlete's page after their weekly check-in.

**Athlete (fresh signup via invite link):** click invite link while signed out → sign up with the exact invited email → **confirm what actually happens next** (see finding below — today this lands on `/dashboard`, not `/coaching`, with no visible confirmation that the invite was accepted) → find Coaching via Account menu → view today's workout → complete it → comment → message coach → submit weekly check-in.

**Athlete (existing account):** open invite link while already signed in with the matching email → `AcceptButton` → redirects to `/coaching` (this path *does* confirm correctly).

Watch specifically for: confusing terminology, dead ends, unclear workout status (draft vs. published already reads clearly — verify it still does on a real phone), notification tap targets landing somewhere sensible, empty states, mobile keyboard/scroll behavior in the message thread.

## 5. Findings from this session's code audit (none block staging; two are already fixed)

**Fixed in this pass (no schema/dependency change, both covered by existing/updated unit tests):**
- `notification-href.ts`: `message_received` and `checkin_submitted` notifications were still routing to the generic `/coaching` page under a stale "no detail page yet" comment — the specific thread page and the athlete detail page (which now renders check-ins) both exist. Fixed to deep-link correctly; `pain_reported` deliberately left on the generic fallback (see below).
- `trd.md`: updated the "RLS not executed against a live database" section, which this session's harness work resolved.

**Worth a look before beta, not a blocker (not changed — outside this pass's scope to redesign):**
- `pain_reported` notifications are fired from two places with two different `relatedEntityId` shapes (a check-in passes an athlete id; a workout completion passes a workout id). A single href resolver can't tell which without an extra DB read, so it safely falls back to `/coaching` for both rather than risk a wrong deep link. Fine for now; a real fix would split it into two distinct notification types.
- No fresh-signup confirmation: a brand-new athlete who signs up from an invite link lands on `/dashboard`, not `/coaching`, with no on-screen confirmation the relationship was created (it was — the DB trigger runs regardless). This is a site-wide limitation (`signUp`/`signIn` in `src/app/(app)/auth-actions.ts` always redirect to `/dashboard`, no `next`-param support, unlike the OAuth callback route which does support one), not specific to coaching. Worth fixing if first-run confusion shows up in the beta, but it's not a dead end — the athlete can still find Coaching via the Account menu.
- No direct "Message this athlete" link from a coach's athlete-detail page (`/coaching/athletes/[athleteId]`) — messaging only starts from the Messages index. One extra click, not a dead end.
- Navigation lives in the Account dropdown ("Coaching," shown for `isPrivateCoach`/`isCoachedAthlete`), same pattern as the existing team-coaching "Coach Dashboard" entry — confirmed present and correct, not a gap (double-checked directly, since `site-header.tsx` itself has no coaching-specific code and could look like a miss at a glance).

## 6. Explicit non-goals for this phase

No new features. No Stripe/billing, no transactional email, no AI, no analytics infrastructure, no native app, no Realtime. If staging/beta surfaces a real blocker, fix that specific thing — don't use it as licence to build the next phase early.

## 7. Then, only after staging + manual passes above are clean

```bash
npx supabase link --project-ref <PRODUCTION_PROJECT_REF>
npx supabase db push
```

Immediately after: grant yourself `private_coach`, add one real test athlete, run the full lifecycle yourself, confirm existing team-coaching and the rest of the site are unaffected. Don't grant `private_coach` to anyone else until that's clean.
