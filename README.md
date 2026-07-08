# _The Haarchive_

Created by: **Brody Haar**

**Haarchive** is a long-form educational resource on distance running — training theory, exercise physiology, sports psychology, and coaching practice — built and written from scratch as a statically-exported Next.js site, deployed via GitHub Actions to a custom domain on GitHub Pages.

It's also home to ["The Onus to Quit,"](https://brodyhaar.com/articles) an essay on training the body and strengthening the mind.

## What's here

- **A structured content library** spanning six categories — Foundations, The Science, Coaching & Training, Mind & Recovery, Writing & Resources, and Tools — covering everything from VO2 max and lactate threshold to periodization, polarized training, and recovery science. Content is modeled as typed data (`src/lib/sections.ts`) and rendered through a single generic page template, so adding a new topic is a data change, not a new page.
- **The Heat Tracker**, an interactive tool that resolves the visitor's location (via geolocation, with a manual fallback), pulls a 48-hour weather forecast, and renders it as a scrubbable WBGT (Wet Bulb Globe Temperature) chart with heat-illness risk flagging — built with an SVG-based custom chart, no charting library.
- **Long-form writing**, including full essays with pull quotes and citations, rendered with attention to typography: readable line lengths, deliberate spacing, and anchor-linkable headings.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, static export) + [React](https://react.dev) 19
- TypeScript, strict mode
- [Tailwind CSS](https://tailwindcss.com) 4, with full light/dark mode support
- ESLint
- Deployed via GitHub Actions (`.github/workflows/deploy.yml`) → GitHub Pages, served at a custom domain

No backend, no database, no client-side data fetching library — content is compiled into a fully static site at build time, save for the Heat Tracker's runtime weather API call.

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run build
```

`npm run build` performs a full static export (`next build` with `output: "export"`), matching what CI runs before deploy.

## Project structure

```
src/
  app/            # Routes (App Router) — generic [slug] page, layout, homepage
  components/     # UI components (site chrome, Heat Tracker, pull quotes, etc.)
  lib/            # Typed content model — categories, sections, and all page content
```
