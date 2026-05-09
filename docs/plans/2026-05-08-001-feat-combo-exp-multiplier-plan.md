---
title: feat: GTL Combo EXP Multiplier System
type: feat
status: active
date: 2026-05-08
origin: dispatches/2026-05-03-gtl-combo-exp-multiplier-requirements.md
---

# feat: GTL Combo EXP Multiplier System

## Overview

Layer the locked Combo EXP multiplier system on top of GTL's existing per-set XP foundation. Adds: IPF GL Points strength normalization, two parallel tracks (continuous Total XP via additive multipliers + discrete region stars on the transmutation circle), 21-tier teeth-grip ladder with cumulative-100%-session counter, prestige loop with permanent ribbon bonuses, holiday windows, and a sequential per-set cinematic with R18a HEAVY LIFT bonus reveal.

The brainstorm and 263-entry exercise library are fully locked. This plan turns the spec into atomic implementation units that workers can pick up in waves.

## Problem Frame

GTL today computes per-set XP via `weight × repMult(reps) × reps` and credits a single Total XP counter plus a 1:1 muscle→region split into a 5-region transmutation circle. The system has no notion of consistency, no class differentiation between bench and curl, no progression beyond linear XP gain, and no rewards for sustained adherence.

The new system makes plan adherence the engine: completing planned sessions advances a 21-tier ladder; tier height multiplies XP; King Compounds, Compounds, and Isolations earn different multipliers; lighter users get strength-relative XP via IPF GL Points; persistent ribbons compound XP across prestige cycles; holidays add festival multipliers. Region stars on the transmutation circle turn from continuous radii into discrete 0/1/2★ awards per set, gated by a relative-load floor.

See origin: `dispatches/2026-05-03-gtl-combo-exp-multiplier-requirements.md` for the full algo lockdown.

## Requirements Trace

This plan satisfies R1, R1a, R2-R3, R4, R5/R5a/R5b/R5c, R6, R7, R8/R8a, R9, R10/R10a, R12/R12b/R12c, R13, R14, R15, R16, R17, R18/R18a, R19, R20/R20a from the origin. R11 (legacy band thresholds) is retained as advisory only.

## Scope Boundaries

- The existing `repMult(reps)` curve is unchanged — exact body lifts to a new shared module.
- Total XP / player-level threshold formula (`15000 + level × 1000`) is unchanged.
- The 5-region structure (CORE / ARMS / LEGS / FRONT / BACK) is unchanged in identity; only the muscle→region map shifts to dual semantics (R10a).
- The wger seed import process is in flight and not in scope here. The plan consumes the already-committed `lib/exerciseLibrary.js` (263 entries, all curated fields populated as of `dev` HEAD).
- Express forge cycle path is untouched.
- The Attune flow itself is untouched — this plan reads its outputs (`lib/attunement.js`, `pk('attunement-{cycleId}')`).
- No backend / server work — all persistence stays profile-scoped localStorage via `pk()`.
- The loading screen brainstorm currently in flight (separate workstream) is not blocked by this plan.

## Context & Research

### Relevant Code and Patterns

Source-of-truth call-sites identified in worker research findings:

- **XP formula duplication** — `repMult(reps)` and the inline `weight × mult × reps` reduction live identically in 4 places: `app/fitness/stats/page.js:42-46/296`, `app/fitness/active/page.js:2667-2671/2697`, `app/fitness/active/[iso]/page.js:2828-2832/2858`, `app/fitness/active/[iso]/[muscleId]/page.js:2638-2642/2669`. **All four collapse into one shared module under this plan.**
- **Region map** — `BODY_REGIONS` at `app/fitness/stats/page.js:17-23` plus flat `MUSCLE_TO_REGION` at `:26-27`. Currently 1:1 muscle→region (e.g., `quads → LEGS`, `shoulders → FRONT`). Becomes dual-semantics under R10a (`quads → FRONT`, `hamstrings → BACK`, `glutes → LEGS`, `shoulders → ARMS`).
- **Profile / persistence** — `lib/storage.js:8-15` `pk()` helper is the only profile-scoping primitive. Profile registry `gtl-profiles[]` + active `gtl-active-profile` are intentionally NOT pk()-scoped. Everything else is.
- **`useProfileGuard()`** — `lib/useProfileGuard.js:5-14`. Single-line route guard. Called at the top of every fitness sub-page.
- **Set save sites** — `saveReps` / `saveWeight` at `app/fitness/active/[iso]/[muscleId]/page.js:1525-1549`. Today these write `pk('ex-...')` and `pk('wt-...')` and emit no XP credit event. **The R18 cinematic and the per-set XP snapshot both attach here.**
- **`done-{cycleId}-{iso}` flag** — written at `app/fitness/active/[iso]/page.js:2070` (canonical `handleStamp` site). Set to literal `'true'`. **R8a end-of-day reckoning hooks here.**
- **Session completion derivation** — currently no single key holds `sets_planned_today`. Must be computed as `chips_today × setcounts[exerciseName]` from `lib/attunement.js` `chipsForDay()` × `pk('setcounts-{muscleId}')`. `sets_logged_today` derives from non-zero entries in `pk('ex-{cycleId}-{iso}-{muscleId}')`.
- **Transmutation circle** — `BodyStarChart` at `app/fitness/stats/page.js:546-589`, composed of `TransmutationCircle` (`:451-544`) + filled-XP polygon (`buildStarPath` at `:374-383`) + `RegionBadge` per region (`:428-448`). Stars today are polygon-radius-based, NOT discrete pips. New `regionStars: number[5]` and a new render layer needed.
- **Existing animation precedent** — `triggerXPAnimation` at `app/fitness/active/page.js:3028-3104` is a 5-phase choreography (`expand → converge → combine → fly → fill`, ~3.1s) currently orphaned (defined but uncalled — refactor casualty). Its level-up sub-cascade at `:3486-3640` is the right pattern to mirror for R7 tier-up flourish.
- **iOS PWA gotchas already documented in active/page.js** — scroll-lock `position:fixed + inset:0 + touch-action:none` (`:2758-2789`), 150ms leaked-click grace via `mountTimeRef` (`:2727-2731`), `scrollTop` direct assignment over `scrollBy` (`:2891-2894`), predictive-tap chain coordination via `setInAnimation` (`:2754`). Cinematic must respect all four.
- **Settings page** — `app/settings/page.js`, with form-row primitives `Toggle` (`:42-63`), `VolumeSlider` (`:65-87`), `DangerButton` (`:89-127`). No existing text/number/date input row. Credits section at `:499-515`. New "WARRIOR DATA" section slots between HAPTICS (`:452`) and DEFAULTS (`:455`).
- **Onboarding** — single-screen profile-creation form at `app/fitness/page.js`. `handleSubmit` (`:307-321`) `isNew` branch (`:312-316`) is the inline-onboarding hook. Modal precedent: `components/attune/FirstTimeInstructionPopup.jsx` (`fixed inset-0` + dimmed backdrop + centered card).
- **Library access** — `lib/exerciseLibrary.js` exports `ALL_EXERCISES`, `exercisesByMuscle`, `canonicalExerciseFor`, `searchExercises`. **No `getExerciseById` helper today** — internal `_ALL` is not exported. Plan adds it.

### Institutional Learnings

The learnings-researcher agent was not run because Jordan redirected research to the worker dispatch path. Memory notes considered relevant:

- `feedback_ios_pwa_*` (multiple) — viewport, blend modes, scrollby unreliability, sr-only input scroll, audio unlock, autofill killers. The cinematic, BW modal, and tier-up flourish all need to honor these.
- `feedback_dispatch_*` (multiple) — worker dispatch protocol; relevant for the implementation phase, not the plan itself.
- `feedback_brainstorm_plan_workflow.md` — validates the ce-brainstorm + ce-plan + 3-way worker dispatch flow this plan plugs into.

