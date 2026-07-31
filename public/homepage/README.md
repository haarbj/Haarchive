# Homepage image assets

Files land here as they're sourced. Same convention as `public/coaches/`
(e.g. `tom-schwartz.jpg`): a real file checked into the repo, referenced by
its root-relative path, rendered with `next/image` -- no CMS, no external
host, no `next.config.ts` changes needed (that config is only required for
*remote* URLs; local files under `/public` just work).

Once a file exists, wire it up in `src/components/about-page.tsx` by
passing `src="/homepage/<filename>"` to the matching `<ImageSlot>` call --
that's the only code change. Everything else (aspect ratio, responsive
sizing, spacing) is already built and won't need to move.

Most slots use a fixed `aspect` box with `object-cover` (the default) --
right for a photo with room to spare at the edges. Three slots below
(books, training log, calculator screenshot) instead pass `naturalSize={{
width, height }}` -- the source file's own real pixel dimensions -- which
renders the image at its own actual shape with no forced box, no crop,
and no letterboxing at all. Use `naturalSize` for anything where every
edge is real content (a full page of handwriting, a UI screenshot); use
the default `aspect` + `cover` for a normal photo.

**Two exceptions to "a file lands here":**
- The "Why This Exists" diagram is a `<Diagram>` (`src/components/ui/diagram.tsx`),
  not an `<ImageSlot>` -- it's meant to be hand-authored inline SVG passed
  as its `children`, not a file in this folder. See the visual system doc
  for why (zero asset weight, exact dark-mode color control via the site's
  own `--accent-*` custom properties).
- Every real (non-placeholder) image should be wrapped in `<Figure>`
  (`src/components/ui/figure.tsx`) once it exists, so it can carry a
  `caption`/`attribution` in the one consistent style -- already wired up
  around the diagram, books, training log, and screenshot slots below
  (not the timeline photos, which are small inline thumbnails where the
  surrounding prose already provides context), just with no caption text
  written yet.

## Manifest

| File                          | Slot (in about-page.tsx)          | Status | Aspect  | Guidance                                                                                                                                                                     |
| ------------------------------ | ----------------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| *(inline SVG, no file)*         | "Why This Exists" (`<Diagram>`)     | **Wired up** | video   | The supercompensation curve, redrawn with named phase bands (Before / Training / Recovery / Supercompensation / Detraining) after the first version's plain "workout"/"adaptation" labels tested as too sparse against reference diagrams. Still single accent color, no red/yellow/green. Hand-authored directly in about-page.tsx's JSX, not a file. |
| `timeline-brophy.jpg`           | "My Story" (timeline, stop 1)       | **Wired up** | square  | Brody wearing a state championship medal at an AIA meet in Brophy colors -- a real photo, clean match for the original guidance. (An earlier pass here mistakenly described this file as the school's crest/logo -- it never was; that was a misreading of a different image shown earlier in the same conversation, not a file that changed.) |
| `timeline-run22.jpg`            | "My Story" (timeline, stop 2)       | **Wired up** | square  | Run22's own logo -- the one deliberate exception to "photo, not logo" in this progression, since it's Brody's own community's mark, not a third party's. |
| `timeline-vanderbilt.jpg`       | "My Story" (timeline, stop 3)       | **Wired up** | square  | Brody racing at the NCAA Cross Country South Region Championships in Vanderbilt colors -- a real photo, clean match for the original guidance. (Same correction as Brophy above -- not the university's logo.) |
| `timeline-marathon.jpg`         | "My Story" (timeline, stop 5)       | **Wired up** | square  | Brody crossing the finish line at the Nashville Rock 'n' Roll Marathon in Brophy colors. Clean match for the original guidance. |
| `timeline-coaching.jpg`         | "My Story" (timeline, stop 6)       | **Wired up** | square  | Doesn't literally depict coaching (a candid shot, not an action photo) -- used anyway per an explicit call. Alt text describes what's actually shown rather than claiming it's a coaching moment. |
| `how-i-learn-books.jpg`         | "How I Learn"                       | **Wired up** | `naturalSize` | A real photo of the actual coaching/running books. Renders at its own real proportions (3005×1952, `naturalSize`, no forced aspect box) after every crop attempt (plain center, an `objectPosition` bias, "contain" inside a 16:9 box) either cut off a book or left artificial letterbox space. |
| `coaching-training-log.jpg`     | "Coaching Philosophy"               | **Wired up** | `naturalSize` | Brody's own training log from coach Mike Scannell, replacing the original plan (a Lydiard-era artifact, which would have needed a rights check Brody's own document doesn't). Sized at `max-w-md` (up from `w-48/w-56`) so the handwriting is actually readable. Renders at its own real proportions (2397×3627, `naturalSize`) -- neither "cover" nor "contain" inside `aspect="portrait"` matched the source's own ~0.66 ratio cleanly. |
| `calculator-screenshot.png`     | "Tools & Accounts"                  | **Wired up** | `naturalSize` | Captured directly from the live Pace & Heart Rate Calculator (Playwright, 640px viewport) rather than supplied as a file -- a real result (18:30 5K), no browser chrome. Renders at its own real proportions (1184×596, `naturalSize`) -- every edge of this card is real text running close to its own padding, so any forced box (cover *or* contain, at any aspect ratio) was either cropping something or adding visible letterbox bars. No colored frame -- tried one (tinted border + background) to signal "this is an image," but the results card already has its own ring styling baked into the captured pixels, and the two borders nested together read as a rendering glitch. A short `Figure` caption does that job instead, through text. PNG, not JPEG: it's a UI screenshot, and PNG keeps the text edges crisp. |
| *(external URL, no file)*       | Homepage hero ("Featured essay" CTA) | **Wired up** | -- | Not a `public/homepage/` asset -- reuses "Why Running Is Valuable for Everyone"'s own `cover_image_url` (queried from the `articles` table), via a new `imageUrl` prop on `FeaturedEssay`. Hardcoded in about-page.tsx; update it if that article's cover image ever changes. |

Five separate small photos for "My Story," not one portrait -- the
progression itself (Brophy → Run22 → Vanderbilt → Marathon → Coaching) is
the point. "Stepping off the plan" (timeline stop 4) deliberately has no
photo slot -- it's about reading, not a place or moment.

`timeline-coaching.jpg` and `timeline-vanderbilt.jpg` are large source
files (9.9MB and 2.8MB) -- `next/image` optimizes what actually ships to a
visitor regardless, so this isn't a runtime performance problem, just
worth knowing it's adding real weight to the git history if that ever
matters.

## Recommended, not yet wired up

One more spot would benefit from imagery but isn't built as an
`<ImageSlot>` placeholder yet, since it's closer to a design decision than
a drop-in asset:

- **"What You'll Find Here" category list** -- a small icon per category
  (reusing the exact pattern already shipped on `/tools`: `lucide-react`
  icon in a small tinted chip, one restrained accent color per category,
  never a full-color wash) would give the six categories a visual identity
  without any photography at all. See `src/lib/tool-visuals.ts` and
  `src/components/tool-card.tsx` for the pattern to copy.

The "How I Learn" influences grid (Seiler, Daniels, Canova, Vigil,
Magness) was previously considered for the same avatar-photo treatment as
Lydiard, but per the same direction that moved Lydiard away from a
portrait, archival material (a paper, a notebook, a diagram of their own)
would fit better than a face here too, if these ever get imagery at all.
