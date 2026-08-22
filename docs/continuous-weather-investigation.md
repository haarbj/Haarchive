# Continuous Weather Modeling — Investigation Report

**Status:** Investigation only. No code changed, no dependencies added, no API keys added, nothing committed. Written for review before any implementation begins.

**Scope note:** Standalone project, unrelated to the learning-system phase numbering elsewhere in this repo's history.

**Update (2026-08-21):** The Tomorrow.io free-tier spike proposed in §15/Final Recommendation below has been run. Verdict: **DOES NOT QUALIFY** — see "Tomorrow.io Free-Tier Verification (Spike Results)" at the end of this document for the full evidence. The original sections below are preserved unchanged as the record of the initial investigation; only the new section at the end reflects the spike's findings.

---

## 1. Current architecture

Traced end-to-end, verified against the actual repository (not assumed from prior reports):

1. **Weather fetched today:** Open-Meteo, via three functions in `src/lib/environmental/fetch-weather-conditions.ts`:
   - `fetchCurrentConditions` — one "current" snapshot.
   - `fetchConditionsAtTime` — the single hourly reading closest to a requested instant.
   - `fetchConditionsWindow` (added in the immediately preceding session) — every hourly reading an imported route's real `[start, start+duration]` window touches, averaged by `summarizeWeatherWindow` into one representative value.
2. **Temporal resolution:** Hourly. Every one of the three functions above ultimately reads from Open-Meteo's `hourly=` parameter set (`temperature_2m, relative_humidity_2m, dew_point_2m, cloud_cover, surface_pressure, wind_speed_10m, wind_direction_10m, wind_gusts_10m`) — there is no sub-hourly field requested or available in what's currently wired up.
3. **Where hourly becomes a scalar:** `summarizeWeatherWindow` (unweighted mean across every hourly point the run's window touches) → `fetchedConditions: WeatherConditions | null` → `resolveAutoConditions`/`resolveManualConditions` → `ResolvedConditions.tempC/relativeHumidityPct/windSpeedMS` → `computeResults` in `environmental-calculator.tsx`.
4. **Temperature consumers:** `heatEngine` (`heat-engine.ts`), via `heat-humidity-model.ts`'s Mantzios et al. (2022) fitted grid, calibrated to whole-marathon-length efforts and duration-scaled for other distances (`heat-model.ts`'s `durationScaleFor`).
5. **Humidity consumers:** `humidityEngine` — the same Mantzios grid, isolating humidity's marginal effect by comparing the surface at actual humidity against a dry-air reference.
6. **Wind speed consumers:** exactly one of `windEngine` / `trackWindEngine` / `routeWindEngine`, selected by `courseType`. All three take a single `windSpeedMS` scalar.
7. **Wind direction:** road mode assumes one fixed heading for the whole effort; track mode integrates continuously as heading rotates through the curves; **route mode already integrates point-by-point against the file's own real heading changes** (`route-wind-engine.ts` consuming `RouteHeadingSegment[]` built by `route-summary.ts`).
8. **Is wind already route-segment-specific?** Direction: yes, for an imported route. Speed: no — one representative scalar (now itself a real average across the weather window, not a single snapshot, but not varied by route segment).
9. **Route timestamps:** `RoutePoint.elapsedSeconds` (seconds since the first timestamped point) — populated for every source (`parse-gpx.ts`, `parse-tcx.ts`, `parse-fit.ts`, `parse-strava.ts`).
10. **Do individual GPS points have timestamps?** Yes — every `RoutePoint` carries `elapsedSeconds`, confirmed by direct inspection of `src/lib/route-import/types.ts` and all four parsers.
11. **Can route duration be mapped to route distance?** Yes, in principle — every `RoutePoint` carries both a position (`lat`/`lon`, from which distance is computed via `haversineDistanceM`) and `elapsedSeconds`. **But `course-analysis.ts`'s internal analysis grid currently drops the time dimension**: `RawSample`/`GridPoint` in `course-analysis.ts` are typed `{ distanceM, elevationM }` only — `elapsedSeconds` is never carried into the smoothed, distance-indexed grid that `perMileGrade`, `perMileTerrainCostJPerKg`, and the newly-added `perMileAltitudeM` are all built from. This is the concrete architectural gap: the raw data to build a time↔distance mapping already exists in `route.points`, it just isn't preserved past the point where `course-analysis.ts` resamples it.
12. **Is elevation already modeled continuously?** Yes, as of the immediately preceding session: `perMileAltitudeM` (absolute altitude) and `perMileTerrainCostJPerKg` (grade-based mechanical cost) are both real per-mile values from the route's own GPS samples, consumed by `precise-altitude-engine.ts` and `precise-elevation-engine.ts` respectively.
13. **Enough information for time/route interpolation without changing the import format?** Yes for the *route* side (per-point time+position already parsed, per point 11 above). For the *weather* side, no new import format would be needed either — the constraint is entirely the weather **provider's** own real data resolution (see §2), not anything about how routes are parsed.

**Other locations checked, for completeness:**
- `saved-analysis.ts`: stores a single `conditions.tempC/relativeHumidityPct/windSpeedMS/altitudeM` snapshot per saved result — would need a schema decision if per-segment weather were ever persisted (not addressed by this investigation; flagged in §14).
- Tests: `tests/lib/environmental/fetch-weather-conditions.test.ts`, `precise-altitude-engine.test.ts`, `tests/lib/marathon-pacing/course-analysis.test.ts`, `tests/lib/weather-wind.test.ts` all currently assume/test hourly-resolution, single-day-window fetching. None currently exercise a route-segment-by-route-segment weather join (because none exists yet).