### External References

External research skipped per ce:plan §1.2: codebase has strong local patterns, IPF GL formula coefficients are locked in spec, US federal holiday math is well-documented, no novel framework decisions.

## Key Technical Decisions

### Decision 1: Move from lazy-recomputed XP to event-sourced persisted XP snapshots

**Rationale:** R2's multiplier stack depends on values at the *moment of the set* (consistency tier, ribbon count, holiday active that day). The current pattern of lazy-recomputing XP at every render from raw reps+weights cannot survive — by the time stats are viewed, tier/ribbons may have changed.

**Implementation:** A new append-only per-set XP snapshot store at `pk('xpLog-{cycleId}-{iso}-{muscleId}-{exerciseName}')` (or similar shape — final key shape decided in Unit 3). Each set save writes both the existing reps/weight keys AND a snapshot record `{setIdx, ts, baseXP, normFactor, heavyLiftBonus, classMult, prestigeMult, holidayMult, finalXP, regionStars[5], earnsStars}`.

`computeTotalXP` and `loadStats`'s region-XP aggregator switch to summing the snapshot store. The R8a deferred consistency contribution is appended to the day's snapshot list at end-of-day reckoning.

The existing `pk('ex-...')` / `pk('wt-...')` keys remain — they're still the source of truth for the reps/weight UI. The XP log is a derived parallel store.

### Decision 2: Single shared XP runtime module (`lib/exp/`)

**Rationale:** The current 4-way duplication of `repMult(reps)` and the XP reduction is the source of every bug class in this plan. Consolidate into a single module before adding any new behavior.

**Module shape (Unit 2):**

```
lib/exp/
  ipfGL.js          // ipfGL(bw_kg, params), bodyweightNormFactor(user_BW_lb, sex)
  regions.js        // R10a dual-semantics MUSCLE_TO_REGION + regionWeights(exercise)
  tier.js           // R5b pacing curve, R5c multiplier curve, getTier(count), tickTier()
  holidays.js       // R16 federal-holiday math, getHolidayMultiplier(date, userDOB)
  prestige.js       // R9 ribbon math, getPrestigeMultiplier(ribbonCount)
  setXP.js          // calculateSetXP(set, exercise, user, runtimeState) — orchestrator
  setLog.js         // appendSetLog, readSetLog, sumSetLog (Decision 1 store)
  index.js          // re-exports
```

All four current `repMult` copies + the inline reduction get replaced by `import { repMult, calculateSetXP } from 'lib/exp'`.

### Decision 3: New `<SetXPCinematic>` component, not extension of `triggerXPAnimation`

**Rationale (per gtl2 research):** The existing animation is spatial (particle convergence to XP bar) and per-day; R18 is sequential text-row reveal and per-set. Different geometry, different choreography axis, different mount location. The orphaned `triggerXPAnimation` should be deleted in this plan or left for separate cleanup; the new cinematic is a sibling component mounted at the set-save site (`[muscleId]/page.js`).

The cinematic's terminal phase reuses the existing `xp-fly` keyframe to bubble the running total to the cycle-overview XP bar, preserving visual continuity with level-up.

### Decision 4: New `/fitness/profile` route for R20 identity surface

**Rationale (per gtl2 research):** No profile page exists today. Settings has only "ACTIVE WARRIOR — {name}" line. Hub has no profile reference. Promoting Settings to host the identity tag + ribbon row would overload that page; a dedicated route mirrors the existing `/fitness/stats` shell pattern and gives R7 tier-up flourish a stable home.

Hub adds a "WARRIOR PROFILE" entry alongside the existing "WAR RECORD" linking to it.

### Decision 5: Region-star animation strategy — silent accumulate + animate-on-stats-mount (Phase 1)

**Rationale:** Per-set star pop on the active page would require either mounting `BodyStarChart` (heavy, transmutation circle SVG) on the active route, or building a parallel mini-overlay. Both are scope-add. Phase 1 ships silent accumulation: each set updates `pk('region-stars')`; stats page mount animates new stars. Delivers R12/R12b/R13 without new-overlay scope. Per-set pop on active page is a follow-on if Jordan wants it after living with Phase 1.

### Decision 6: Architectural ripple — MUSCLE_TO_REGION single source

R10a dual semantics changes 4 muscle mappings. The current `MUSCLE_TO_REGION` is built inside `app/fitness/stats/page.js` from the `BODY_REGIONS` array. Move this to `lib/exp/regions.js` so the active-page region computations and the new star resolver share one source. Stats page imports from there.

## Open Questions

### Resolved During Planning

- **Where does `calculateSetXP` live?** — `lib/exp/setXP.js`. Orchestrates ipfGL + regions + tier + holidays + prestige.
- **How does the cinematic know current tier / ribbons / holiday at set-time?** — `calculateSetXP` reads `pk('tier-count')`, `pk('ribbon-count')`, and computes `getHolidayMultiplier(today, pk('user-dob'))` synchronously inside the save handler.
- **Region star animation strategy** — Decision 5 above.
- **Profile page placement** — Decision 4 above.
- **BW modal gate scope** — fires at first BW-coefficient set save inside `[muscleId]/page.js`'s `saveReps`/`saveWeight`, not on every active-page mount. Cheaper UX, lazy gate.
- **Tiebreak for R12 compound second slot** — already resolved in brainstorm: alphabetical fallback. Curation eliminates ties.
- **Holiday detection** — local-machine date check (`new Date()`). No server roundtrip per scope boundary.

### Deferred to Implementation

These were explicitly named in the King handoff as out-of-brainstorm. Workers surface decisions to King at unit-time:

- **R7 tier-up flourish specifics** (kanji/color/animation choreography per crossing) — Unit 8. King supplies design when Unit 8 is dispatched.
- **Cinematic timing relative to star animations** — Unit 6/7 boundary. Default: star pop fires at the end of the cinematic, before bar fly.
- **Profile-page identity tag styling** — Unit 8. Mirror `RegionBadge` parallelogram aesthetic by default; King to confirm.
- **Settings page bodyweight UI specifics** — Unit 1. New `<NumberRow>` shape; King to spec exact validation rules and unit handling.
- **Onboarding bodyweight prompt copy** — Unit 1. King to supply one short brand-voice line.
- **Worker dispatch parcel shape** — see "Worker Dispatch Map" section at the end of this plan.

### Deferred — Technical (resolved at implementation time, not blocking plan)

- Final exact key shape for the XP log (per-set vs per-exercise vs per-day rollup) — Unit 3.
- Whether to delete the orphaned `triggerXPAnimation` in this plan or leave for separate cleanup — Unit 6.
- Whether the active page needs a parallel `<RegionStarPip>` overlay (Phase 2) or stays silent-accumulate (Phase 1) — Unit 7 ships Phase 1; Phase 2 backlogged.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Set-save data flow (the new path)

```
User taps SAVE on RepsPopup / WeightPopup
   │
   ▼
saveReps / saveWeight  (app/fitness/active/[iso]/[muscleId]/page.js:1525-1549)
   │
   ├─► writes pk('ex-...') / pk('wt-...')              [existing — unchanged]
   │
   ├─► reads exercise via lib/exp.getExerciseById(id)
   ├─► reads user via lib/storage.pk('user-bodyweight'), pk('user-sex')
   ├─► reads runtime via lib/exp.getTier(pk('tier-count')),
   │                   lib/exp.getPrestigeMultiplier(pk('ribbon-count')),
   │                   lib/exp.getHolidayMultiplier(today, pk('user-dob'))
   │
   ├─► snapshot = calculateSetXP({reps, weight}, exercise, user, runtime)
   │     {
   │       baseXP, normFactor, heavyLiftBonus,
   │       classMult, consistencyMult (deferred to EOD), prestigeMult, holidayMult,
   │       totalXP, regionWeights[5], regionStars[5], earnsStars
   │     }
   │
   ├─► appendSetLog(snapshot)                          [Decision 1]
   ├─► updateRegionStars(snapshot.regionStars)         [Decision 5: silent]
   │
   └─► mount <SetXPCinematic snapshot=... />           [R18 + R18a]
         │ sequential reveal: base → HEAVY LIFT? → consistency → class → prestige → total
         │ inactive multipliers skip-render
         │ terminal phase: xp-fly to overview bar
         └─► onComplete: dismiss
```

