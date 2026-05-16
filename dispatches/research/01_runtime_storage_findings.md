# 01 — XP runtime + storage layer (gtl1 research)

HEAD at investigation: `c397e26` on `dev`.

## Q1. Current XP calculation path

**There is no centralized XP function and no `setXP` event.** XP is recomputed lazily from raw set logs every time it's needed. Three near-duplicate copies of the formula live across the active routes + stats page; they share one shape.

- **`repMult(reps)`** — defined identically four times:
  - `app/fitness/stats/page.js:42-46`
  - `app/fitness/active/page.js:2667-2671`
  - `app/fitness/active/[iso]/page.js:2828-2832`
  - `app/fitness/active/[iso]/[muscleId]/page.js:2638-2642`
  Body: `r ∈ [5,15] → 1.0`; `r < 5 → exp(-(r-5)²/8)`; `r > 15 → exp(-(r-15)²/32)`. Confirms brainstorm R1 (flat plateau, bell tails).
- **Per-set XP** is computed inline as `weight > 0 ? weight * mult * reps : reps * mult`. Bodyweight fallback is a quirky `reps * mult` (no BW load — reps double as load). Three locations:
  - `app/fitness/stats/page.js:296` — inside the region-XP aggregator (`computeStats`, lines 263-323).
  - `app/fitness/active/[iso]/[muscleId]/page.js:2669` — inside `computeTotalXP` (lines 2644-2677).
  - `app/fitness/active/page.js:2697` (mirrored) and `:3052-3055` (per-day total inside `triggerXPAnimation`, lines 3028-3104).
  - `app/fitness/active/[iso]/page.js:2858` (mirrored).
