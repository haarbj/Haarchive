# _The Haarchive_

Created by: **Brody Haar**

**Haarchive** started as a long-form educational resource on distance running — training theory, exercise physiology, sports psychology, and coaching practice — and has grown into a full coaching platform built on top of that same content: a deterministic training-plan engine, an AI layer that explains and adapts what the engine produces (never the other way around), and a coach-facing platform a real high school cross country program uses to build and publish team training schedules.

It's also home to ["The Onus to Quit,"](https://brodyhaar.com/articles) an essay on training the body and strengthening the mind.

## What's here

- **A structured content library** spanning six categories — Foundations, The Science, Coaching & Training, Mind & Recovery, Writing & Resources, and Tools — covering everything from VO2 max and lactate threshold to periodization, polarized training, and recovery science. Content is modeled as typed data (`src/lib/sections.ts`) and rendered through a single generic page template, so adding a new topic is a data change, not a new page.
- **The Heat Tracker**, an interactive tool that resolves the visitor's location (via geolocation, with a manual fallback and live autocomplete), pulls a weather forecast, and renders it as a scrubbable WBGT (Wet Bulb Globe Temperature) chart with heat-illness risk flagging — built with an SVG-based custom chart, no charting library.
- **A deterministic coaching engine** (`src/lib/coaching-engine`) — pace/HR zones, race-time prediction, mileage progression, periodization, and calendar scheduling as plain, tested TypeScript functions. Every number on screen traces back to a function a unit test can verify; the AI layer only ever narrates or adapts what the engine already computed, never generates it from scratch.
- **An AI layer** (`src/lib/ai`) that explains why a given session is prescribed (grounded in retrieval over the site's own educational content, not generic model knowledge) and adapts a plan through tool-calling — "I only have 35 minutes today" resolves to a real deterministic adaptation function, not a freehanded response.
- **A coach-facing team platform** (`/coach`) — coaches build a season, organize athletes into training groups, author a shared weekly schedule per group (including a spreadsheet-style bulk-entry grid), publish it to athletes, and track logged race results against each athlete's goal. Athletes get a real running log (distance, time, HR, RPE, notes) instead of a bare completion checkbox.
- **Individual self-serve coaching** — goal-driven training-plan generation for an athlete not on a team, sharing the same coaching engine and AI layer as the coach platform above.
- **Long-form writing**, including full essays with pull quotes and citations, rendered with attention to typography: readable line lengths, deliberate spacing, and anchor-linkable headings.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router — Server Components/Actions, not static export) + [React](https://react.dev) 19
- [Supabase](https://supabase.com) — Postgres, Auth, and Row-Level Security enforced at the database itself, not just the application
- AI SDK (`ai`) with Groq as the model provider, behind a provider-agnostic abstraction
- TypeScript, strict mode; [Zod](https://zod.dev) for shared validation
- [Tailwind CSS](https://tailwindcss.com) 4, with full light/dark mode support
- [Vitest](https://vitest.dev) for unit tests; ESLint
- Deployed on Vercel, git-integrated (no custom CI workflow)

## Development

```bash
npm install
npm run dev
```

Requires a `.env.local` with Supabase project credentials (URL, anon key, service role key) and an AI provider API key. Database schema is version-controlled SQL under `supabase/migrations/`, applied via the Supabase CLI (`npx supabase db push`).

## Checks

```bash
npm run lint
npm run build
npm run test
```

## Project structure

```
src/
  app/
    (app)/(protected)/  # Authenticated app shell — dashboard, plan, coach, admin, settings
    api/coach/          # Route handlers for the adapt/explain AI tool-calling surface
    auth/               # OAuth callback, Strava connect
    [slug]/             # Generic content-library page template
  components/           # Site chrome, Heat Tracker, Pace Calculator, shared UI
  lib/
    coaching-engine/     # Deterministic: paces, zones, periodization, progression, scheduling
    ai/                  # Provider abstraction, prompts, RAG retrieval over the content library
    db/                  # Supabase client (browser, server, service-role)
    auth/                # Session helpers
    strava/              # Activity-sync mapping
    validation/          # Zod schemas shared by forms and server actions
    sections.ts          # Typed content model for the educational library
supabase/migrations/     # Versioned SQL — schema as code
tests/                   # Vitest — mirrors src/lib
```
