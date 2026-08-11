# What's already on the site from Lydiard/Livingstone (for novel-vs-overlapping tagging)

This site (`src/lib/sections.ts`) already draws heavily on two books that are
NOT in `resources/Lydiard/` (they live in `resources/books/`): Arthur
Lydiard's own *Running to the Top* (cited `(Lydiard, Running to the Top)`,
9x explicit + many uncited paraphrases) and Keith Livingstone's *Healthy
Intelligent Training* (cited 19x, explicitly named as "a second major
source"). When digesting a `resources/Lydiard/` file, tag each extracted
point **novel** (not covered below) or **overlapping** (reinforces/nuances
one of these) so the synthesis pass can prioritize real gaps.

## Already covered

- Steady State / oxygen-debt physiology, including the corrected ceiling
  (Lydiard's original 15-18 liter estimate vs. Peter Snell's later ~4 liter
  revision).
- Fast-twitch/slow-twitch fiber types and the acid/alkali balance logic
  behind buffering hard sessions with low-intensity recovery volume.
- The three hill-exercise types (steep hill running, hill bounding, hill
  springing) and downhill/eccentric running technique.
- Warm-up protocol (5-minute rule: raise pulse/circulation, reduce muscle
  viscosity).
- Marathon fueling: honey over carb-loading, salt-tablet skepticism tied to
  a potassium-depletion mechanism, contrasted against modern 8-12 g/kg/day
  carb guidance (Thomas et al. 2016).
- Marathon racing frequency (no more than one hard-raced marathon every
  couple months).
- Capillary-density study (Swedish vs. Kenyan quadriceps comparison).
- Historical jogging-movement material: Murray Halberg's 1960 Olympic
  5000m win despite a paralyzed arm; the 1961 Auckland jogging club;
  Bowerman's 1962 visit and founding of American jogging; East Germany's
  1965 "Run for Your Life" program.
- Beginner "pleasantly tired" philosophy; the Lydiard Foundation's
  walk/jog beginner progression.
- Coaching philosophy: a coach's time as their most valuable resource,
  team-talk timing (tactics discussed two nights before, not two minutes
  before).
- Strength-training frequency data (every-2nd-day vs. weekly vs. 14-days
  gains) and isometric-hold progression.
- Post-hard-effort easy-jog recovery (clears soreness-causing waste faster
  than full rest).
- Muscle fiber types / the "size principle" of recruitment.
- Taper structure; interval-pace-vs-fitness matching; fartlek-by-time.
- Heavy low-rep lifting protocol and rep-scheme physiology.
- Stride-length/economy math.
- Team-coaching habits (Barry Magee, Gary MacDonald) and racing tactics
  (leading early, never looking back).
- Overtraining symptom clusters and case histories.
- One Lorraine Moller anecdote (from her book *On the Wings of Mercury*,
  not the *Running Times* article) about marathon-career longevity.

## Confirmed NOT yet covered (zero hits in sections.ts)

- Anything from *Running Times* magazine.
- Anything credited to "HITSYSTEM" specifically (a modern interpretation
  layer some `resources/Lydiard/` decks are built around -- distinct from
  quoting Livingstone's book directly).
- Anything from George Sheehan's *Jogging Basics*.
- Any Vienna 2017 clinic material.
- Any dedicated Lydiard history/biography material.

## Citation convention to follow

`(Lydiard, Running to the Top)` is the established pattern for Lydiard's
own words. For new material, cite the document's **actual author**, not a
blanket "Lydiard" -- most of this folder is other people's clinics or
writing about his method: e.g. `(Moller, Running Times)`,
`(Sheehan, Jogging Basics)`, or `(PresenterName, ClinicName)` once you've
identified who that presenter actually is from the document's own byline
or credits.