- **Region map**: `BODY_REGIONS` at `app/fitness/stats/page.js:17-23`; flattened to `MUSCLE_TO_REGION` at `:26-27`. **1:1 muscle→region** (no wger weights). Used at `:297` to credit `regionXP[ri] += earned`. Five regions confirm spec: CORE / ARMS / LEGS / FRONT / BACK. Note current map: `shoulders → FRONT` (becomes ARMS under R10a); `glutes → LEGS`, `hamstrings → LEGS`, `quads → LEGS` (all change under R10a's dual semantics).
- **Player-level threshold**: `getLevelInfo(totalXP)` at `app/fitness/stats/page.js:29-40` (and clones at `active/page.js:2654`, `:[iso]/page.js:2815`, `:[iso]/[muscleId]/page.js:2625`). Formula `15000 + level × 1000` per spec.

**Call chain (set → XP credited to state):** there is no per-set credit event. The user logs reps/weights via `RepsPopup`/`WeightPopup` (`active/[iso]/[muscleId]/page.js:438-844, 845+`), which call `saveReps`/`saveWeight` (`:1525-1549`) → these write `pk('ex-{cycleId}-{iso}-{muscleId}')` and `pk('wt-{cycleId}-{iso}-{muscleId}')` to localStorage. **XP only materializes when:**
1. The XP bar in `active/page.js` reads `computeTotalXP()` on mount and after `triggerXPAnimation` (`:2803-2804, 3074-3076`).
2. The stats page recomputes everything on render (`computeStats` at `stats/page.js:262-334`).
3. `triggerXPAnimation(closingDay)` at `active/page.js:3028-3104` fires when a day card is closed, sums per-day volume, and runs the particle→bar fly choreography (phases: expand→converge→combine→fly→fill, ~3.1s).

**Important consequence for combo planning:** any new multiplier stack must either (a) be applied at every recompute site (4 functions, 3 files) or (b) the lazy-recompute pattern must be replaced with a stored derived value. The brainstorm's R8a end-of-day reckoning fits the lazy pattern; the per-set R18 cinematic does not — it requires a real per-set credit event that doesn't exist today.

## Q2. Profile schema + persistence

- **`pk()` helper** (`lib/storage.js:8-15`): reads `localStorage.getItem('gtl-active-profile') || 'default'` and returns `gtl-${profile}-${key}`. Sister helpers `getItem`/`setItem` at `:17-26` JSON-encode through the same prefix. **`pk()` is the only profile-scoping primitive in the repo** — there are no class abstractions over the profile.
- **Profile data shape today**: there is no profile object. Just two flat keys (NOT `pk()`-scoped — they live globally so all profiles can see the list):
  - `gtl-profiles` — `string[]` of display names.
  - `gtl-active-profile` — single string, the active name.
  Wired at `app/fitness/page.js:236, 276, 312-315`.
- **No `user_bodyweight`, `user_sex`, DOB, or any other field exists** — confirmed by grep across `app/`, `components/`, `lib/`, `app/settings/page.js`. R1a's bodyweight prerequisite is **net-new schema**.
- **`useProfileGuard()`** (`lib/useProfileGuard.js:5-14`): one-line hook — if `gtl-active-profile` is missing, redirect to `/fitness`. Called at the top of every fitness sub-page (e.g., `active/page.js`, `stats/page.js`, every active sub-route, hub, edit, etc.). It is purely a route guard; there is no profile-state context, no profile-loaded boolean, nothing else.
- **Persistence model**: 100% localStorage, profile-prefixed via `pk()`. No IndexedDB. The only server route is `app/api/fitness/plan/route.js`, which is unrelated to profile/XP storage.

## Q3. Session / cycle / completion model

- **Cycle schema** (`app/fitness/new/summary/page.js:2781-2785` is the canonical write):
  ```
  cycle = { id, name, targets, days[], dailyPlan: { [iso]: muscleId[] }, createdAt }
  ```
  Stored at `pk('cycles')` as a `Cycle[]`. The active cycle id lives at `pk('active-cycle-id')`. There's also a redundant `pk('daily-plan')` key written elsewhere (read at `active/[iso]/[muscleId]/page.js:2701-2703`) — that's a flattened cache of the active cycle's dailyPlan.
- **Planned sets — two separate sources of truth, neither is a single "planned set" count:**
  1. `cycle.dailyPlan[iso] = muscleId[]` — which muscles are scheduled that day.
  2. **Attunement chips** (`lib/attunement.js`) — `pk('attunement-{cycleId}')` → `Record<dayId, { chips: SetChip[], completedAt? }>`. Each `SetChip = { id, exerciseId, addedAt }` is one *exercise instance*. Selectors: `chipsForDay(cycleId, dayId)` (`:123`), `isDayLocked` (`:128`), `emptyDayCount` (`:138`). Mutators: `addChip` (`:149`), `duplicateChip` (`:160`), `deleteChip` (`:174`), `replaceExercise` (`:194`), `moveChip` (`:239`), `autoAttuneAll` (`:284`).
  3. `pk('setcounts-{muscleId}')` — `Record<exerciseName, number>`, default 2. **Profile-scoped, NOT cycle/day-scoped** — it's a per-muscle global preference for "how many sets per exercise." Defined at `active/[iso]/[muscleId]/page.js:1467` and clones; read into `setCounts` state at `:1453, 1517`.
  4. **Implication for R8 `sets_planned_today`**: must be computed as `chips_today × setcounts[exerciseName]` (or default 2). No single key holds it today.
- **`done-{cycleId}-{iso}` flag** — written at `active/[iso]/page.js:2070` (the canonical `handleStamp` site) and at `:[muscleId]/page.js:1981`, `:active/page.js:1991+`. Set to literal string `'true'`. Read at `active/[iso]/page.js:104, 195, 2051`, `[muscleId]/page.js:105, 196, 1962, 2655`, `active/page.js:3035`, `stats/page.js:278`. **It's a manual stamp** — user taps the stamp button; no auto-completion.
- **`sets_logged_today`** — must be derived by reading `pk('ex-{cycleId}-{iso}-{muscleId}')` for each `cycle.dailyPlan[iso]` muscle, parsing the `Record<exerciseName, number[]>` reps map, and counting non-zero entries. Today, this is only done indirectly inside `computeTotalXP` (does not return a count, just XP). The pattern at `active/page.js:2248` (`Object.values(allReps[muscleId] || {}).flat().filter(v => v > 0).length`) is the closest extractable form.
- **Session start / end**: there is **no sessionStart event**. The only session-end signal is `handleStamp` writing `done-{cycleId}-{iso}=true`. R8a's "end-of-day reckoning" must hook this site (or roll-over detection on next-day mount).

## Q10. Existing combo / multiplier stubs

**Nothing combo/multiplier-related exists in app/component code yet.** All hits across `app/**` and `components/**` for `combo|multiplier|consistency|tier|GRITTED|prestige|ribbon|streak` are unrelated:

- `combo` — only in exercise names (e.g., `'HYPER Y W COMBO'` at `lib/exerciseAliases.js:436`, plus comments at `:248, 271, 278, 289, 474`).
- `multiplier` — only audio gain (`lib/useSound.js:112`, `lib/bgmTracks.js:235, 239, 254`) and a paired-spread comment at `calibrate-from-bones.js:22`.
- `tier` — `lib/zoomTier.js` (`zoomTier(scale)` for Attune calendar zoom, `:13-18`); unrelated.
- `GRITTED` — only the brand string ("GRITTED TEETH LIFESTYLE") in titles, calling cards, and gate screen.
- `prestige` / `ribbon` / `streak` — **zero matches.**

**The curation layer, by contrast, IS present and ready** — `lib/exerciseAliases.js` already defines `REFERENCE_BW` (`:22`), `IPF_GL_PARAMS` (`:35-38`), `KING_COMPOUNDS` (`:491-500`, 18 entries), `ISOLATION_OVERRIDE` (`:512-520`, 13 entries), `HEAVY_LIFT_THRESHOLDS` (`:530-` map), `HEAVY_LIFT_CLASS_SCALES` (`:800-804`), `HEAVY_LIFT_CLASS_DEFAULTS` (`:808-812`), `STAR_FLOOR_FRACTION = 0.75` (`:824`), `BW_COEFFICIENT` (`:830-872`), and `MUSCLE_FIXUP` (`:924+` covering all 263 entries). These are baked into `lib/exerciseLibrary.js` per-entry as `primaryMuscles`, `secondaryMuscles`, `is_king_compound`, `is_isolation_override`, `bw_coefficient`, `heavy_lift_threshold`, `heavy_lift_scale` (verified at `lib/exerciseLibrary.js:53, 175, 216, 273, 372, 456, 472, 493, 560, …`). **Nothing in `app/` or `components/` reads any of those new fields yet** — confirmed by glob+grep, zero consumers. The runtime side is fully greenfield; the data side is fully ready.
