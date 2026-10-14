# 06 — Design System

Visual and interaction treatment for the coaching platform, built on the Haarchive's existing token system (`src/app/globals.css`'s `@theme` block — see `CLAUDE.md` §2) rather than inventing a parallel one. The public site's identity is editorial, restrained, and information-dense with clear hierarchy; the coaching product is a working tool, not an article. This document reconciles those two facts rather than treating them as a conflict.

---

## 1. Same tokens, denser application

No new color palette, no new type scale. `--surface`/`--surface-muted`/`--hairline`, the seven `--accent-*` semantic colors, `--radius-card`/`--radius-control`, and the existing `Container`/`Card`/`Badge`/`Heading` primitives (`CLAUDE.md` §7) are reused as-is. What changes between the editorial site and the coaching tool is **density and rhythm**, not the underlying tokens: a workout card in the week composer uses the same `Card` component and `--surface` token as an article's callout box, at a smaller `padding` value and tighter `gap` than the site's own generous whitespace convention favors elsewhere. This matches the site's own stated principle (`CLAUDE.md` §2: "information density is acceptable; hierarchy and whitespace are what make it navigable") applied to a genuinely denser surface than an essay page, not a violation of it.

**One deliberate exception, stated explicitly rather than left to drift:** `--container-dashboard` (900px, already used by `/plan`, `/coach`, `/admin`, and `settings` per the existing container table in `CLAUDE.md` §7) is the correct container for every coaching page. It is not currently used consistently — `01-current-architecture.md` did not audit container usage directly, but the screenshots in `03-ux-audit.md` show content constrained to a width narrower than the full viewport in a way that doesn't match any documented container variant, which should be reconciled to `dashboard` during implementation rather than left as an undocumented fifth width.

## 2. New treatment this product genuinely needs

The public site has no existing pattern for these; they're specified fresh, using existing tokens.

### 2.1 Intent, target, and purpose

Per `05-target-architecture.md` §1.1, every prescription carries a `purpose` string adjacent to its `IntensityTarget`. Visual rule: **purpose renders first, in body text weight, directly under the workout's day label — never inside a callout, never collapsed.** This is the concrete expression of "keep the why adjacent to the what" (both source documents' shared design principle). The `IntensityTarget` itself renders as a single-line summary (e.g. "6-7 × 3min @ 90% 5K pace") using the existing `statLabelClass`/`sectionLabelClass` vocabulary from `src/lib/tool-styles.ts` — the same small-caps label convention the site already uses for calculator stat cards, reused here rather than invented.

### 2.2 Draft / published / revised state

Three states, three treatments, using existing semantic accent tokens rather than new colors:

| State | Treatment |
|---|---|
| Draft | `--accent-warning` (amber) hairline border + a small "Draft" `Badge`, matching the existing `Badge tone` pattern (`CLAUDE.md` §7) — this is not new; screenshots in `03-ux-audit.md` already show a "Draft" badge on workout cards, confirming the pattern exists and just needs to extend to the phase/week level per `05` §1.2.2 |
| Published | No badge — the unmarked, default state, since it's the common case and marking every published item would be visual noise the site's own restraint principle argues against |
| Revised | A small `--accent-tip` (sky) marker with a one-tap "what changed" affordance, per `04-target-product-experience.md` §2.6/§3.6 — new, since revision tracking doesn't exist today |

**Revised on research evidence: one badge is not enough, and a badge is the wrong primary signal.** The interaction-design research (`02` §6) found a consistent three-layer convention across publishing tools, and the corresponding failure mode when only one layer ships:

1. **Item-level treatment on the whole object**, not a corner badge. The CMS convention is a background tint across the entire row or cell, so draft-ness is legible when scanning a week rather than requiring the reader to find and parse a small chip seven times.
2. **A persistent indicator on the chrome** when the athlete-facing view differs from what the coach is looking at. Figma's model is exact and maps onto this product almost without translation: a dot on the libraries icon whose tooltip reads *"Review unpublished changes"*, opening a list of precisely what would become visible. Under the horizon publication model (`05` §1.2 invariant 3) this is the natural home for "these days are authored but sit beyond the athlete's current horizon."
3. **Two distinct commit actions** — "Save draft" and "Publish to athlete" — never one Save whose meaning depends on hidden state. This is the same principle as §3.4's no-implicit-save rule, expressed in the button labels.

