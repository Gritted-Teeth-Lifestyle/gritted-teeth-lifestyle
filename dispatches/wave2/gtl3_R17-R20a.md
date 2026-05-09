# Wave 2 dispatch — gtl3 — R17-R20a + R7 + R9 UI

You own all UI surfaces for the Combo EXP Multiplier System. gtl1 has landed all 6 Wave-1 commits — the runtime + persistence + tier store + region star resolver + handleStamp wiring is in place. You read from their stores; never write algo state.

## Read first

1. `docs/plans/2026-05-08-001-feat-combo-exp-multiplier-plan.md` — the active plan, especially the **Worker Dispatch Map** section's gtl3 row and the **No-Discretion Protocol** at the end.
2. `dispatches/2026-05-03-gtl-combo-exp-multiplier-requirements.md` — locked brainstorm. R17, R18, R18a, R19, R20, R20a are your scope; R7 and R9 UI components also yours per the dispatch map.
3. `dispatches/KING_HANDOFF_combo_exp.md` — handoff context.
4. `dispatches/research/02_ui_surfaces_findings.md` — your prior research; current code anchors.
5. **gtl1's Wave 1 commits** — read `lib/exp/index.js` and the modules it re-exports to know the exact API surface you can consume:
   - `lib/exp/setLog.js` — `readSetLog`, `readSetLogForDay`, snapshot shape
   - `lib/exp/tier.js` — `getTier(count)`, `getNextTierThreshold(count)`, `getTierMultiplier(count)`, `TIER_NAMES`
   - `lib/exp/tierStore.js` — `getTierCount()`, `getRibbonCount()`, `awardRibbon()`, `resetTierForAscend()`
   - `lib/exp/prestige.js` — `getPrestigeMultiplier(ribbonCount)`
   - `lib/exp/regionStarStore.js` — `getRegionStars()`
   - `lib/exp/setXP.js` — snapshot shape (you only read; you don't recompute)

## Scope

| R | Deliverable |
|---|---|
| R7 | `components/exp/TierUpFlourish.jsx`. Polls `pk('tier-cross-pending')` on relevant route mounts (profile + stats + active). On detection, mounts the flourish, then clears the flag (write `''` or remove key). Animation choreography mirrors the existing level-up sub-cascade pattern at `app/fitness/active/page.js:3486-3640` as a **sibling** component. |
| R9 (UI) | `components/exp/AscendPrompt.jsx`. Mounts when `pk('prestige-unlocked')` is `'true'`. Renders on profile page (primary surface) and on hub (secondary, less aggressive). Two CTAs: **ASCEND** calls gtl1's `awardRibbon()` then `resetTierForAscend()`; **HOLD** dismisses but flag remains so the prompt re-mounts on next visit. |
| R17 | Verification pass. Confirm no constant multiplier display creeps into the active-page nav anywhere. Audit `app/fitness/active/page.js`, `app/fitness/active/[iso]/page.js`, `app/fitness/active/[iso]/[muscleId]/page.js` — none should permanently render tier mult, class mult, or prestige mult in their UI chrome. The cinematic and profile/stats pages are the only multiplier surfaces. |
| R18, R18a | `components/exp/SetXPCinematic.jsx`. Mounted in `[muscleId]/page.js` after `saveReps`/`saveWeight` commit (gtl1's commit 7758c5b extended these handlers — the snapshot is now appended to setLog). Reads the latest snapshot via `readSetLog(...)` or accept it as a prop from the save handler. Sequential reveal per the brainstorm R18 format: base → HEAVY LIFT (only if `combined_factor > 1`) → consistency → class → prestige → total. Inactive multipliers skip-render. Cinematic ~1.2-1.5s. Terminal phase reuses `xp-fly` keyframe at `active/page.js:3410-3414` to bubble running total to the cycle-overview XP bar. |
| R19 | `components/stats/RegionStarPips.jsx`. Overlay inside `BodyStarChart` at `app/fitness/stats/page.js:546-589`. Reads `pk('region-stars')` via `getRegionStars()`. Renders pip clusters anchored at each region's badge position (use `badgeCSS(i)` at `stats/page.js:409-426` for coordinates). For high counts (> 5 in a region), use `★ × N` count format to avoid clutter. Animates new stars since last stats-page mount via `pk('region-stars-last-seen')` delta tracking; on unmount or after animation, write current → last-seen. |
| R20 | New route `app/fitness/profile/page.js`. Mirror the stats page shell pattern (kanji watermark + `RetreatButton` + `useProfileGuard()` + headline) at `app/fitness/stats/page.js:629-668`. Headline = `{activeProfile}` (read from `localStorage.getItem('gtl-active-profile')`). Below: `<TierTag tier={getTier(count)} />` + `<RibbonRow ribbons={getRibbonCount()} />`. Hub gets a `WARRIOR PROFILE` `<GhostOption>` linking here, alongside the existing `WAR RECORD` at `app/fitness/hub/page.js:574-582`. |
| R20 components | `components/profile/TierTag.jsx` (kanji + tier name + R7 color treatment) and `components/profile/RibbonRow.jsx` (Galaxy-Spiral icons; earned fill left-to-right; unearned slots hidden until first ribbon claimed per R20). |
| R20a | Stats page extension. Add a new section below the existing `BodyStarChart` (around `stats/page.js:580+`) with: tier progress bar, `X/Y SESSIONS TO {NEXT_TIER}` text, cumulative 100%-session count, and a ribbon history strip. Read tier count + ribbon count from gtl1's `tierStore`. |

## Snapshot shape (R18 cinematic input)

Per gtl1's `lib/exp/setXP.js` — `calculateSetXP` returns this shape (verify against actual code at `lib/exp/setXP.js`):

```
{
  setIdx, ts, exerciseId, reps, weight,
  baseXP, normFactor, heavyLiftBonus,
  classMult, consistencyMult, prestigeMult, holidayMult,
  totalXP,
  regionWeights: [c, a, l, f, b],
  regionStars:   [c, a, l, f, b],
  earnsStars
}
```

Cinematic uses these specific fields:
- `baseXP` for the base line
- `heavyLiftBonus` for the conditional HEAVY LIFT line (skip if 0)
- `consistencyMult` for the consistency line (skip if 0 / RELAXED)
- `classMult` for the class line — pick label from `is_king_compound`/`is_isolation_override`/default-compound on the exercise lookup
- `prestigeMult` for the prestige line (skip if 0)
- `holidayMult` for the holiday line (skip if 0)
- `totalXP` for the running total + final big number

## Locked timings

| Param | Value |
|---|---|
| Cinematic total | 1.2-1.5s |
| Per-line reveal | 180-220ms apart (your call within range) |
| Final flash hold | 250ms |
| Terminal xp-fly to bar | 700ms (existing `xp-fly` keyframe) |
| Cleanup / dismiss | 250ms after fly completes |
| TierUpFlourish total | matches existing level-up cascade ~1.9s envelope |
| AscendPrompt mount/unmount | 250ms in / 200ms out |

## iOS PWA gotchas (must respect)

Per `dispatches/research/02_ui_surfaces_findings.md` Q5:
- Hard scroll lock during active page mount (`active/page.js:2758-2789`) — cinematic uses `position:fixed` so it's unaffected.
- 150ms leaked-click eat (`mountTimeRef`, `active/page.js:2727-2731`) — cinematic dismissal must ignore taps in first 150ms.
- `scrollTop` direct assignment, not `scrollBy` (memory `feedback_ios_pwa_scrollby_unreliable.md`).
- Predictive-tap chain coordination: call `setInAnimation('cinematic', true)` on mount, `(false)` on dismiss, so chain to next-set's button stays coherent.
- z-index sandwich: cinematic at **9995** (below level-up at 10000, above XP overlay at 9999).

## DO NOT

- Write any algo state. Don't compute XP, don't compute multipliers, don't write to `pk('xpLog-...')`, don't write to `pk('tier-count')`, don't write to `pk('region-stars')`. You read; gtl1's runtime writes.
- Modify `lib/exp/*` files. They're gtl1's territory.
- Modify `lib/exerciseAliases.js` or `lib/exerciseLibrary.js`.
- Build a parallel cinematic mount on the active cycle-overview screen — R18 cinematic mounts inside `[muscleId]/page.js` after the save handler. Per-day xp-fly on the cycle-overview is the existing (orphaned) `triggerXPAnimation`; leave it alone or delete in a follow-up — your call as a sibling cleanup, but the new cinematic is the per-set replacement.
- Add a constant multiplier display to the active-page nav. R17 forbids.
- Skip the iOS PWA gotchas. The `setInAnimation` coordination is load-bearing — without it the predictive-tap chain to the next set's button stalls.
- Kill any node / dev-server processes you didn't start. Don't run `pkill node`, `taskkill /f /im node.exe`, `killall node`, or anything similar. If a port is occupied, pick another (try 3050, 3060, 3070...) or surface as a blocker. Jordan typically has 3-5 GTL dev servers running.

## NO-DISCRETION PROTOCOL

Standard rules per `docs/plans/2026-05-08-001-feat-combo-exp-multiplier-plan.md` Worker Dispatch Map. Anything not specified above:

- TierTag exact styling (kanji selection per tier, color per tier, font weight)
- TierUpFlourish choreography (which keyframes, how kanji appears, color treatment per tier)
- AscendPrompt copy (headline, body, button labels)
- Profile page headline styling beyond "mirror stats shell"
- Stats progress bar visual (shape, fill direction, label position)
- Cinematic per-line typography choices not derivable from existing GateScreen / brand vocabulary

→ Route each as a blocker file `dispatches/blockers/gtl3_<short_topic>.md` with the question + 2-3 candidates + your recommendation. Commit, push, pause. King relays to Jordan.

Things that DON'T require a blocker:
- Mirroring existing repo styling vocabulary verbatim (matisse type, gtl-red color, clip-path silhouettes, mixBlendMode difference).
- Standard React patterns (useEffect cleanup, lazy useState, refs for animation timing).
- Implementing math/timing the spec specifies (1.2-1.5s envelope, 180-220ms per-line range).

## Internal sequencing (suggested — you may reorder)

1. **R17 verification + R19 RegionStarPips** — quick wins, no new component scaffolding for R17. Commit.
2. **R18 + R18a cinematic** — heaviest piece. Commit.
3. **R20 + R20a profile page + stats extension + TierTag + RibbonRow** — combined commit covers profile route, identity components, stats progress bar, hub link.
4. **R7 TierUpFlourish + R9 AscendPrompt** — UI consumers of gtl1's flags. Combined commit.

4 commits total. Push each so King can review progress.

## Done when

All 4 commits land on `origin/dev`. Reply with:
- 4 commit hashes
- iPhone PWA verification or browser-only note
- Any blockers raised
- A "tested with gtl1's runtime" sanity check — log a real set, see the cinematic; mark a 100%-session, see the tier-up flourish (eventually); etc.