### End-of-day reckoning (R8a)

```
User taps STAMP   (handleStamp at app/fitness/active/[iso]/page.js:2070)
   │
   ▼
writes pk('done-{cycleId}-{iso}') = 'true'              [existing — unchanged]
   │
   ├─► sets_planned = sum(chipsForDay × setcounts[exerciseName])
   ├─► sets_logged = count(non-zero entries in pk('ex-{cycleId}-{iso}-*'))
   ├─► completion_pct = sets_logged / sets_planned
   │
   ├─► if completion_pct == 1.0:
   │      tickTier()                                    [R5a, +1 cumulative]
   │      if pk('tier-count') == 100: unlock_prestige_choice()  [R9]
   │
   ├─► day_consistency_credit = sum_today_baseXP
   │                          × tierMult(pk('tier-count'))
   │                          × completion_pct
   │     (where completion_pct = 0 if < 0.5)
   │
   └─► appendSetLog({type:'consistency-credit', ts, value: day_consistency_credit})
```

### Region star resolution

```
calculateSetXP(...) returns regionStars[5] computed as:

regionWeights = R10a-mapped 60/40 split from exercise.primaryMuscles + secondaryMuscles
relative_load = bw_coefficient + entered_weight / user_BW
earns_stars   = relative_load >= 0.75 × exercise.heavy_lift_threshold

if not earns_stars:
  regionStars = [0, 0, 0, 0, 0]
elif exercise.is_isolation_override or autoIsolate(regionWeights):
  top1 = argmax(regionWeights)
  regionStars[top1] = 2                              [R13]
elif exercise.is_king_compound:
  top3 = top-3-by-weight(regionWeights, alphaTiebreak)
  for r in top3: regionStars[r] = 1                  [R12b]
else:                                                [R12]
  top2 = top-2-by-weight(regionWeights, alphaTiebreak)
  for r in top2: regionStars[r] = 1
```

## Implementation Units

- [ ] **Unit 1: Profile schema + Settings UI + onboarding BW gate + wger attribution**

**Goal:** Capture `user_bodyweight`, `user_sex`, `user_dob` per profile. Add Settings UI for editing. Add inline onboarding step for first-time profile creation. Add modal blocking gate at first BW-coefficient set. Add wger attribution line.

**Requirements:** R1a (BW prerequisite), R15 (wger attribution), R16 (DOB → birthday holiday).

**Dependencies:** None.

**Files:**
- Modify: `app/settings/page.js` (add WARRIOR DATA section between HAPTICS at `:452` and DEFAULTS at `:455`; add wger attribution line in CREDITS at `:499-515`)
- Create: `components/settings/NumberRow.jsx` (shared input row matching existing clip-path/typography)
- Create: `components/settings/SexToggle.jsx` (binary pill toggle)
- Modify: `app/fitness/page.js` (extend `handleSubmit` `isNew` branch at `:312-316` to capture BW before routing to hub)
- Create: `components/onboarding/BodyweightStep.jsx` (inline onboarding card)
- Create: `components/onboarding/BodyweightModal.jsx` (blocking gate modal, mirroring `components/attune/FirstTimeInstructionPopup.jsx`)
- Modify: `app/fitness/active/[iso]/[muscleId]/page.js` (mount BodyweightModal when `pk('user-bodyweight')` is unset and the exercise has `bw_coefficient`; gate `saveReps`/`saveWeight` save path until set)
- Test: `__tests__/onboarding/bodyweight.test.js`
- Test: `__tests__/settings/warrior-data.test.js`

**Approach:**
- Three new pk()-scoped keys: `pk('user-bodyweight')` (number, lb), `pk('user-sex')` (string `'m'|'f'`, default `'m'`), `pk('user-dob')` (ISO date string, optional — only needed for R16 birthday).
- Onboarding step is non-skippable for sex+BW; DOB skippable.
- Modal backstop: existing profiles without BW can't log BW-coefficient sets until they enter it. Reuse `pk('user-bodyweight')` presence as the captured signal — no separate `*-onboarding-seen` flag.
- Settings new section "WARRIOR DATA" with three rows: BW (NumberRow, lb, integer 60-500), SEX (SexToggle, M/F), DOB (date input, optional).
- wger attribution: one line in CREDITS at `:514` matching existing typography. Text: `EXERCISE DATA — WGER (CC-BY-SA 4.0)`.

**Patterns to follow:**
- `components/attune/FirstTimeInstructionPopup.jsx` (lines 1-90) for blocking modal shape.
- `app/settings/page.js:42-63` `Toggle` for binary toggle component pattern.
- `app/settings/page.js:65-87` `VolumeSlider` for inline form-row layout.

**Test scenarios:**
- Happy path — profile created via onboarding flow saves BW + sex; subsequent reads via `pk()` return correct values.
- Happy path — Settings WARRIOR DATA section edits BW from 180 to 145; localStorage updates; reload shows new value.
- Edge case — DOB unset; R16 birthday holiday detection skips correctly (no holiday triggered on every day of year).
- Edge case — BW input rejects non-numeric, negative, zero, and > 500.
- Error path — modal gate fires when first BW-coefficient set is attempted with `pk('user-bodyweight')` unset; save is blocked until BW captured; modal cannot be dismissed without entering value.
- Error path — non-BW-coefficient exercise (e.g., barbell row) does NOT fire the modal even when BW is unset.
- Integration — wger attribution line renders inside settings credits with correct typography (matching existing `:499-515` styling).

**Verification:**
- All three keys persist across page navigation and PWA reload.
- Modal gate truly blocks save (no XP credited, no `pk('ex-...')` write) until BW captured.
- Settings page renders without layout regression.

---

- [ ] **Unit 2: Algo runtime module (`lib/exp/`)**

**Goal:** Build the shared XP runtime: IPF GL math, R10a region map, tier curves, holiday math, prestige math, set-XP orchestrator. Add `getExerciseById`. Replace 4 duplicate `repMult` definitions with imports.

**Requirements:** R1, R1a, R2, R5b, R5c, R9, R10a, R12, R12b, R12c, R13, R14, R16, R18a math.

**Dependencies:** None (parallel with Unit 1).

**Files:**
- Create: `lib/exp/ipfGL.js`
- Create: `lib/exp/regions.js`
- Create: `lib/exp/tier.js`
- Create: `lib/exp/holidays.js`
- Create: `lib/exp/prestige.js`
- Create: `lib/exp/setXP.js`
- Create: `lib/exp/index.js` (re-exports)
- Modify: `lib/exerciseLibrary.js` (add `getExerciseById(id)` via memoized Map; export it)
- Modify: `app/fitness/stats/page.js` (replace local `repMult` at `:42-46` and `MUSCLE_TO_REGION` at `:26-27` with imports from `lib/exp`)
- Modify: `app/fitness/active/page.js` (replace local `repMult` at `:2667-2671` with import)
- Modify: `app/fitness/active/[iso]/page.js` (replace local `repMult` at `:2828-2832` with import)
- Modify: `app/fitness/active/[iso]/[muscleId]/page.js` (replace local `repMult` at `:2638-2642` with import)
- Test: `__tests__/exp/ipfGL.test.js`
- Test: `__tests__/exp/regions.test.js`
- Test: `__tests__/exp/tier.test.js`
- Test: `__tests__/exp/holidays.test.js`
- Test: `__tests__/exp/prestige.test.js`
- Test: `__tests__/exp/setXP.test.js`
- Test: `__tests__/exerciseLibrary.test.js`