**Countervailing warning, worth more than the pattern itself:** Garmin Connect's mobile calendar encodes real information in colored solid and striped lines, and its users cannot decode it — a widely-cited complaint is that the calendar shows "all sorts of blocks and a number" with no explanation. A state encoding nobody can read is worse than no encoding, because it occupies the visual budget without paying it back. Whatever ships here needs a legend or a tap-to-explain, and that requirement is part of the design, not a polish item.

### 2.3 Source labels

Every logged metric that could be manual or synced shows its source inline, small, `text-zinc-500`/`dark:text-zinc-400` (the existing muted-text convention used throughout the site for secondary metadata) — "Strava" or nothing (manual is the unmarked default, matching the draft/published pattern above: mark the exception, not the norm).

### 2.4 Exceptions (review surface)

`04` §2.5 now recommends a single needs-review list rather than a roster dashboard, but **the visual vocabulary below is the same either way**, so it holds regardless. One addition from the research: every flag carries **the evidence that produced it**, inline, rather than requiring a click to find out why it fired. A flag whose reason is hidden becomes something to dismiss rather than something to read. Pain reports use `--accent-error`; unusually high RPE or a new comment use `--accent-research` (violet, already the site's convention for "worth a second look" per its use in `Diagram`/research callouts); a normal completion needing no attention gets no color at all. This deliberately avoids a traffic-light red/yellow/green scheme for medical-adjacent signals specifically — `CLAUDE.md` §3 already establishes "no red/yellow/green good/bad coloring" as a site-wide diagram convention, and a pain flag is exactly the kind of signal where implying a "bad/good" medical verdict via color would overstate what the product actually knows (the blueprint's own "avoid diagnosis" rule, `06` of the blueprint).

### 2.5 Material-change notices

A revision's reason renders as a single line directly below the changed field, in the same restrained callout style the site already uses for editorial asides (`ContentCallout`'s `research` variant styling — a thin left rule, no background tint) — not a modal, not a toast that disappears before it's read.

## 3. Layout

### 3.1 Desktop calendar

Kept as a true grid — the existing 7-column week view is not itself wrong at desktop width (`03-ux-audit.md` confirmed no overflow at 1440px). What changes is documented in `05`/`04`: the data underneath it, not its desktop shape.

### 3.2 Mobile calendar — genuinely different, not shrunk

Per `04-target-product-experience.md` §5: mobile gets a day-by-day agenda, not a horizontally-scrolled grid. Visually, this reuses the existing `WorkoutCard` component stacked vertically with a sticky day-strip header for navigation between days — the same interaction shape the site's own mobile nav already uses successfully (`site-header.tsx`'s documented `fixed inset-0` mobile panel pattern, `CLAUDE.md` §9), applied to a new surface rather than reinvented.

**The research settles this more firmly than the original recommendation did, and adds specifics** (sources in `02` §6):

- **No surveyed product ships a 7-column time grid at phone width.** Outlook and Google both cap a phone-width grid at **three** columns. Apple Calendar and Fantastical make the 7-day grid **landscape-only**, reachable by rotating the device. At 390px, seven columns is roughly 56px each, which is below what any of these vendors is willing to ship. The current `min-w-[1100px]` grid (D12) is not a near-miss to be tuned; it is a shape nobody uses.
- **The two products nearest this domain both chose a month grid on mobile.** Garmin Connect's phone Calendar is a month grid of per-day density glyphs with tap-to-day drill-down, and TrainingPeaks' mobile home is likewise a monthly calendar. That is two-for-two among endurance-training products, and it is a stronger signal for this audit than the general-purpose calendar apps.
- **Garmin's overflow count is the detail worth stealing.** When a day has more items than fit, the cell shows *how many are hidden* rather than clipping silently. That is the precise inverse of the current defect, where five of seven days vanish with no indication they exist.
- **Preferred shape, if the build budget allows it:** a horizontal date strip synchronized with a vertical workout list, as in Fantastical's DayTicker — scrolling the list moves the strip and vice versa, so the whole week stays visible in about 60px of vertical space while the list below carries full workout detail. This fits a coaching week better than a month grid because the week *is* the coach's unit, and it preserves forward context, which the research flags as the thing users miss most when a calendar traps them in a single isolated day.
- **Never render a wall-clock 24-hour axis**, whatever the layout. General-purpose calendars do this because meetings are time-boxed; running workouts are not. A 6am run and a 6pm run are the same entry in a coach's mental model ("Tuesday: threshold"), and a time axis would spend most of the vertical space on empty hours. Days hold an **ordered list**, not a timeline. This is the one place where copying Google or Apple literally would make this product worse.
- **Landscape phone is a legitimate home for the existing grid.** Rather than deleting it, offer it where Apple and Fantastical put it. Do not force it.

