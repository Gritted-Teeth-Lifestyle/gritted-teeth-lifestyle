# Wave 1 dispatch — gtl1 — R1-R14 algo + persistence + save-flow

You own **R1-R14 minus the UI components** (TierUpFlourish + AscendPrompt are gtl3's). All algo, all persistence, all save-flow + handleStamp wiring. You write data and flags; gtl3 reads them.

## Read first (in order)

1. `docs/plans/2026-05-08-001-feat-combo-exp-multiplier-plan.md` — the active plan, especially the **Worker Dispatch Map** section's gtl1 row (the canonical scope) and the **No-Discretion Protocol** at the end.
2. `dispatches/2026-05-03-gtl-combo-exp-multiplier-requirements.md` — the locked brainstorm. R-rules are the source of truth.
3. `dispatches/KING_HANDOFF_combo_exp.md` — handoff context, especially "Rules to follow" §1-10.
4. `dispatches/research/01_runtime_storage_findings.md` — your prior research; current code anchors.
5. `dispatches/research/02_ui_surfaces_findings.md` — gtl2's research; useful for snapshot consumer shape.
6. `dispatches/research/03_integration_findings.md` — gtl3's research; useful for library access patterns.

## Scope (R-rules you own)

Per the plan's gtl1 ownership table, with explicit deliverables:

| R | Deliverable |
|---|---|
| R1, R1a math | `lib/exp/ipfGL.js` (`ipfGL(bw_kg, params)`, `bodyweightNormFactor(user_BW_lb, sex)`). Re-export `IPF_GL_PARAMS`, `REFERENCE_BW`, `LB_TO_KG` from `lib/exerciseAliases.js`. |
| R1a inputs | Profile schema fields: `pk('user-bodyweight')` (number, lb), `pk('user-sex')` (`'m'` or `'f'`, default `'m'`), `pk('user-dob')` (ISO date string, optional). Settings WARRIOR DATA section between HAPTICS (`app/settings/page.js:452`) and DEFAULTS (`:455`) — three input rows. Onboarding BW step inside `app/fitness/page.js handleSubmit` `isNew` branch (`:312-316`). BW modal gate mounted at `app/fitness/active/[iso]/[muscleId]/page.js` that fires when `pk('user-bodyweight')` is unset AND the exercise has `bw_coefficient`. |
| R1, R2, R3 orchestrator | `lib/exp/setXP.js` — `calculateSetXP({reps, weight}, exercise, user, runtimeState)` returning the snapshot shape from the plan's High-Level Technical Design diagram. Pure function — no localStorage reads inside; all state passed in. |
| R10, R10a | `lib/exp/regions.js` — exports `MUSCLE_TO_REGION` (R10a dual-semantics map) + `regionWeights(exercise)` returning `[CORE, ARMS, LEGS, FRONT, BACK]` from 60/40 primary/secondary split. |
| R5b, R5c, R6 | `lib/exp/tier.js` — `TIER_NAMES[21]`, `TIER_THRESHOLDS[21]` (cumulative count per R5b table), `TIER_MULTIPLIERS[21]` (R5c geometric ×1.00→×3.00), `getTier(count)`, `getNextTierThreshold(count)`, `getTierMultiplier(count)`. |
| R5a, R9 (data) | `lib/exp/tierStore.js` — `getTierCount()`, `getRibbonCount()`, `tickTier()`, `awardRibbon()`, `resetTierForAscend()`. Sets `pk('prestige-unlocked')` flag when count crosses 120. |
| R9 math | `lib/exp/prestige.js` — `getPrestigeMultiplier(ribbonCount)` returning `0.10 × ribbonCount`. |
| R11, R12, R12b, R12c, R13, R14 | Region star resolver — module location at your discretion (suggest `lib/exp/stars.js`). Reads `regionWeights` + `is_king_compound` + `is_isolation_override` + `heavy_lift_threshold` to produce `regionStars: [c, a, l, f, b]` per set. R12c star-floor gate (`relative_load >= 0.75 × heavy_lift_threshold`). Uses `STAR_FLOOR_FRACTION` from `lib/exerciseAliases.js`. |
| Region star data | `lib/exp/regionStarStore.js` — `getRegionStars()`, `addRegionStars(stars[5])`. Persists to `pk('region-stars')`. |
| R2, R3 persistence | `lib/exp/setLog.js` — `appendSetLog(snapshot)`, `readSetLog(cycleId, iso)`, `sumSetLog(...)`, `readSetLogForDay(...)`. Per-day key shape: `pk('xpLog-{cycleId}-{iso}')` → `Snapshot[]`. |
| R2, R3 wiring | Extend `saveReps` and `saveWeight` at `app/fitness/active/[iso]/[muscleId]/page.js:1525-1549` to compute snapshot via `calculateSetXP`, append to setLog, call `addRegionStars(snapshot.regionStars)`. **Keep existing `pk('ex-...')` and `pk('wt-...')` writes — these remain authoritative for reps/weight UI.** |
| R2 read-side | Rewrite `computeTotalXP` at `app/fitness/active/[iso]/[muscleId]/page.js:2644-2677` (and the two clones at `app/fitness/active/page.js` and `app/fitness/active/[iso]/page.js`) to sum from setLog with legacy fallback (if setLog empty for a day but `pk('ex-...')` has data, fall through to old recompute path). |
| R2 stats-side | Rewrite the `loadStats`/`computeStats` region aggregator at `app/fitness/stats/page.js:259-334` similarly. |
| R8, R8a | `lib/exp/dailyReckoning.js` — `computeDailyReckoning(cycleId, iso)` returning `{completion_pct, consistency_credit, shouldTick}`. Extend `handleStamp` (canonical site `app/fitness/active/[iso]/page.js:2070`, plus the two other stamp sites at `[muscleId]/page.js:1981` and `active/page.js:1991+`) to compute completion%, append `{type: 'consistency-credit', ts, value: consistency_credit}` to setLog, call `tickTier()` on 100%. |
| R7 (trigger only) | After `tickTier()`, detect tier crossing (compare new tier name to `pk('last-seen-tier')`); if different, write `pk('tier-cross-pending')` with the new tier name. **Do not build TierUpFlourish.jsx — that's gtl3's.** |
| `lib/exp/index.js` | Re-export everything from the lib/exp/ modules so consumers do `import { calculateSetXP, getTier, ... } from 'lib/exp'`. |
| utility | Add `getExerciseById(id)` to `lib/exerciseLibrary.js` (memoized Map over `ALL_EXERCISES`). Export it. |
| de-duplication | Replace the 4 duplicate `repMult` defs at `app/fitness/stats/page.js:42-46`, `app/fitness/active/page.js:2667-2671`, `app/fitness/active/[iso]/page.js:2828-2832`, `app/fitness/active/[iso]/[muscleId]/page.js:2638-2642` with `import { repMult } from 'lib/exp'`. Same body — verbatim move. |
| de-duplication | Replace local `MUSCLE_TO_REGION` + `BODY_REGIONS` at `app/fitness/stats/page.js:17-27` with imports from `lib/exp/regions.js`. |

## Internal sequencing (suggested, you may reorder if it lands cleaner)

1. **Foundation commit** — `lib/exp/{ipfGL, regions, tier, prestige, setXP, index}.js` + tests + `getExerciseById`. Replace 4 `repMult` duplicates and the region map. Smoke-test that the existing app still loads + computes XP exactly as before. Commit.
2. **Profile schema commit** — Add 3 pk() keys, Settings WARRIOR DATA section, onboarding BW step, BW modal gate. Tests. Commit.
3. **setLog commit** — `lib/exp/setLog.js`, extend `saveReps`/`saveWeight`, rewrite `computeTotalXP` (3 sites) + stats `loadStats` with legacy fallback. Tests. Commit.
4. **Tier + ribbon store commit** — `lib/exp/tierStore.js` + tests. Commit.
5. **Region star track commit** — Region resolver + `lib/exp/regionStarStore.js`, wire into save handler. Tests. Commit.
6. **Reckoning + tier-cross flag commit** — `lib/exp/dailyReckoning.js`, extend `handleStamp` (3 sites), write `pk('tier-cross-pending')` on tier change. Tests. Commit.

Six commits total. Every commit must:
- Pass linting + type checks.
- Pass smoke tests (existing app still mounts, no regression on the existing XP flow).
- Push to `origin/dev` so wave gating signals progress.

## Test scenarios (per the plan)

The plan's Implementation Units 1-5, 7 each list specific test scenarios. Implement those tests as you go — test-first where the plan calls for it (Unit 2's algo math, Unit 5's reckoning).

**Golden vectors (per brainstorm worked examples):**
- bench 135 × 10, 200 lb male, RELAXED, no holiday, no ribbons → matches Example 1 totals (within float tolerance)
- deadlift 315 × 5, 200 lb male, HARDENED tier (×2.28), 5 ribbons (0.50), no holiday → matches Example 3 totals
- bench at 145 lb user, 225 × 5 → `earnsStars: true`, HEAVY LIFT bonus > 0 (relative_load 1.55 > 0.75 × threshold 1.5 = 1.125; combined_factor > 1)
- bench at 200 lb user, 135 × 10 (warm-up) → `earnsStars: false` (relative load below floor); XP still computes; HEAVY LIFT line skipped

## Dependencies on other workers

- gtl2 ships `lib/exp/holidays.js` in this same Wave 1 in parallel. Your `setXP.js` should import from there: `import { getHolidayMultiplier } from './holidays'`. If gtl2 hasn't landed when you need to use it: wait, OR proceed and let the import resolve when their commit lands. Their work is independent of yours; their file shouldn't touch any of yours.
- gtl3 reads your stores in Wave 2. Honor the contract: keys are `pk('xpLog-{cycleId}-{iso}')`, `pk('tier-count')`, `pk('ribbon-count')`, `pk('prestige-unlocked')`, `pk('tier-cross-pending')`, `pk('region-stars')`. If you need to deviate from these, that's a blocker — surface it.

## DO NOT

- Build any UI component. `<TierUpFlourish>`, `<AscendPrompt>`, `<SetXPCinematic>`, `<RegionStarPips>`, `<TierTag>`, `<RibbonRow>` are all gtl3's. You write data + flags only.
- Touch `lib/exerciseAliases.js` (curation source — already locked).
- Modify auto-generated content of `lib/exerciseLibrary.js` other than adding `getExerciseById` export.
- Run `npm run import:exercises` (network call, risks committed-file drift per handoff §2-3).
- Relitigate any locked R-rule. If you find a real ambiguity in the spec, surface as a blocker.
- Introduce new equipment values beyond `{machine, cable, dumbbell, barbell, bodyweight}`.
- Add new exercise tags or new region categories.
- Change `REFERENCE_BW = 180`, `STAR_FLOOR_FRACTION = 0.75`, IPF GL parameters, or tier multiplier curve constants.
- Skip writing tests for the math modules.
- Squash all 6 commits into one.

## NO-DISCRETION PROTOCOL

When you hit any judgment call (key naming not specified, validation rules, threshold values, structural decisions, edge-case handling not in spec), **STOP**. Do not guess.

Write the question to `dispatches/blockers/gtl1_<short_topic>.md`:

```
# Blocker: <one-line topic>

**Worker:** gtl1
**Affects:** R-rule(s) and/or sub-task
**Question:** [the specific question]
**Candidate answers:** [2-3 concrete options with brief tradeoff notes]
**Recommendation:** [your best guess + why]
**What's blocked:** [what you cannot proceed with until answered]
```

Commit (`git commit -m "Blocker: <topic> (gtl1)"`), push, **pause execution**. King relays to Jordan, dispatches the answer back to the same blocker file. Resume from there.

Things that count as discretion: localStorage key naming when not specified, animation easing/timing, copy text on UI, modal layout, validation bounds, choice between split vs combined components, test scenario boundaries beyond the plan's enumeration.

Things that DON'T require a blocker: implementing math the spec specifies, mirroring an existing repo pattern verbatim, reading a value from a store the spec specifies the key for.

## Done when

All 6 commits land on `origin/dev`. The existing app still loads and renders correctly with no behavioral regression on the legacy XP path. Reply with:
- the 6 commit hashes
- any blockers raised (with file paths)
- a brief "no surprises" or "found X surprise" note