**Execution note:** Test-first. Every math function ships with a test vector before implementation. The brainstorm worked-math examples (Examples 1-4 in `dispatches/2026-05-03-...md`) are golden test cases.

**Approach:**
- `ipfGL(bw_kg, sex_params)` returns scalar; `bodyweightNormFactor(user_BW_lb, sex)` wraps and divides by REFERENCE_BW result.
- `regions.js` exports `MUSCLE_TO_REGION` (R10a dual-semantics map) and `regionWeights(exercise)` (60/40 primary/secondary split → 5-element array).
- `tier.js` exports `TIER_NAMES[21]`, `TIER_THRESHOLDS[21]` (cumulative sessions per R5b table), `TIER_MULTIPLIERS[21]` (per R5c geometric curve), `getTier(count)`, `getNextTierThreshold(count)`, `getTierMultiplier(count)`.
- `holidays.js` exports `getHolidayMultiplier(date, userDOB)` — returns one of 1.5/1.0/0.5/0 per R16 list. Federal holiday computations (last-Mon-May, 4th-Thu-Nov, 3rd-Mon-Jan, etc.) inline as small helpers.
- `prestige.js` exports `getPrestigeMultiplier(ribbonCount)` returning `0.10 × ribbonCount`.
- `setXP.js` exports `calculateSetXP({reps, weight}, exercise, user, runtimeState)` returning the snapshot shape from the data flow diagram. Pure function — no localStorage reads inside, all state passed in.

**Patterns to follow:**
- Existing `repMult` body (`app/fitness/stats/page.js:42-46`) lifts verbatim.
- `lib/storage.js:8-15` `pk()` exemplifies "tiny pure module" style — match it.
- `lib/exerciseAliases.js` already defines `IPF_GL_PARAMS`, `LB_TO_KG`, `STAR_FLOOR_FRACTION`, etc. Re-export from `lib/exp` for callers.

**Test scenarios:**
- Happy path (ipfGL) — at REFERENCE_BW (81.65 kg) male, `bodyweightNormFactor` returns 1.000 ± 0.001.
- Happy path (ipfGL) — at 100 lb (45.4 kg) male, returns ~1.299 (per spec table).
- Happy path (ipfGL) — at 300 lb (136 kg) male, returns ~0.853.
- Edge case (ipfGL) — at 0 kg returns finite value (no divide-by-zero); at 500 kg saturates gracefully.
- Happy path (regions) — bench press exercise → `regionWeights` returns `[0, 0.26, 0, 0.73, 0]` (CORE 0, ARMS 0.26, LEGS 0, FRONT 0.73, BACK 0). (Match brainstorm Example 1.)
- Happy path (regions) — squat → matches brainstorm Example 3b: FRONT 0.60 / BACK 0.16 / LEGS 0.16 / CORE 0.08 / ARMS 0.
- Happy path (regions) — deadlift → matches Example 3c: BACK 0.50 / LEGS 0.20 / FRONT 0.10 / ARMS 0.10 / CORE 0.10.
- Happy path (tier) — at count=0 → tier RELAXED, mult 1.00. At count=100 → tier GRITTED, mult 3.00. At count=12 → tier PRESSED, mult 1.32.
- Edge case (tier) — at count=99 → BLOODIED (still below 100); at count=120 → GRITTED + prestige unlocked.
- Happy path (holidays) — Dec 25 → 1.5; Jul 4 → 1.0; MLK Day (3rd Mon Jan) → 0.5.
- Happy path (holidays) — user DOB matches today → 1.5.
- Edge case (holidays) — birthday on Christmas → 1.5 (no stacking, single tier-1).
- Edge case (holidays) — Feb 29 leap-year birthday in non-leap-year → triggers on Feb 28? (Decision deferred to implementer; document chosen behavior in test.)
- Happy path (prestige) — 0 ribbons → 0; 5 ribbons → 0.50; 10 ribbons → 1.00.
- Integration (setXP) — bench 135 × 10 at 200 lb male, RELAXED, no holiday, no ribbons → snapshot matches brainstorm Example 1 totals (within float tolerance).
- Integration (setXP) — deadlift 315 × 5 at 200 lb male, HARDENED tier (×2.28), 5 ribbons (0.50), no holiday → matches Example 3 totals.
- Integration (setXP) — bench at 145 lb user, 225 × 5 → `earnsStars: true`, HEAVY LIFT bonus > 0 (relative_load 1.55 > 0.75 × threshold 1.5 = 1.125; combined_factor > 1).
- Integration (setXP) — bench at 200 lb user, 135 × 10 (warm-up) → `earnsStars: false` (relative load below floor); XP still computes; cinematic skips HEAVY LIFT line.
- Integration (getExerciseById) — known id returns entry; unknown id returns undefined; lookup is O(1) (Map-backed).

**Verification:**
- All four legacy `repMult` definitions are deleted; their files import from `lib/exp` and pass existing tests (smoke).
- `lib/exp` test suite passes with golden vectors from brainstorm worked examples.
- `getExerciseById` returns same object identity as `_ALL.find` would inside `lib/exerciseLibrary.js`.

---

- [ ] **Unit 3: Set-log persistence layer + computeTotalXP rewrite**

**Goal:** Wire the per-set XP snapshot store. Hook `saveReps`/`saveWeight` to write snapshots. Rewrite `computeTotalXP` and stats-page region aggregator to sum from snapshots (with fallback to legacy recompute for pre-existing data).

**Requirements:** R2, R3, R12, R12b, R12c, R13 (snapshot stores `regionStars`).

**Dependencies:** Unit 2 (uses `calculateSetXP`).

**Files:**
- Create: `lib/exp/setLog.js` (`appendSetLog`, `readSetLog`, `sumSetLog`, `readSetLogForDay`)
- Modify: `app/fitness/active/[iso]/[muscleId]/page.js` (extend `saveReps` at `:1525-1536` and `saveWeight` at `:1538-1549` to compute + append snapshot)
- Modify: `app/fitness/active/[iso]/[muscleId]/page.js` (rewrite `computeTotalXP` at `:2644-2677` to sum from setLog with legacy fallback)
- Modify: `app/fitness/active/page.js` (rewrite same-named clones at `:2680+`)
- Modify: `app/fitness/active/[iso]/page.js` (rewrite same-named clones at `:2840+`)
- Modify: `app/fitness/stats/page.js` (rewrite `loadStats`/`computeStats` at `:259-334` to sum region XP from setLog snapshots; legacy fallback path)
- Test: `__tests__/exp/setLog.test.js`
- Test: `__tests__/integration/set-save-credits-xp.test.js`

**Execution note:** Test-first for setLog primitives. The integration test (set save → readSetLog returns new snapshot → computeTotalXP includes it) is the load-bearing assertion.

**Approach:**
- Key shape: `pk('xpLog-{cycleId}-{iso}')` → `Array<Snapshot>` per day. One key per day keeps writes atomic and reads cheap (most queries are "today's snapshots" or "all snapshots since X").
- Snapshot is the shape from Decision 1 plus a `type: 'set' | 'consistency-credit'` discriminator (consistency credits land via Unit 5).
- Append is read-modify-write under `pk('xpLog-{cycleId}-{iso}')`. localStorage isn't transactional; for single-user single-tab PWA this is acceptable. Document the constraint.
- Legacy fallback: if `pk('xpLog-{cycleId}-{iso}')` is empty for a day BUT `pk('ex-{cycleId}-{iso}-*')` has data, fall through to the old recompute path. This lets pre-existing log data render without forced backfill. (Backfill could be a separate, optional unit.)