**One finding worth flagging to Brody rather than burying:** the research found no public evidence of a *coach-facing* mobile week-editing surface in any competitor. Coach authoring is consistently desktop-first across this market. If editing a plan from a phone is a real requirement here — and for a single coach running this alongside other work, it plausibly is — that is a place to expect to invent rather than copy, and to budget accordingly.

### 3.2a Where an edit happens: inline, side panel, modal, full screen

The current product has essentially one answer (an inline panel replacing the button that opened it) applied regardless of the edit's size, which `01` §7.3 identified as an inconsistency rather than a decision. The design-system rule, drawn from IBM Carbon's stated decision criteria:

- **Inline** — a single low-risk field where the surrounding context matters (rename a workout, change a distance). No dismissal, therefore no unsaved-changes question at all. Prefer this wherever it genuinely fits, because it makes §3.4 moot.
- **Side panel (desktop default for the workout editor)** — multi-field editing where the rest of the week is context the coach wants visible *while* editing. Carbon's test is decisive here and it is not a close call: *if enough fields are editable to require scrolling, use a side panel or full-page dialog rather than a modal.* The current editor has more than eight fields, so it scrolls, so it should not be a modal.
- **Modal** — reserved for small, bounded, genuinely blocking decisions: confirmations and destructive actions. Carbon's own framing is that modals are "highly disruptive and block tasks until dismissed," which is a reason to spend them carefully rather than a reason to avoid them entirely.
- **Full screen** — the phone equivalent of a side panel, and the target for the workout editor at mobile width (§3.3).

### 3.3 Modals

**One rule, applied consistently, closing the confirmed mobile defect:** any modal/panel that opens on a viewport narrower than the site's `xs` breakpoint (480px, already defined as `--breakpoint-xs` per `CLAUDE.md` §2) is a true `fixed inset-0` full-viewport panel with its own scroll region, matching the site header's own existing, working mobile-menu implementation exactly — not a partial-height floating card. `03-ux-audit.md` §1.2 found the current "Create workout" panel violates this on a 390px viewport (background content visibly bleeding through); the fix is to follow the pattern that already exists elsewhere in this same codebase, not to design a new one.

**The research names the observed defect precisely, which is worth recording because it makes the fix non-negotiable rather than a preference.** Material's bottom-sheet guidance states the rule as an explicit don't: *don't use an invisible scrim for modal bottom sheets, because it misleads users about their ability to interact with the rest of the screen.* The screenshot in `03` §1.2 is that anti-pattern, not a styling near-miss. A partial-height sheet is permissible, but only with all three of: an opaque sheet surface, a visible scrim (Material specifies 40% black), and a drag-to-full-screen gesture with internal scrolling. Given Carbon's scroll test in §3.2a, the workout editor should skip the partial sheet entirely and open full screen.

**One conflict between sources, resolved deliberately:** Material's default is tap-scrim-to-dismiss. That default must be **overridden whenever the form is dirty**, per §3.4 below. Where Material and the unsaved-changes guidance disagree, the unsaved-changes rule wins, because the cost of the two errors is not symmetric.

### 3.4 Unsaved changes — the rule, stated once and applied everywhere

This closes D6, and the research is unusually prescriptive about it, so the rule is stated concretely rather than as a principle:

- **A backdrop click on a dirty form is a no-op** (or opens the confirmation). It never commits. Both NN/g and AWS Cloudscape treat commit-on-ambiguous-dismiss as a data-integrity bug, not a UX preference. The current behavior is the more serious version of that: it commits *and* offers no way to undo.
- **A backdrop click on a pristine form closes freely.** Cloudscape is equally explicit that a confirmation with no data at risk is noise, and NN/g's warning applies directly: confirmations used routinely train people to dismiss without reading, which destroys their value for the cases that matter.
- **Expanding a progressive-disclosure section is never a dirty state.** Opening the structured-steps or advanced-targets section must not arm the prompt. Cloudscape calls this out by name.
- **Escape behaves exactly as Cancel.** Buttons read "Cancel" (stay) and "Discard changes" (leave), not a bare "Close," whose meaning NN/g shows users genuinely do not agree on.
- **`beforeunload` covers tab close and reload.** Its text cannot be customized; that is fine, since it is a backstop rather than the primary affordance.