---

## 2. Weather-provider research

Researched against each provider's own current official documentation (not memory, not aggregator blog posts, though a couple of independent write-ups were used to cross-check specific numeric claims).

### Visual Crossing

- **Sub-hourly historical resolution:** Real. "The smallest available time interval is 5-10 minutes, depending on station data availability," sourced from "both official and additional stations," with interpolation used only to smooth *between* real station readings when a finer interval than the station actually reports is requested.
- **Critical finding:** Sub-hourly/minute-level data is **gated to Corporate or Enterprise plans**. It is explicitly **not included in the free tier** (1,000 records/day, hourly/daily granularity only). This alone disqualifies it from "free."
- **Free tier (non-sub-hourly):** 1,000 records/day, commercial use permitted, API key required. Billing is **per record** (one row/timestep = one record), not per request — a single request returning many rows can consume many records.
- **If sub-hourly were ever available on a paid plan:** a 90-minute run at 15-minute resolution = 6 rows = 6 records. Cheap in isolation, but moot while gated to Enterprise.
- **Provenance:** Station observations where available, interpolated to fill the requested interval — a real, disclosed blend, not silently invented.

### Open-Meteo (current provider)

- **Historical Weather API (ERA5/ERA5-Land/ECMWF-IFS reanalysis):** **Hourly only, confirmed explicitly** ("1 Hourly Temporal Resolution For Hourly Data"). No sub-hourly historical resolution exists in this dataset at all — this isn't an API limitation, it's that **no reanalysis dataset with 15-minutely data exists** (confirmed via Open-Meteo's own GitHub discussion #1311). Global coverage, back to 1940 (ERA5) / 1950 (ERA5-Land) / 2017 (ECMWF IFS).
- **Historical Forecast API:** Does expose a `minutely_15` parameter, but **only for Central Europe and North America**, and even there it is **interpolated from hourly model output**, not a genuinely finer-resolution model or observation. Everywhere else, requesting `minutely_15` silently falls back to hourly-interpolated values too. Per the user's own stated bar ("do not count an API as satisfying this requirement merely because... it interpolates hourly values"), **this does not qualify as genuine sub-hourly data**, full stop — Open-Meteo's own documentation and community answers confirm it's interpolation, not real finer-grained measurement or modeling.
- **Free tier:** Non-commercial only, 600 calls/min, 5,000/hour, 10,000/day, no API key required for the free path. **Attribution required** (CC BY 4.0).
- **A real, separate finding, not previously flagged:** Open-Meteo's own terms describe the free tier as "for non-commercial use," with paid plans described as carrying a "commercial use licence." Haarchive is presently calling the free endpoints with no key. Whether a coaching platform with authenticated features and (potentially, eventually) paid tiers counts as "commercial" under Open-Meteo's own definition is genuinely ambiguous from their public docs alone — this is a real compliance question worth a direct email to Open-Meteo to resolve, independent of anything else in this report. Not urgent, but real.
- **Self-hosting:** Open-Meteo's stack is open-source and self-hostable. This would **not** unlock sub-hourly historical resolution — the limitation is the underlying reanalysis data itself (no dataset exists at that resolution), not the hosting. Self-hosting would only help with rate limits or attribution-avoidance, neither of which is the actual problem here.

### Tomorrow.io

- **Claimed resolution:** "Up to 1 minute time resolution" for point/polygon/polyline queries.
- **Critical finding:** This resolution applies to the **Timeline API's rolling window of "7 days in the past to 14 days in the future"** only. A *separate* Historical Weather API covers "January 1st 2000 until 7 days ago" — i.e., for anything older than about a week, you're back to whatever coarser resolution that older-data endpoint actually provides (their docs don't establish it's minute-level that far back, and independent sources suggest it isn't).
- **Practical implication:** genuinely fine resolution is only available for imports of runs completed within roughly the last week. Most of what a runner would plausibly import (a race from last month, a memorable long run from last year) would not get this benefit at all.
- **Free tier:** Exists, covers "core parameters" (temperature, wind, humidity), but the exact gating of the *Historical* endpoint specifically (as opposed to current/forecast) was not confirmed with certainty from public docs alone — this would need a live test with a real free API key before being trusted for a recommendation.
- **Provenance:** Not established from documentation alone whether the "1 minute" values are real station observations, radar-derived nowcasting, or short-range model output blended down to a minute grid — Tomorrow.io markets a proprietary blended "hyperlocal" model, which suggests model output, not raw observation, but this needs direct confirmation before any UI copy could honestly describe it either way.

### WeatherAPI.com

- **History API:** offers hourly by default; **15-minute interval history is listed as an Enterprise-only feature** (`tp=15` parameter gated). Not available on the free plan.
- **Free tier:** 1M calls/month, history back to Jan 1, 2010, requires a visible "link back" attribution on the free plan. Commercial-use terms for the free plan specifically weren't confirmed from the fetched docs.
- **Same pattern as Visual Crossing and WeatherAPI's own Enterprise gating:** real sub-hourly historical data exists in the ecosystem, but it is consistently a paid feature.

### Meteostat

- **Resolution:** Hourly and daily only — no sub-hourly endpoint exists in their public API or documentation.
- **Provenance (genuinely good):** Real station observations for over 40,000 stations worldwide, with statistically-modeled gap-filling only where a station has missing hours — the most transparent provenance disclosure of any provider checked.
- **Free, open, no signup required.** Disqualified purely on resolution, not on cost or licensing.

### Pirate Weather

- **Free, open-source (AGPL), generous free tier** (~20,000 calls/month).
- **Historical ("time machine") data is severely limited in lookback — only about 1-2 months back** for the full time-machine endpoint. Underlying historical source is **ERA5 reanalysis** — the same hourly-only dataset Open-Meteo's Historical Weather API already uses. No resolution advantage over what's already in use, plus a much shorter historical window than Haarchive needs (someone could plausibly import a run from over a year ago).

### NOAA / NWS — ASOS 1-minute observations (via IEM / MADIS)

- **The one genuinely free, genuinely sub-hourly (actually sub-*minute*), genuinely observational (not modeled/interpolated) data source found in this entire investigation.** "One Minute ASOS" (OMO) data is real station output, publicly archived by the Iowa Environmental Mesonet (IEM) back to 2000 and available with no API key, no cost, and no usage restriction beyond a modest per-IP throttle.
- **Why this isn't a simple drop-in replacement:**
  - **US-only** — ASOS is the U.S. aviation-weather station network. No coverage for any international location.
  - **Station-based, not coordinate-based** — the API takes a station identifier, not a lat/lon; using this would require a separate "nearest ASOS station to this route's centroid" lookup/matching step that doesn't exist anywhere in this codebase today, and station density varies (dense near airports, sparse in rural/mountain areas — exactly where altitude-heavy trail routes are more likely to matter).
  - **Raw, CSV/text-oriented interface**, not a clean JSON API tuned for this kind of server-side request — meaningfully more integration work than any of the JSON-first commercial APIs above.
  - Field coverage (gusts specifically) would need per-station verification rather than being guaranteed uniformly.

---

## 3. Provider comparison

| Provider | Historical | Genuine sub-hourly? | Temp/Humidity/Wind/Gusts | Free? | API Key | Commercial Use | Attribution | Main Limitation |
|---|---|---|---|---|---|---|---|---|
| **Open-Meteo** (current) | Yes, 1940→ (ERA5) | **No** — hourly only; `minutely_15` is interpolated hourly, regions-limited | All four | Yes (non-commercial) | No | Ambiguous — free tier says "non-commercial" | Yes (CC BY 4.0) | No real sub-hourly data exists in the dataset itself |
| Visual Crossing | Yes | **Yes, but Enterprise-only** | All four | No (sub-hourly gated) | Yes | Yes (paid tiers) | Not confirmed | Real sub-hourly resolution isn't reachable on any free/cheap tier |
| WeatherAPI.com | Yes, 2010→ | **Yes, but Enterprise-only** | Temp/Humidity/Wind confirmed; gust unconfirmed | Yes (hourly only) | Yes | Unconfirmed on free tier | Yes (link-back) | Same Enterprise gating pattern as Visual Crossing |
| Tomorrow.io | Only last ~7 days at fine resolution; 2000→ at unknown coarser resolution | **Partially** — real minute data only within ~7 days | All four claimed | Yes (unclear gating for History endpoint) | Yes | Unconfirmed | Unconfirmed | Fine resolution only for very recent imports; provenance (model vs. observation) unconfirmed |
| Meteostat | Yes, station-dependent | No — hourly only | Temp/Humidity/Wind; gust inconsistent by station | Yes | No | Yes | Yes (attribution requested) | No sub-hourly at all |
| Pirate Weather | Only ~1-2 months back | No — ERA5-backed, hourly | All four | Yes | Yes | Yes (open license) | Yes (AGPL) | Historical window far too short for Haarchive's use (imports could be much older) |
| NOAA ASOS (IEM/MADIS) | Yes, 2000→ | **Yes, genuinely, real observations** | Temp/Wind/Gust reliable; humidity derivable from dewpoint | Yes, fully free | No | Yes (public data) | Not required (public domain) | US-only; station-based; real integration engineering required |

**Bottom line of the comparison:** every provider with **genuine** (non-interpolated) sub-hourly historical resolution either gates it behind a paid/Enterprise plan, severely limits the historical lookback window, or is US-only and requires meaningfully more integration work than anything currently in this codebase. There is no provider that is simultaneously free, genuinely sub-hourly, globally covered, and covers arbitrary historical dates.

---

## 4. What "continuous" should mean here

Recommend **Option A modestly extended, not Option D.** Reasoning:

- The realistic data ceiling for a free, global, arbitrary-history weather source is **hourly** (§2, §3). No amount of clever interpolation manufactures information that was never measured or modeled at finer resolution — interpolating between two real hourly readings (Option B, linear interpolation) would produce a smoother-*looking* curve, not a more *accurate* one, and risks implying false precision the user's own instructions explicitly warn against (§6 of the prompt).
- The physiological models these numbers feed — Mantzios et al.'s heat/humidity grid, Daniels' altitude tables — are themselves **calibrated to whole-effort durations**, not to sub-segment time steps. Re-deriving a genuinely time-weighted continuous integration (Option D) of a model that was never fit at that resolution would not add real fidelity; it would just add computational complexity around numbers that don't carry that much precision to begin with.
- What was already built in the immediately preceding session — **stepwise selection of every real hourly observation a run's actual window touches, then a plain average as the representative value fed to the unchanged engines** — is genuinely closer to "Option A" (stepwise) than a single snapshot, is honest about its own resolution ceiling, and doesn't invent data between real readings.

**Recommendation: do not add interpolation (Option B) or full time-weighted integration (Option D) on top of the current hourly-window-averaging.** The already-shipped approach is the mathematically appropriate one *given the real resolution of any realistically available free data source*. If genuine sub-hourly data becomes available for a bounded subset of cases (see §15's conditional Option B on providers), stepwise selection (Option A) — not interpolation — remains the right approach even then, for the same "don't imply precision the data doesn't have" reason.

---

## 5. Weather time vs. route space

Investigated whether querying weather per-GPS-point (or per-mile) would add meaningful accuracy.

- Weather model/reanalysis grid cells (ERA5: ~25km; ERA5-Land: ~9km) are **larger than the geographic footprint of the overwhelming majority of single running routes**, including most marathons run within one metro area. Querying weather separately for mile 1 vs. mile 20 of a typical single-city marathon would very often return **identical or near-identical values**, because both points fall in the same (or an adjacent, interpolated-the-same-way) grid cell.
- The real exception is a genuinely **long, point-to-point course** (e.g., point-to-point marathons that cross meaningfully different terrain/weather zones) or an unusually long ultra — here, start vs. end coordinates could plausibly sit in different grid cells.
- **Recommendation:** keep using the route's centroid for a single weather query in the common case (current behavior, unchanged) rather than querying every point or every mile — the added request volume would not be repaid with real spatial accuracy given the underlying model's own resolution ceiling. For a course whose start-to-end straight-line distance exceeds a threshold (a reasonable candidate: ~20km, comfortably inside even ERA5-Land's ~9km cells so it's a real, not arbitrary, threshold), a **two-point query (start + end coordinates, not the centroid)** would be the smallest addition that could plausibly matter, and even then only worth building if a real user reports a case where it would have mattered — this is a "worth naming, not worth building yet" finding.

---

## 6. Observations vs. model data — provenance summary

| Provider | Sub-hourly data is... |
|---|---|
| Open-Meteo Historical Weather (ERA5) | Reanalysis: real observations blended into a physics model, hourly only |
| Open-Meteo Historical Forecast `minutely_15` | **Interpolated** from hourly model output (explicitly, per Open-Meteo's own maintainers) |
| Visual Crossing | Real station observations, interpolated only to fill gaps between real readings, at Enterprise tier |
| Tomorrow.io | Unconfirmed — likely a blended proprietary "hyperlocal" model, not raw observation |
| NOAA ASOS (IEM/MADIS) | Real station observations, genuinely measured at that cadence |

**Copy implication (not implemented, per instructions — recorded for §13/future work):** the current, already-shipped UI language — *"X real hourly readings across your run's own start-to-finish window"* — is accurate and should **not** be changed to claim minute-level precision unless a provider that's genuinely observational at that resolution (i.e., NOAA ASOS, or a verified-observational commercial tier) is actually integrated. If Open-Meteo's interpolated `minutely_15` were ever wired in without this distinction, the honest copy would need to say something like *"estimated at finer intervals by interpolating hourly data"* — explicitly not "measured."

---

## 7. API cost / usage estimates

**Important distinction, per the prompt's own instruction:** Open-Meteo (current provider) rate-limits by **request/call count**, not by row/record count returned — one call already returns the whole day's hourly array regardless of how many rows are used. Visual Crossing, by contrast, bills by **record** (row) count, independent of request count. These are not interchangeable, and conflating them would misstate usage.

Current behavior: importing a route triggers **one** `fetchConditionsWindow` call (one HTTP request to Open-Meteo, returning the day's full hourly array; the window-selection and averaging happen client-side afterward, at zero additional request cost). Manual/road-course auto-weather mode can trigger additional calls if the user changes location or date/time after the initial fetch — estimated realistically at 1-3 requests per calculator "use," not a fixed 1:1.

| Scenario | Uses/day | Est. requests/day (1-3x/use) | vs. Open-Meteo free limit (10,000/day) |
|---|---|---|---|
| A | 100 | 100–300 | Trivial |
| B | 500 | 500–1,500 | Comfortable |
| C | 1,000 | 1,000–3,000 | Comfortable |
| D | 5,000 | 5,000–15,000 | **Could exceed the free daily limit at the high end** |

If Visual Crossing's sub-hourly tier were ever reachable (it isn't today — Enterprise-gated): a 90-minute run at even a generous 5-minute interval = 18 records; at Scenario B (500 uses/day) that's 9,000 records/day, already past the 1,000/day free allocation and into metered billing (their calculator, not fetched in detail here, would be needed for an exact dollar figure) — illustrating why "records," not "requests," is the number that matters for that specific provider's pricing model, exactly as the prompt warned against conflating.

**Takeaway:** current Open-Meteo usage is comfortably free through Scenario C, and only worth monitoring (not urgently fixing) at Scenario D. This is a real, separate finding independent of the sub-hourly question — worth noting for whenever traffic actually approaches that range.

---

## 8. Security / architecture (as it exists today, and what would change)

- **Current:** `fetch-weather-conditions.ts` functions are called from client components (`use-environmental-weather.ts` is `"use client"`), making the Open-Meteo request directly from the browser. This is only safe because **Open-Meteo's free tier requires no API key** — there is nothing secret to leak. This would **not** be safe to do unmodified with any of the paid/keyed providers researched above (Visual Crossing, WeatherAPI.com, Tomorrow.io all require a key).
- **If any keyed provider were ever added:** the key must live server-side only (a Vercel environment variable, read only inside a Server Action or Route Handler — matching this codebase's own existing `src/lib/strava/route-actions.ts`/`"use server"` pattern), with the client calling a Haarchive server action that then calls the third-party API, never the reverse.
- **Caching:** a run is immutable once imported — historical weather for a fixed (lat, lon, date/time) tuple will never change after the fact. This makes historical weather **genuinely, permanently cacheable**, unlike a live forecast. No caching exists today. A reasonable strategy if a keyed/metered provider were ever added: cache by a rounded (lat, lon, hour) key (e.g., in `saved-analysis.ts`'s own storage, or a small dedicated table) so two users who happened to run the same race get one shared fetch instead of two, directly reducing metered cost. Not needed for Open-Meteo today (unmetered, request-based, comfortably under the free limit per §7).
- **Rate limiting / abuse protection:** not currently implemented for weather fetches specifically. Given Open-Meteo's free tier has no per-user cost, this is a low-priority concern today; would become a real one only if a metered provider were added.

---

## 9. Fallback strategy

**Recommendation: not worth building today**, specifically *because* there is currently only one provider in use and no evidence-backed plan to add a second in the near term (§15). A fallback hierarchy is real, justified complexity **only once there's a second real provider to fall back from/to**. If §15's conditional Tomorrow.io enhancement is ever built, the fallback should be simple and already fits this codebase's own established pattern: try the finer-resolution provider first, catch any failure, and fall through to the exact `fetchConditionsWindow`/Open-Meteo path that already exists today — never a broken result, and the UI should say plainly which resolution was actually used (already partially true: the existing "X real hourly readings" message already names its own resolution; extending that same pattern to name the finer source when it's used is a small, natural addition, not a new concept).

---

## 10. Preservation of existing correct modeling

Explicitly re-verified against the current code (not assumed):

- **Wind direction:** `route-wind-engine.ts` still integrates against real per-segment route headings for an imported route — untouched by anything in this investigation, and nothing proposed here would change it.
- **Elevation (per-mile, real GPS-derived):** `precise-altitude-engine.ts` and `precise-elevation-engine.ts` still consume `course-analysis.ts`'s real per-mile `perMileAltitudeM`/`perMileTerrainCostJPerKg` — untouched.
- **Manual altitude:** still a single representative value, explicitly labeled as such in the UI's own copy (`ManualWeatherFields`'s altitude field caption) — untouched, and correctly should stay that way regardless of any weather-provider change, since manual entry has no route/GPS data to build a profile from in the first place.
- **Elevation gain/loss vs. absolute altitude:** still two distinct, separately-modeled quantities (`elevationGainM`/`elevationLossM` vs. `altitudeM`/`perMileAltitudeM`) — untouched, and this investigation doesn't touch either.
- **Gusts:** confirmed still fetched and displayed only, never fed into any engine. This investigation explicitly does **not** propose changing that — a provider offering gust data (all of them do) is not itself a reason to start using it in the calculation; that would be a separate, deliberate model decision this report does not make.

---

## 11. Proposed target data model (for a future implementation, not built now)

The smallest addition that would let weather(t), route(t)/altitude(t), and the existing wind-heading integration compose without duplicating logic:

```ts
// Conceptual only -- not the literal interface to ship.
type WeatherSample = {
  timestamp: string;       // naive local wall-clock, matching the existing naiveMinutes convention
  tempC: number;
  relativeHumidityPct: number;
  windSpeedMS: number;
  windFromBearingDeg: number;
  windGustsMS: number;
  source: "open-meteo-hourly" | /* future: a finer-resolution source */;
  resolutionMinutes: number; // honesty field -- what the UI/copy should key off of, not just presence of multiple samples
};
```

Two real, minimal additions this implies to *existing* files, not a parallel new system:

1. **`course-analysis.ts`'s grid would need to also carry `elapsedSeconds`** alongside `distanceM`/`elevationM` (per §1, point 11) — the one genuine gap found. This is what would let a future weather(t) join against route(t)/altitude(t) by time, not just by distance. This is additive to the existing grid, not a rewrite.
2. **A join function**, e.g. `weatherAtElapsedSeconds(samples: WeatherSample[], elapsedSeconds: number): WeatherConditions`, doing exactly what `buildPerMileGrade`/`buildPerMileAltitude` already do for distance-indexed data, but keyed by time instead — same established pattern (`course-analysis.ts` already has three of these), not a new abstraction.

No new state-management system, no new unit-conversion system (existing `fetch-weather-conditions.ts` helpers cover it), no new testing framework needed — this slots into exactly the same shape the codebase already uses for `perMileGrade`/`perMileAltitudeM`.

---

## 12. Testing plan (for a future implementation)

Per the prompt's own worked examples, to be written when/if implementation is approved:

- **Interpolation:** *not applicable* per §4's recommendation (no interpolation is being proposed) — replaced by a **stepwise-selection** test: given real samples at 10:00=60°F and 10:10=70°F, a moment at 10:05 should resolve to the *nearest real sample* (60°F or 70°F, whichever is closer), never a fabricated 65°F.
- **Route timing:** a 60-minute run's route segments correctly map onto whichever real weather samples their own elapsed time falls within, using the new `elapsedSeconds`-carrying grid from §11.
- **Weather range display:** genuinely varying real samples → "60–70°F during run"; already covered by existing tests (`fetch-weather-conditions.test.ts`) for the hourly case, would extend the same pattern for a finer-resolution source.
- **Constant weather:** identical samples → "60°F", not "60–60°F" — already implemented and tested (`numericRange`'s existing "same displayed value" collapse, `route-summary`/`environmental-calculator` tests).
- **Altitude range:** already implemented and tested (`precise-altitude-engine.test.ts`'s Jensen's-inequality regression test, `course-analysis.test.ts`'s absolute-altitude-vs-gain distinction) — no change needed here regardless of weather-provider decisions.
- **Wind vs. heading:** already implemented and tested (`route-wind-engine.test.ts`) — explicitly out of scope for any weather-provider change.
- **Provider failure / fallback:** if a second provider were ever added (§15), a test that a forced failure of the finer-resolution provider still produces the existing, correct Open-Meteo-hourly result, not a broken page.
- **No timestamps (manual runs):** already implemented and tested — manual entry has no route/GPS data, so it necessarily keeps using a single representative value; no weather-provider change affects this path at all.

---

## 13. UI/copy locations that would need review (not changed now)

Every location identified, for reference when implementation is actually approved:

- The Conditions card's Temperature/Humidity/Wind Speed rows (`ConditionValueRow` usages in `environmental-calculator.tsx`) — would need their "N real hourly readings" note updated to name the actual resolution/source if it ever becomes something other than hourly.
- The route-import checklist ("Weather retrieved") — no change needed unless a second provider changes what "retrieved" means.
- "Behind the calculator" → Heat, Humidity, Wind sections — already describe the current hourly-window-averaging accurately (rewritten in the immediately preceding session); would need a factual update, not a rewrite, if resolution ever changes.
- "Behind the calculator" → Confidence/limitations section — already states "Open-Meteo's hourly data is the finest resolution available" — this exact sentence would need updating first, before anything else, if that stops being true.
- `saved-analysis.ts`'s conditions metadata — currently a single snapshot; would need a real schema decision (store the samples? store just the representative + a resolution flag?) if per-segment weather were ever persisted — not addressed here, flagged as a real open question for later.

---

## 14. Risks and limitations

- **No free provider satisfies "sub-hourly + historical + global + free" simultaneously.** This is the central, load-bearing finding of the whole investigation — every path forward trades away at least one of those four.
- **Open-Meteo's own "non-commercial" free-tier language is a real, separate compliance question** for Haarchive as a whole (not specific to this feature) — worth a direct email to Open-Meteo, independent of anything else in this report.
- **Tomorrow.io's actual free-tier History-endpoint access could not be fully confirmed from public docs alone** — any future work here would need a live test with a real key before being trusted, not just this document's research.
- **NOAA ASOS is the only genuinely free+observational+sub-hourly source, but is US-only and requires real new integration work** (station lookup, CSV parsing) disproportionate to likely benefit given Haarchive's presumed audience mix and the modest real-world weather variance most single runs actually experience.
- **The physiological engines themselves (Mantzios heat/humidity, Daniels altitude) are calibrated at whole-effort granularity** — even perfect minute-by-minute weather data would not, on its own, make those specific models more accurate without also re-deriving their own calibration at finer resolution, which is out of scope and not evidence-justified by anything in this investigation.

---

## 15. Implementation plan (only if this investigation is approved to proceed)

Phased, each independently small and verifiable — **not started**:

1. Add `elapsedSeconds` to `course-analysis.ts`'s internal grid (§11) — a pure, additive, well-scoped change with its own unit tests, useful regardless of any weather-provider decision (it's also just a more complete internal model).
2. **Spike (time-boxed, not a commitment):** obtain a real Tomorrow.io free-tier key and empirically verify whether its Historical endpoint is actually free-tier-accessible, and whether its "1 minute" data is genuinely observational or modeled, before writing any production code against it.
3. Only if step 2 confirms real, free, working access: build `fetchConditionsWindow`'s finer-resolution sibling for the last-7-days case specifically, with the exact fallback behavior described in §9, server-side key handling per §8, and the stepwise (not interpolated) join from §4/§11.
4. Update the specific UI copy locations in §13, factually, not aspirationally.
5. If step 2 does *not* confirm free/reliable access: stop here. The honest conclusion is that Open-Meteo's existing hourly-window-averaging (already shipped) is the right place to stay, and this document itself is the record of why.

---

# Final recommendation

## Option A — Stay with Open-Meteo — **recommended**

No researched provider offers genuine (non-interpolated) sub-hourly historical weather that is simultaneously free, globally covered, and available for arbitrary historical dates. Every provider with real sub-hourly historical data gates it behind a paid/Enterprise tier (Visual Crossing, WeatherAPI.com) or trades away either historical range (Tomorrow.io: ~7 days; Pirate Weather: ~1-2 months) or geographic coverage and ease of integration (NOAA ASOS: US-only, station-based, real new engineering). Open-Meteo, as already extended in the immediately preceding session (real hourly-window averaging instead of a single snapshot), is the most complete, honest, zero-marginal-cost model achievable without one of those four tradeoffs. Switching providers or adding a general-purpose second one would not close the resolution gap — it would just relocate the same hourly ceiling onto a provider with worse free-tier terms in every case checked.

**Option B (add a second provider) is conditionally worth a small, time-boxed spike** — specifically, verifying whether Tomorrow.io's free tier genuinely supports historical-minute queries for runs imported within about a week of completion — but this is explicitly *not* the same as recommending Option B outright today, since the free-tier access for that specific endpoint was not confirmed from documentation alone.

**Option C (replace Open-Meteo) is not recommended** — no provider is strictly better across resolution, cost, historical range, and coverage; replacing would be a lateral move at best.

**Option D (self-host) is not recommended** — the limitation is the underlying dataset's own real resolution, not the hosting; self-hosting Open-Meteo's own open-source stack would not produce sub-hourly historical data that doesn't exist in the reanalysis in the first place.

---

### "Can we realistically provide continuous/sub-hourly weather modeling for imported runs at zero marginal API cost to Haarchive users?"

**Not fully, and not for the general case.** For any location, any historical date, genuinely sub-hourly and genuinely free simultaneously: no, based on every provider researched. A *bounded* yes exists only for runs imported within roughly the last week, and only if Tomorrow.io's free tier turns out to actually support it (unconfirmed) — everything else trades away either cost, freedom from an API key, historical range, or geographic coverage.

### "If yes, what provider and architecture should we use?"

For the general case: **keep Open-Meteo**, exactly as already extended (hourly-window averaging, stepwise not interpolated, per §4). For the narrow, unconfirmed "last ~7 days" case: **do not build anything yet** — first run the time-boxed Tomorrow.io free-tier spike in §15, step 2, and only implement the fallback-protected addition described in §15 steps 3-4 if that spike actually confirms free, reliable, genuinely-observational access. Everything else in this document (the `elapsedSeconds` grid gap, the spatial-sampling reasoning, the caching/security architecture) is worth keeping as a reference regardless of which way that one open question resolves.

---
---

# Tomorrow.io Free-Tier Verification (Spike Results)

**Date:** 2026-08-21
**Purpose:** Empirically resolve the one open question the original investigation above left conditional — "does Tomorrow.io's free tier actually support genuinely sub-hourly historical weather for arbitrary imported runs?" — per the dedicated spike request.
**Verdict: DOES NOT QUALIFY.** Disqualified on documented policy grounds, not merely a resolution shortfall. Explained fully below, including exactly what could and could not be empirically tested and why.

## What this spike could and could not do

The spike request asked for a real API experiment (Tests A–D) against a live Tomorrow.io key. **No live API call was made.** Obtaining a Tomorrow.io API key requires completing their web signup flow, which requires a verifiable email address and (per their own account-creation flow) email confirmation — I do not have the ability to complete an interactive, email-verified third-party account signup from within this session's tools (no persistent inbox, no browser session capable of completing that flow). I did not attempt to automate around this, since doing so would mean scripting a signup against a real product's account-creation system without a real, checkable email — not appropriate regardless of feasibility.

This matters less than it might seem, for a specific reason established below: **the disqualifying facts here are at the documented plan/policy level, not the data-quality level.** A live API call could only have told me more about timestamp spacing and value provenance *within* whatever window the key was entitled to query. It could not have changed what that window is, or what the free plan's terms of service permit — both of which are stated directly, in Tomorrow.io's own official documentation, independent of any live call. Where the evidence below comes from an official Tomorrow.io page, it's cited as such; nothing here is inferred from a third-party blog post where the official docs were reachable instead.

If this conclusion is ever worth re-litigating, the fastest path is for a Haarchive-controlled email to complete the ~2-minute signup and hand me a key — at that point I could still run Tests A–D for completeness, but per the reasoning below, I would not expect them to change the verdict.

## Evidence

### 1. Free-tier historical lookback: 24 hours

Tomorrow.io's own pricing/plan documentation (`support.tomorrow.io`'s Pricing Overview, corroborated independently via the RapidAPI-hosted mirror of the same plan data) lists, as a named feature of the **Free ($0.00/mo)** plan: **"24 hours Historical Weather Data."** This is a *plan-level* cap, not a rate limit — it defines how far back a free-tier key is entitled to query at all, regardless of resolution.

By contrast, deeper historical access ("hourly and daily historical weather data up to 20 years in the past," per the same source) is an **Enterprise-tier** feature. Two things follow from this second data point:

- Even the *paid* deep-historical archive is documented as **"hourly and daily"** — not sub-hourly. The 1-minute/5-minute/15-minute resolution Tomorrow.io advertises applies specifically to its short recent-history window, not to its actual multi-year archive, on any plan.
- Free-tier users get neither: no deep archive access at all (Enterprise-only), and only 24 hours of the fine-resolution recent window.

### 2. Even within that window, sub-hourly requests are further capped

Tomorrow.io's own documentation states that "for 1-minute, 5-minute, and 15-minute timesteps, requests are limited to a 24-hour period per API call" — i.e., even where sub-hourly resolution is available at all, a single request can't span more than 24 hours of it. This is consistent with (not an additional restriction beyond) the free-tier's own 24-hour historical cap, but confirms the fine-resolution feature is architecturally scoped to "recent," not "archival," use across the whole product, not just the free tier.

### 3. Free-tier rate limits

Documented (Tomorrow.io support article, cross-checked against a second independent source): **3 requests/second, 25 requests/hour, 500 requests/day.**

### 4. Commercial use is explicitly prohibited on the free tier

This is the second, independently sufficient disqualifier. Tomorrow.io's own Terms of Service state that commercial use is **prohibited** "in the case of evaluation, proof of concept, or in connection with self-generated accounts originated on Company's website" — i.e., exactly the free/self-signup tier. Their own guidance for any commercial deployment is to contact sales for a paid plan. Haarchive, as a live product serving real users, is not "evaluation or proof-of-concept" use — deploying the free tier into production would violate Tomorrow.io's own terms, independent of any technical question.

### 5. Data provenance for the (inaccessible-to-free-tier) deep archive

Tomorrow.io's own Historical API documentation states that data more than ~7 days old "is based on a reanalysis model that blends past short-range weather forecasts with observations through advanced data assimilation techniques" — i.e., **model-derived/reanalysis, the same general category as Open-Meteo's ERA5**, not raw station observation. Even if this tier were reachable, it would not represent a categorically different kind of data than what Haarchive already has.

### 6. Comparison against Open-Meteo

A direct side-by-side API comparison (same coordinates, same historical date, both providers) could not be performed without a Tomorrow.io key (see above). Based on documentation alone, the honest comparison is: **for any date older than 24 hours, Tomorrow.io's own free-tier access is more restrictive than Open-Meteo's, not more capable** — Open-Meteo already provides free, keyless, arbitrary-historical-date, global hourly data; Tomorrow.io's free tier provides less historical reach than that, in exchange for finer resolution only inside a 24-hour window most imported runs will already have aged out of by the time someone gets around to importing them.

## Decision criteria checklist (from the spike request, §6)

| Requirement | Tomorrow.io free tier | Passes? |
|---|---|---|
| Free for Haarchive's intended use | Free tier exists, but ToS explicitly excludes production/commercial use | **Fail** |
| Historical | Yes, but capped at 24 hours | **Fail** (for "arbitrary imported runs") |
| Works for arbitrary imported runs, not just recent ones | No — 24-hour cap | **Fail** |
| Lat/lon based | Yes | Pass |
| Genuinely sub-hourly | Yes, within the 24-hour window; the deep archive (were it reachable) is documented as hourly/daily only | Partial, moot given above |
| Temperature / humidity / wind speed / wind direction | All documented as available | Pass |
| Sufficient request limits for realistic Haarchive traffic | 500/day free — plausible at Scenario A/B traffic (§7 of the original investigation), moot given the above | N/A |
| Permits the intended commercial/product use | Explicitly prohibited on free tier | **Fail** |
| Does not require users to provide their own API key | Correct architecturally (server-side key), doesn't rescue the plan-level failures above | N/A |
| Does not introduce an unacceptable reliability dependency | Not reached — disqualified before this matters | N/A |

**Three of the "must satisfy ALL" criteria fail on documented, official grounds.** Per the spike's own decision rule ("if even one critical requirement fails, do not recommend replacing Open-Meteo"), this is unambiguous.

## Conclusion

**QUALIFIES / DOES NOT QUALIFY / INCONCLUSIVE → DOES NOT QUALIFY.**

Not "inconclusive" — the disqualification is at the documented plan-policy level (24-hour historical cap, explicit commercial-use prohibition), which no live API call would have changed. A live test remains available as a follow-up if the user wants to independently confirm timestamp spacing for intellectual completeness, but it would not alter this verdict.

## Recommendation, ranked

- **Option A — Open-Meteo (recommended, unchanged from the original investigation).** The current hourly-window-averaging implementation remains the correct general solution: free, keyless, globally covered, arbitrary historical range, and — as this spike confirms — not actually beaten on any of those dimensions by Tomorrow.io's free tier, only on resolution, and only inside a 24-hour window that doesn't fit Haarchive's actual use case (importing a run at some arbitrary point after it happened, not exclusively same-day).
- **Option B — NOAA/ASOS.** Still the only genuinely free, genuinely observational, genuinely sub-hourly (sub-*minute*) option found across both investigations. Confirmed this spike: IEM's one-minute ASOS service is CSV-only (no JSON endpoint), station-ID-based (no lat/lon query — a separate nearest-station lookup would need to be built), and explicitly free for any lawful use including commercial. Real, but meaningfully more integration work than a JSON REST API, and US-only. Worth keeping on the roadmap as a distinct, separately-scoped future spike — not a quick follow-on to this one.
- **Option C — Paid providers.** Not evaluated for exact pricing in this spike (out of scope — the request was specifically about free-tier viability), but per the original investigation, Visual Crossing's metered pricing (~$0.0001/record beyond 1,000 free records/day) would be the cheapest path to genuine sub-hourly historical data *if* Haarchive ever decides paying for this specific fidelity increase is worth it. That's a real, separate product decision, not a technical one this spike can make.
- **Option D — Interpolation.** Still not recommended, for the same reason as the original investigation: manufacturing values between two real hourly Open-Meteo readings would not add real accuracy, only the appearance of it, which runs directly against the product's own stated principle of not manufacturing precision the underlying data doesn't have.

## Implementation status

- **Files changed:** `docs/continuous-weather-investigation.md` only (this update).
- **Files not changed:** `environmental-calculator.tsx`, any weather engine, `fetch-weather-conditions.ts`, `use-environmental-weather.ts`, any other production file — none touched.
- **Dependencies added:** none.
- **API keys added:** none — no Tomorrow.io key was obtained or used.
- **Database/schema changes:** none.
- **Tests run:** none new (no code changed); no existing tests were affected.
- **API experiments performed:** none against Tomorrow.io (see "What this spike could and could not do" above). Open-Meteo's existing behavior was re-confirmed by reading, not re-executing, the current implementation (§1 of the original investigation, re-verified fresh against the current repository this session).
- **Production behavior:** unchanged.