**Patterns to follow:**
- `lib/storage.js` `getItem`/`setItem` JSON-encoded helpers.
- `lib/attunement.js` `chipsForDay()` for "read-by-day" pattern.

**Test scenarios:**
- Happy path — save reps for a set; setLog day key gains one entry with computed snapshot.
- Happy path — save weight for the same set; setLog updates the same set's snapshot (idempotent) rather than appending duplicate. (Decide: replace by `setIdx` match? Final shape is implementation choice; test the chosen contract.)
- Happy path — `computeTotalXP` over a 3-day cycle with setLog entries returns sum of `snapshot.totalXP`.
- Edge case — empty setLog day with non-empty `ex-` data (legacy) — falls back to recompute and produces same result as before this unit.
- Edge case — corrupted setLog JSON in localStorage — read-helper returns `[]` and logs warning; doesn't crash app.
- Integration — save-set in active page → reload page → XP bar reflects new total (from setLog, not legacy recompute).
- Integration — region-star snapshot survives save → stats page reads `regionStars` correctly.

**Verification:**
- A logged set produces exactly one snapshot in `pk('xpLog-{cycleId}-{iso}')`.
- `computeTotalXP` agrees with prior behavior for legacy-only data (no setLog).
- Stats page region XP matches sum-of-snapshots when setLog populated.

---

- [ ] **Unit 4: Tier counter + ribbon persistence + prestige unlock UI**

**Goal:** Persist cumulative 100%-session count and ribbon count per profile. Expose helpers to read/tick/award. Add Ascend prompt UI for prestige unlock at counter ≥ 120.

**Requirements:** R5a (cumulative counter), R5b (pacing), R9 (prestige loop).

**Dependencies:** Unit 2 (uses `lib/exp/tier.js` and `lib/exp/prestige.js`).

**Files:**
- Create: `lib/exp/tierStore.js` (`getTierCount()`, `getRibbonCount()`, `tickTier()`, `awardRibbon()`, `resetTierForAscend()`)
- Create: `components/exp/AscendPrompt.jsx` (modal/sheet shown when `tierCount >= 120` and prestige unlock is offered)
- Modify: `app/fitness/active/[iso]/page.js` (`handleStamp` at `:2070` — see Unit 5 — invokes `tickTier()` on 100% completion; if new count crosses 120 after tick, show Ascend prompt or set a `pk('prestige-unlocked')` flag for next session)
- Test: `__tests__/exp/tierStore.test.js`
- Test: `__tests__/integration/ascend-flow.test.js`

**Approach:**
- `pk('tier-count')` → number, default 0. `pk('ribbon-count')` → number, default 0. `pk('prestige-unlocked')` → boolean, surfaces the Ascend choice.
- `tickTier()` reads, +1, writes. Returns new count. If new count is 120 AND `prestige-unlocked` is false → set flag.
- `awardRibbon()`: `ribbon-count += 1`, `tier-count = 0`, `prestige-unlocked = false`. Returns new ribbon count.
- AscendPrompt is mounted on `/fitness/profile` and surfaced from any active-page after the unlock flag is set. Two CTAs: "ASCEND" (calls awardRibbon) or "HOLD" (dismisses; flag remains set so the choice is available indefinitely).

**Patterns to follow:**
- `lib/storage.js` `pk()` helpers.
- `components/attune/FirstTimeInstructionPopup.jsx` for modal shape.

**Test scenarios:**
- Happy path — `tickTier` from 0 → 1; `getTierCount` returns 1.
- Happy path — at count=100, `getTier` returns 'GRITTED'.
- Happy path — at count=120 after tick, `prestige-unlocked` flag becomes true.
- Happy path — `awardRibbon` resets count to 0, increments ribbons, clears flag.
- Edge case — `awardRibbon` called without prior unlock — should it block? (Decision: block; document.)
- Integration — full flow from count=119 → tickTier (→120, unlock) → ascendPrompt mounted → user taps ASCEND → ribbon=1, count=0, flag false.

**Verification:**
- All three keys persist correctly per profile (separate `default` profile from a created one).
- AscendPrompt renders only when flag is set.

---

- [ ] **Unit 5: End-of-day reckoning hook in handleStamp**

**Goal:** Compute completion% on stamp; apply consistency contribution to today's setLog; call `tickTier()` if 100%; handle <50% fizzle and 50-99% partial credit per R8.

**Requirements:** R8, R8a.

**Dependencies:** Units 2, 3, 4.

**Files:**
- Modify: `app/fitness/active/[iso]/page.js` (`handleStamp` at `:2070` — extend to compute and apply consistency credit)
- Modify: `app/fitness/active/[iso]/[muscleId]/page.js` (the secondary `handleStamp` at `:1981`)
- Modify: `app/fitness/active/page.js` (the tertiary stamp site at `:1991+`)
- Create: `lib/exp/dailyReckoning.js` (pure function `computeDailyReckoning(cycleId, iso)` returning `{completion_pct, consistency_credit, shouldTick}`)
- Test: `__tests__/exp/dailyReckoning.test.js`
- Test: `__tests__/integration/stamp-credits-consistency.test.js`

**Execution note:** Characterization-first. Before adding new behavior to `handleStamp`, capture the existing behavior with a test (it currently writes the done flag and bumps a counter — preserve that). Only then layer the reckoning in.

**Approach:**
- `computeDailyReckoning` reads `cycle.dailyPlan[iso]`, sums `chipsForDay × setcounts[exerciseName]` for `sets_planned`, reads non-zero entries from `pk('ex-{cycleId}-{iso}-*')` for `sets_logged`. Computes `completion_pct = sets_logged / sets_planned`.
- If `completion_pct < 0.5`: consistency_credit = 0 (combo fizzle). No tick.
- If `0.5 <= completion_pct < 1.0`: consistency_credit = `sumTodayBaseXP × tierMult × completion_pct`. No tick.
- If `completion_pct == 1.0`: consistency_credit = `sumTodayBaseXP × tierMult`. Tick tier.
- Append `{type: 'consistency-credit', ts, value: consistency_credit}` to today's setLog. computeTotalXP picks it up automatically.

**Patterns to follow:**
- Existing `handleStamp` at `app/fitness/active/[iso]/page.js:2070` (the canonical site).
- `lib/attunement.js:123` `chipsForDay` for chip lookup.

**Test scenarios:**
- Happy path — 100% completion stamps day, ticks tier, appends full consistency credit to setLog.
- Happy path — 75% completion stamps day, appends 0.75× consistency credit, no tier tick.
- Happy path — 30% completion stamps day, appends 0× credit, no tier tick.
- Edge case — `sets_planned == 0` for a day (no chips attuned) — completion_pct undefined; treat as 0 credit, no tick. Test the chosen contract.
- Edge case — stamping a day already stamped — idempotent: should not double-credit. Test the dedup behavior.
- Integration — three days at 100%, one at 75%, one at 30% → setLog.consistency totals match formula.

**Verification:**
- `pk('done-{cycleId}-{iso}')` flag still writes correctly (pre-existing behavior preserved).
- New `consistency-credit` setLog entries appear for each stamped day.
- Tier counter increments only on 100%-completion stamps.

---

- [ ] **Unit 6: Per-set XP cinematic component (R18 + R18a)**

**Goal:** Sequential ~1.2-1.5s reveal of the multiplier stack on every set save. Inactive multipliers skip-render. Terminal phase reuses xp-fly to bubble total to the bar.