**Why explicit save rather than autosave, stated as a decision:** autosave is legitimate, but it is a bargain — Notion earns silent autosave by making every version retrievable and attributed. This product currently takes the autosave side of that bargain without paying the other half, which is exactly why the behavior reads as untrustworthy rather than convenient. Explicit save is also the smaller change and the one the dominant guidance prescribes for form-shaped edits of this size. If autosave is ever wanted back, it is gated on revision history (`05` §1.2) existing *and* a visible undo, not on a preference.

## 4. Components — inventory of what's reused vs. new

| Component | Status |
|---|---|
| `Container`, `Card`, `CardLink`, `Badge`, `Heading`, `BackLink`, `TextLink` | Reused as-is |
| `fieldClass`/`labelClass` (`src/lib/form-styles.ts`) | Reused as-is — already the canonical form-field definition site-wide |
| `ContentCallout` (research/tip/mistake/takeaway variants) | Reused for material-change notices (§2.5) |
| A shared `IntensityTargetSummary` renderer | **New** — the single presentation-layer function matching `05` §1.1's single serialize/deserialize pair; every surface that shows a workout's target uses this one component instead of each screen formatting the six modes independently (closing the same duplication problem `01` §7.4 found in the data layer) |
| A shared `WorkoutCard` (day agenda + week grid + month cell) | **Consolidate** — `01` found the current codebase already has a `WorkoutCard`; extend it to serve the new mobile agenda layout (§3.2) rather than building a parallel component |
| A revision-diff view | **New** |
| A compliance/exception indicator (roster or queue) | **New**, pending the `04` §2.5 decision |

## 5. Accessibility

No new requirements beyond the site's own existing, documented standards (`CLAUDE.md` §11), applied to the new surfaces: real heading hierarchy on the week/day/history views, `fieldClass`'s existing focus-ring treatment on every new form field, `[color-scheme:light_dark]` on any new native input (the same real bug that convention already fixed once, per `CLAUDE.md` §11, should not be reintroduced by a new date/number input in the composer). Touch targets: the mobile agenda's day-strip navigation and the revision "what changed" affordance both need the same `min-h-12`-class treatment already established elsewhere in the athlete-facing plan UI (`03-ux-audit.md`'s method-limitations note flags that a dedicated accessibility pass, including touch-target audit, was not performed live in this engagement — this is a specification for implementation to satisfy, not a claim that it was verified).

**Three specific conformance floors, added from the research, each of which the target design would otherwise miss:**

- **Every drag-to-reschedule needs a non-drag equivalent.** WCAG 2.2 SC 2.5.7 (AA) requires that functionality using a dragging movement also be achievable with a single pointer without dragging, unless dragging is essential. The W3C's own worked example is the one this product needs: for task boards, a **pop-up menu for moving items between columns**. A calendar day is a task-board column, so a "Move to…" menu on each workout satisfies this. `04` §2.3 lists drag-between-dates as a first-class action, which makes this a requirement rather than a nicety.
- **Touch targets: 24×24px is the legal floor** (SC 2.5.8, AA), with exceptions for sufficient spacing or an equivalent control elsewhere. 44px (Apple) and 48dp (Material) remain the practical targets. Note that `CLAUDE.md` §9 records a tap-target bug on this site already fixed from 22px to 36px — that clears the floor but not the practical guidance, and a sweep is worth doing on the new surfaces rather than matching the existing 36px by default.
- **Dialog and side-panel focus management**, per the W3C ARIA Authoring Practices: move focus into the dialog on open, normally to the first focusable element, but to a static element carrying `tabindex="-1"` (the title) when the content is long enough that focusing a field would scroll the heading out of view — which is exactly the case for the multi-field workout editor. Tab and Shift+Tab must not leave the dialog and must wrap. Store the invoking control and return focus to it on close.

## 6. What this document deliberately does not specify

Pixel-level mockups, a component library implementation, or a full responsive breakpoint table for every screen — those are implementation artifacts, not audit deliverables. This document specifies the *rules* (which tokens, which states, which existing patterns to extend vs. which surfaces are genuinely new) an implementer needs to build consistently; it does not replace that implementation work.
