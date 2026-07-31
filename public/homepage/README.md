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

**Two exceptions to "a file lands here":**
- The "Why This Exists" diagram is a `<Diagram>` (`src/components/ui/diagram.tsx`),
  not an `<ImageSlot>` -- it's meant to be hand-authored inline SVG passed
  as its `children`, not a file in this folder. See the visual system doc
  for why (zero asset weight, exact dark-mode color control via the site's
  own `--accent-*` custom properties).
- Every real (non-placeholder) image should be wrapped in `<Figure>`
  (`src/components/ui/figure.tsx`) once it exists, so it can carry a
  `caption`/`attribution` in the one consistent style -- already wired up
  around all three slots below, just with no caption text yet.

## Manifest

| File (planned)              | Slot (in about-page.tsx)          | Aspect  | Guidance                                                                                                                                                                     |
| ---------------------------- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| *(inline SVG, no file)*       | "Why This Exists" (`<Diagram>`)     | video   | A simple line diagram of one mechanism this site explains well (e.g. the adaptation curve, or aerobic/anaerobic energy pathways). Single accent color line art (`stroke="var(--accent-research)"` or similar) on a dark background, not a glossy 3D render -- this is the one slot doing the most work to say "research archive," not "fitness brand." Diagrams like this one are the priority visual type for the site going forward, ahead of photography -- see the visual-system doc for where else they belong. |
| `timeline-brophy.*`           | "My Story" (timeline, stop 1)       | square  | High school era -- racing or training in Brophy colors, Flagstaff altitude camp if available.                                                                              |
| `timeline-run22.*`            | "My Story" (timeline, stop 2)       | square  | A screenshot of the Run22 Strava group, or a solo-training photo from the COVID lockdown era.                                                                               |
| `timeline-vanderbilt.*`       | "My Story" (timeline, stop 3)       | square  | Racing in Vanderbilt colors -- a cross country meet, ideally one that shows the SEC-level field.                                                                            |
| `timeline-marathon.*`         | "My Story" (timeline, stop 5)       | square  | Race day or a long-run training moment from the Nashville marathon buildup.                                                                                                 |
| `timeline-coaching.*`         | "My Story" (timeline, stop 6)       | square  | Actively coaching -- a workout on the track, a race on the sideline, not a posed shot.                                                                                       |
| `lydiard-archival.*`          | "Coaching Philosophy"               | portrait | A notebook page, handwritten workout, or physiology sketch -- Lydiard's own or a period-appropriate equivalent. Emphasizes the idea, not a portrait of the person. Needs a usage-rights check if sourced from an existing archive. |
| `calculator-screenshot.*`     | "Tools & Accounts"                  | video   | A real, cropped screenshot of a calculator's results panel (Pace & Heart Rate is the obvious pick, since it's the one named in that section's own copy). Framed plainly -- no browser chrome, no device mockup. Hold off until that calculator's own UI is finalized. |

Five separate small photos for "My Story," not one portrait -- the
progression itself (Brophy → Run22 → Vanderbilt → Marathon → Coaching) is
the point. "Stepping off the plan" (timeline stop 4) deliberately has no
photo slot -- it's about reading, not a place or moment.

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