**Requirements:** R18, R18a, R17 (no constant nav display — implies cinematic is moment-bound).

**Dependencies:** Units 2, 3, 4 (calculateSetXP must produce snapshots; Unit 4 supplies tier/ribbon multipliers).

**Files:**
- Create: `components/exp/SetXPCinematic.jsx`
- Modify: `app/fitness/active/[iso]/[muscleId]/page.js` (mount cinematic after `saveReps`/`saveWeight`; manage open/close state; coordinate with `setInAnimation` predictive-tap chain)
- Modify: `app/fitness/active/page.js` (consider deleting orphaned `triggerXPAnimation` at `:3028-3104` — separate decision; flag in plan)
- Test: `__tests__/components/SetXPCinematic.test.js`
- Test: `__tests__/integration/cinematic-flow.test.js`

**Approach:**
- Component receives `snapshot` prop (the calculated set XP snapshot). Internal phase machine: `idle → base → heavyLift? → consistency → class → prestige → total → fly → done`. Each phase has a duration; total cinematic ~1.2-1.5s.
- Skip-render for inactive lines: `heavyLift` only if `snapshot.heavyLiftBonus > 0`; `prestige` only if `snapshot.prestigeMult > 0`; `holiday` only if `snapshot.holidayMult > 0`.
- Position fixed, full-screen overlay, dimmed backdrop, vertical line stack centered. Lines materialize one-by-one (fade-in or type-in — pick one; document choice).
- Terminal phase: the running total animates as a particle/number flying to the cycle-overview XP bar (reuse `xp-fly` keyframe at `app/fitness/active/page.js:3410-3414`).
- iOS PWA respect: `position:fixed`, `setInAnimation('cinematic', true)` on mount + false on dismiss, 150ms leaked-click grace from existing `mountTimeRef` pattern, `zIndex: 9995` (below level-up at 10000, above XP overlay at 9999 — sandwich position).

**Patterns to follow:**
- `app/fitness/active/page.js:3486-3640` level-up sub-cascade — phase machine + multi-keyframe; the sibling-component reference shape.
- `components/HeistTransition.jsx` for full-screen sequential reveal aesthetic precedent.
- `app/fitness/active/page.js:2754` `setInAnimation` for predictive-tap coordination.

**Test scenarios:**
- Happy path — full-stack snapshot (all multipliers active) renders all 6 lines in sequence, ends in fly phase.
- Happy path — RELAXED tier + 0 ribbons + non-holiday day — cinematic shows base + class + total only (skips consistency, prestige, holiday).
- Happy path — sub-floor set (warm-up) — no HEAVY LIFT line.
- Edge case — set save during cinematic — second cinematic queues OR replaces (decide and test the chosen behavior; recommend: replace, latest wins).
- Edge case — user navigates away mid-cinematic — cleanup runs, no zombie state, `setInAnimation` cleared.
- Integration — save reps → cinematic mounts → onComplete → XP bar repaints with new total (Unit 3's setLog read).
- Integration (iOS PWA) — first 150ms taps don't dismiss prematurely; predictive-tap chain to next set's button works after cinematic completes.

**Verification:**
- Cinematic visible for ~1.2-1.5s on a full-stack set.
- Bar updates after cinematic finishes.
- No taps eaten or dropped during the predictive-tap chain.

---

- [ ] **Unit 7: Region star track (data accumulation + transmutation circle render)**

**Goal:** Persist per-region star counts. Render discrete star pips on the transmutation circle. Animate accumulated stars on stats-page mount (silent accumulate per Decision 5).

**Requirements:** R10, R10a, R11 (advisory), R12, R12b, R12c, R13, R14, R19.

**Dependencies:** Units 2, 3 (snapshot includes `regionStars`).

**Files:**
- Create: `lib/exp/regionStarStore.js` (`getRegionStars()`, `addRegionStars(starsArray)`)
- Modify: `app/fitness/active/[iso]/[muscleId]/page.js` (call `addRegionStars(snapshot.regionStars)` after `appendSetLog`)
- Modify: `app/fitness/stats/page.js` (extend `BodyStarChart` at `:546-589` to render a new `<RegionStarPips>` overlay sourced from `pk('region-stars')`; animate new-since-last-mount stars)
- Create: `components/stats/RegionStarPips.jsx`
- Test: `__tests__/exp/regionStarStore.test.js`
- Test: `__tests__/integration/star-accumulation.test.js`

**Approach:**
- `pk('region-stars')` → `number[5]`, indices match `BODY_REGIONS` order. Default `[0,0,0,0,0]`.
- `addRegionStars(starsToAdd)` adds elementwise.
- Render: pips are small ★ glyphs anchored at each region's position relative to the badge mounting (`badgeCSS(i)` at `stats/page.js:409-426`). Each pip cluster shows up to N stars (N is large; use a count + ★ format if > 5 to avoid clutter — e.g., `★ × 47` for 47 stars in one region).
- Animation on stats-mount: track `pk('region-stars-last-seen')`; new stars (current - last_seen) animate in (scale + glow). On unmount or after animation, write current to last-seen.

**Patterns to follow:**
- `app/fitness/stats/page.js:428-448` `RegionBadge` for absolute positioning per region.
- `app/fitness/active/page.js:3415-3431` `xp-bar-pulse` / `xp-bar-wobble` for pop animation precedent.

**Test scenarios:**
- Happy path — log a King Compound (squat) at 200 lb / 225 × 8 — `pk('region-stars')` increments FRONT, BACK, LEGS by 1 each.
- Happy path — log an isolation (bicep curl) at 145 × 8 — ARMS gains 2.
- Happy path — sub-floor set (light warm-up) — no region stars added.
- Edge case — user disables region stars (future setting) — addRegionStars is a no-op. (Defer to plan: not in scope; document only if added.)
- Integration — after 5 sessions across various lifts, stats-page mount renders accumulated pips + animates only the unseen delta.

**Verification:**
- Pip counts match expected per spec audit table (brainstorm "Compound = 2×1 stars, Isolation = 1×2 stars Rule Audit" section).
- Animation runs once per stats mount; subsequent re-renders don't re-animate.

---

- [ ] **Unit 8: Profile route + identity tag + ribbon row + stats page tier extensions**

**Goal:** Build new `/fitness/profile` route with tier identity tag and Galaxy-Spiral ribbon row (R20). Add hub link. Extend stats page with progress bar to next tier + cumulative count + ribbon history (R20a). R7 tier-up flourish.

**Requirements:** R7, R20, R20a.

**Dependencies:** Units 2, 4 (tier/ribbon helpers + tier names/colors).

**Files:**
- Create: `app/fitness/profile/page.js`
- Create: `components/profile/TierTag.jsx` (kanji + tier name + R7 color treatment)
- Create: `components/profile/RibbonRow.jsx` (Galaxy-Spiral icons; earned fill left-to-right; unearned hidden until first earned)
- Modify: `app/fitness/hub/page.js` (add `WARRIOR PROFILE` `GhostOption` at `:574-582`-style block linking to `/fitness/profile`)
- Modify: `app/fitness/stats/page.js` (add tier progress bar + cumulative count + ribbon history block, anchored near existing transmutation chart at `:546-589`)
- Create: `components/exp/TierUpFlourish.jsx` (R7 — kanji + color + animation on tier crossings)
- Modify: `app/fitness/active/[iso]/page.js` (`handleStamp` after `tickTier()` — if new count crosses a tier threshold, mount `TierUpFlourish`)
- Test: `__tests__/components/TierTag.test.js`
- Test: `__tests__/components/RibbonRow.test.js`
- Test: `__tests__/integration/profile-page-render.test.js`

**Approach:**
- New profile page mirrors `app/fitness/stats/page.js` shell pattern (kanji watermark + RetreatButton + `useProfileGuard()` + headline). Headline = `{activeProfile}`. Below headline: TierTag + RibbonRow.
- TierTag styling defaults to `RegionBadge` parallelogram aesthetic; final styling deferred to King at unit-time.
- Tier-up flourish on cross — read previous tier-name from `pk('last-seen-tier')`, compare to current `getTier(count)`, if different mount `TierUpFlourish` and update `last-seen-tier`. Reuses existing level-up cascade pattern (`active/page.js:3486-3640`) as a sibling component, not extension.
- Stats page extension is additive — a new section below the BodyStarChart with tier progress bar, "X/Y sessions to NEXT_TIER" text, cumulative count, and ribbon row.

**Patterns to follow:**
- `app/fitness/stats/page.js:629-668` for page shell.
- `app/fitness/hub/page.js:574-582` `GhostOption` for hub entry.
- `app/fitness/active/page.js:3498-3537` level-up keyframes for flourish reference.

**Test scenarios:**
- Happy path — fresh profile (count=0) renders TierTag with 'RELAXED' + ×1.00 mult. RibbonRow hidden (no ribbons earned).
- Happy path — count=12 → tier shows 'PRESSED'. Stats page progress bar shows '0/3 sessions to SQUEEZED' (12 + 3 = 15 rounded to threshold 16 — verify exact text against R5b table).
- Happy path — 3 ribbons earned → RibbonRow shows 3 filled spirals.
- Edge case — count=99 on stats page → progress bar shows '9/10 to GRITTED'.
- Edge case — count=120 → AscendPrompt mounted (Unit 4); profile page indicates eligibility.
- Integration — stamping a day that ticks count from 6 → 7 (BRANDISHED → PRIMED transition at threshold 9? verify actual tier threshold — wait, count=7 lands inside BRANDISHED [4-5], so no flourish; pick a real threshold for the test, e.g., 8→9 PRIMED) — TierUpFlourish mounts, runs, dismisses.
- Integration — hub → tap WARRIOR PROFILE → profile page renders with tier + ribbons.

**Verification:**
- Profile route reachable from hub.
- TierTag and RibbonRow render correctly across every tier value.
- Stats page progress bar math matches R5b table.
- TierUpFlourish fires exactly once per tier crossing (idempotent on re-mount).

## System-Wide Impact

- **Interaction graph:**
  - `saveReps` / `saveWeight` (`[muscleId]/page.js`) → `appendSetLog` → mounts `SetXPCinematic` → on dismiss, bar repaints
  - `handleStamp` (`active/[iso]/page.js`) → `computeDailyReckoning` → `appendSetLog (consistency-credit)` → `tickTier` if 100% → potentially `TierUpFlourish` mount
  - First-time onboarding (`fitness/page.js`) → BodyweightStep → profile fields persist
  - First BW-coefficient set without BW set (`[muscleId]/page.js`) → BodyweightModal mount → save gated
  - Stats page mount → reads setLog summed by region → renders RegionStarPips + progress bar
  - Profile page mount → reads tier-count + ribbon-count → renders TierTag + RibbonRow

- **Error propagation:** Snapshot computation is pure; if it throws (NaN, missing field on exercise, etc.), set save still writes raw reps/weight (so user data isn't lost). Snapshot append is best-effort — a try/catch around `appendSetLog` logs to console and swallows. The cinematic skips if snapshot is invalid. Stats page falls through to legacy recompute.

- **State lifecycle risks:**
  - Concurrent set saves: localStorage isn't transactional. Two rapid taps could race on the same `pk('xpLog-...')` key (read-modify-write). For single-tab single-user PWA acceptable; documented constraint.
  - Tier counter race on stamp: `tickTier` is read-modify-write. Re-tap of stamp button is the only realistic race; idempotency via the existing `done-{cycleId}-{iso}` flag (already-stamped → no re-tick) covers it.
  - PWA cache + setLog dual-source-of-truth: legacy `pk('ex-...')` and new `pk('xpLog-...')` can drift if a stale tab writes only one. Single-tab use mitigates; document the constraint.

- **API surface parity:** Internal only — no external API changes. The shared `lib/exp/index.js` becomes the canonical XP runtime; future routes that compute XP must import from it.

- **Integration coverage:** End-to-end test scenarios in Units 3, 5, 6, 7, 8 cover the key cross-layer flows (set save → snapshot → cinematic → bar repaint, stamp → consistency credit → tier tick → tier-up flourish).

- **Unchanged invariants:**
  - `repMult(reps)` body — moved, not modified. Test smoke-checks against existing values.
  - `15000 + level × 1000` total XP threshold — unchanged.
  - Region IDs (CORE/ARMS/LEGS/FRONT/BACK) — unchanged in identity; only the muscle→region map shifts.
  - Existing `pk('ex-...')` and `pk('wt-...')` keys remain authoritative for reps/weight UI.
  - `useProfileGuard()` semantics unchanged for non-BW-coefficient routes; only set save inside `[muscleId]/page.js` adds a BW gate.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 4-way `repMult` consolidation breaks one of the active routes (different prior behavior in some clone) | Unit 2's smoke tests run the new shared `repMult` against legacy vector inputs. If any clone diverged, surface in test. |
| setLog dual-source-of-truth drift from raw reps/weight | Strict ordering inside save handlers: snapshot is computed and appended **after** raw write. Stats fallback path covers any divergence. Backfill script can be added in a follow-up if needed. |
| iOS PWA: cinematic eats the predictive-tap chain to next set's button | `setInAnimation('cinematic', true/false)` on phase boundaries — coordinated with existing chain. Tested in Unit 6 integration. |
| Tier-up flourish fires twice on remount during a tier crossing | `pk('last-seen-tier')` write happens AFTER the flourish completes. Idempotent on remount. |
| BW modal blocks user who legitimately doesn't have a scale handy | Modal accepts an estimate; sex+BW are estimates anyway. Settings page allows update later. Document in onboarding copy. |
| Holiday-detection differs across timezones (server vs local) | Local-machine `new Date()`. Documented as scope decision. Date math in `lib/exp/holidays.js` uses local-date getters explicitly. |
| Region star animation re-fires on every stats mount | `pk('region-stars-last-seen')` snapshot pattern compares before/after; only the delta animates. |
| Snapshot computation drift between worker tabs writing concurrently | Acknowledged as accepted risk for single-user PWA; documented. Multi-tab scenarios are out of scope. |

## Documentation / Operational Notes

- The brainstorm doc (`dispatches/2026-05-03-...md`) and the King handoff (`dispatches/KING_HANDOFF_combo_exp.md`) are the source-of-truth for product/algo decisions; they remain canonical until the feature ships, then per the handoff get deleted.
- Worker dispatches will land per the parcel map below. Each worker pulls dev, executes one unit, commits + pushes to `origin/dev` per `feedback_gtl_worker_dev_push.md`.
- Per the handoff §4 rule, equipment must remain `{machine, cable, dumbbell, barbell, bodyweight}`; if a worker proposes adding a new equipment value, kick back.
- Per handoff §1, no relitigation of locked R-rules without explicit Jordan approval.

## Worker Dispatch Map

Ownership is split by **R-rule** rather than Unit number. This keeps each worker in a coherent lane: gtl1 owns the algo + persistence; gtl2 owns side concerns (wger + holidays); gtl3 owns ALL UI components. R7 `<TierUpFlourish>` and R9 `<AscendPrompt>` are UI components that fall in gtl1's R-rule range numerically, but they're moved to gtl3 because they consume gtl1's tier-store data without containing algo logic — keeping all UI in one worker's lane.

### Per-worker ownership

**gtl1 — R1-R14 algo, persistence, save-flow wiring (minus R7 + R9 UI components)**

Owns the math runtime, the persistence layer, the tier/ribbon store, the region star resolver, and all save-flow + handleStamp wiring. Writes data; gtl3 reads it.

| Source | Files / Responsibility |
|---|---|
| R1a inputs | `pk('user-bodyweight')`, `pk('user-sex')`, `pk('user-dob')`. Settings WARRIOR DATA form rows. Onboarding BW step. BW modal gate at first BW-coefficient set. |
| R1, R1a math | `lib/exp/ipfGL.js`, `lib/exp/setXP.js` (orchestrator), import-rewire of 4 duplicate `repMult` defs |
| R2, R3 | `lib/exp/setLog.js`, extend `saveReps` / `saveWeight` to append snapshots, rewrite `computeTotalXP` (3 sites) + stats `loadStats` to sum from setLog |
| R5, R5a, R5b, R5c, R6 | `lib/exp/tier.js` (curves), `lib/exp/tierStore.js` (counter persistence) |
| R8, R8a | `lib/exp/dailyReckoning.js`, extend `handleStamp` to compute completion%, tick tier on 100%, append consistency credit |
| R9 (data only) | `lib/exp/prestige.js`, ribbon persistence in `lib/exp/tierStore.js`, write `pk('prestige-unlocked')` flag when count crosses 120 |
| R10, R10a | `lib/exp/regions.js` — dual-semantics MUSCLE_TO_REGION + 60/40 region weights |
| R11, R12, R12b, R12c, R13, R14 | Region star resolver in `lib/exp/regions.js` (or new `lib/exp/stars.js`), `lib/exp/regionStarStore.js`, write to `pk('region-stars')` from save handler |
| R7 (data trigger only) | Detect tier crossings inside `handleStamp` after `tickTier`; write `pk('tier-cross-pending')` flag with the new tier name. **Component itself = gtl3.** |
| utility | `getExerciseById` helper in `lib/exerciseLibrary.js` |

**gtl2 — R15, R16**

| Source | Files / Responsibility |
|---|---|
| R15 | One attribution line in `app/settings/page.js` CREDITS block (`:499-515`): `EXERCISE DATA — WGER (CC-BY-SA 4.0)` |
| R16 | `lib/exp/holidays.js` — `getHolidayMultiplier(date, userDOB)` returning 1.5/1.0/0.5/0 per R16 list. US federal-holiday math + birthday detection. |

**gtl3 — R17-R20a + R7 `<TierUpFlourish>` + R9 `<AscendPrompt>` (all UI components)**

Owns every component, every animation, every new route. Reads from gtl1's stores; never writes algo state.

| Source | Files / Responsibility |
|---|---|
| R7 | `components/exp/TierUpFlourish.jsx`. Polls `pk('tier-cross-pending')`; on detection, mounts the flourish, then clears the flag. |
| R9 (UI only) | `components/exp/AscendPrompt.jsx`. Mounts when `pk('prestige-unlocked')` is true, on profile page and active routes. Two CTAs: ASCEND (calls gtl1's `awardRibbon()`) or HOLD. |
| R17 | Verification pass — confirm no constant multiplier display creeps into the active-page nav anywhere. |
| R18, R18a | `components/exp/SetXPCinematic.jsx`. Sequential 1.2-1.5s reveal of snapshot stack. HEAVY LIFT line conditional. Terminal xp-fly to bar. iOS PWA: `setInAnimation`, mountTimeRef grace, fixed positioning, zIndex 9995. |
| R19 | `components/stats/RegionStarPips.jsx` — overlay inside `BodyStarChart` reading `pk('region-stars')`, animating delta-since-last-stats-mount. |
| R20 | New route `app/fitness/profile/page.js`. Hub link addition. `components/profile/TierTag.jsx`, `components/profile/RibbonRow.jsx`. |
| R20a | Stats page extension: progress bar to next tier, cumulative 100%-session count, ribbon history block. |

### Wave structure

| Wave | gtl1 | gtl2 | gtl3 |
|---|---|---|---|
| 1 | All R1-R14 work (data side). Internally batched into sub-commits: math runtime → setLog/computeXP rewrite → tier store → region resolver → reckoning + tier-cross flag. | R15 + R16 (holidays + attribution). Single dispatch. | **Standby.** Cannot start until gtl1's runtime + tier store + setLog + region star store + tier-cross flag all land. |
| 2 | (done) | (done) | All R17-R20a + R7 flourish + R9 AscendPrompt UI. Internally batched: cinematic → region star pips → profile route + identity tag + ribbon row → stats page extension → tier-up flourish + AscendPrompt. |

Wave 2 dispatches only after King pulls dev, confirms gtl1's expected stores/flags exist (`lib/exp/setLog.js`, `pk('tier-count')`, `pk('ribbon-count')`, `pk('prestige-unlocked')`, `pk('tier-cross-pending')`, `pk('region-stars')`), and all of gtl1's commits land cleanly.

### No-Discretion Protocol (applies to all three workers)

When you hit any judgment call — UI styling, animation timing curve, copy text, file or storage-key naming, validation rules, threshold values not specified in the brainstorm, structural decisions about new components, OR any rule interpretation that's not literally in the locked spec — **STOP. Do not guess. Do not proceed with a "reasonable default."**

Instead:

1. Write the question to `dispatches/blockers/<worker>_<short_topic>.md` with this shape:
   ```
   # Blocker: <one-line topic>

   **Worker:** gtl1 / gtl2 / gtl3
   **Affects:** R-rule(s) and/or unit
   **Question:** [the specific question]
   **Candidate answers:** [2-3 concrete options with brief tradeoff notes]
   **Recommendation:** [your best guess + why]
   **What's blocked:** [what you cannot proceed with until answered]
   ```
2. Commit the blocker file: `git commit -m "Blocker: <topic> (<worker>)"`
3. Push to `origin/dev`.
4. **Pause execution.** Do not proceed past the question.

King polls `dispatches/blockers/`, surfaces the question to Jordan, commits the answer back to the same blocker file (under a `## Resolution` section), and re-dispatches the worker. Workers resume from where they paused.

Things that count as "discretion" requiring a blocker:
- Picking a localStorage key name not specified
- Choosing animation duration / easing curve
- Choosing which form-input variant (number vs text vs picker) for a new field
- Deciding what copy goes on a button or modal headline
- Picking a color, kanji, or visual treatment
- Deciding whether to include or omit a feature edge case the spec didn't cover
- Choosing test scenario boundaries
- Deciding component structure (single component vs split)

Things that DON'T require a blocker:
- Following an existing repo pattern verbatim (same file structure, same prop shape, same styling vocabulary as a sibling component already in the codebase)
- Implementing math the spec specifies precisely (e.g., the IPF GL formula)
- Reading a value from a store the spec specifies the key for

## Sources & References

- **Origin document:** `dispatches/2026-05-03-gtl-combo-exp-multiplier-requirements.md` (brainstorm, locked 2026-05-06)
- **Handoff context:** `dispatches/KING_HANDOFF_combo_exp.md`
- **Research findings (delete after feature ships):**
  - `dispatches/research/01_runtime_storage_findings.md` (gtl1)
  - `dispatches/research/02_ui_surfaces_findings.md` (gtl2)
  - `dispatches/research/03_integration_findings.md` (gtl3)
- **Related code anchors:** see "Relevant Code and Patterns" section above.
- **Curation source-of-truth:** `lib/exerciseAliases.js` (`MUSCLE_FIXUP`, `KING_COMPOUNDS`, `ISOLATION_OVERRIDE`, `BW_COEFFICIENT`, `HEAVY_LIFT_THRESHOLDS`, `HEAVY_LIFT_CLASS_SCALES`, `STAR_FLOOR_FRACTION`, `IPF_GL_PARAMS`, `REFERENCE_BW`).
