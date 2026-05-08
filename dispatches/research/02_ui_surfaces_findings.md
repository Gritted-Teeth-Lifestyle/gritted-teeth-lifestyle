# 02 — UI surfaces (gtl2 research)

Read-only research for the Combo EXP Multiplier plan. All claims grounded in current source on `dev`.

## Q4. Transmutation-circle star chart

**File / component.** `app/fitness/stats/page.js`. The chart is `BodyStarChart` (`stats/page.js:546-589`), which composes three pieces inside a 3D-tilted SVG:

- `TransmutationCircle` — alchemical circle backdrop, `stats/page.js:451-544`.
- A filled gold polygon star whose 5 outer vertices sit at radii determined by per-region level. Path built by `buildStarPath(regionXP)` (`stats/page.js:374-383`); ghost outline by `buildGhostPath()` (`stats/page.js:387-394`).
- `RegionBadge` per region, rendered absolute-positioned outside the SVG (`stats/page.js:428-448`, anchored via `badgeCSS(i)` at `stats/page.js:409-426`).

**How regions are wired today.** Five fixed regions in `BODY_REGIONS` (`stats/page.js:17-23`): CORE, ARMS, LEGS, FRONT, BACK. A flat `MUSCLE_TO_REGION` lookup (`stats/page.js:26-27`) is built from each region's `muscles[]` list — currently a 1:1 muscle→region map (e.g., `quads → LEGS`, `chest → FRONT`). Region XP is accumulated in `loadStats()` (`stats/page.js:259-334`) via the existing `weight × repMult(reps) × reps` formula, summed into `regionXP[ri]` (`stats/page.js:296-300`). Region angles are evenly-spaced (`stats/page.js:347-348`); the order on the chart is FRONT (top), ARMS (upper-right), LEGS (lower-right), CORE (lower-left), BACK (upper-left).

**Star awards data shape today.** There is **no per-region star count** in the data shape. The "star" today is the polygon's shape, not discrete ★ pips. What's stored/computed per region is a continuous `regionXP[i]` number (`stats/page.js:267`); it converts to a 0–6 *level* via `getRegionLevel()` (`stats/page.js:358-365`) against thresholds `REGION_XP_LEVELS = [0, 90000, 300000, 750000, 1800000, 4500000]` (`stats/page.js:353`), and that level drives the polygon point's radius via `levelToR()` (`stats/page.js:367-369`). Each `RegionBadge` then displays the label plus a tier word from `REGION_TIER_LABELS` (`'VICTIM' / 'SKINNY FAT' / 'STACKED' / 'YOLKED' / 'DICED' / 'SHREDDED'`, `stats/page.js:356`).

So R12/R12b/R13's per-set 0/1/2★ awards are net-new UI — there's no existing slot to reuse. The plan needs a new persisted per-region star-count store and a new render pass.

**Visual treatment when a region "earns" growth today.** Static. The polygon's outer point simply sits at a higher radius once the threshold is crossed — no growth animation, no per-region pulse, no ★ glyph. The XP bar at the top of `/fitness/active` has a `xp-bar-pulse` and `xp-bar-wobble` (`active/page.js:3415-3431`), but the stats-page transmutation chart has no animation hooks; it renders once on mount from `loadStats()` (`stats/page.js:613-616`). Level-rings at indices 2/3/5 are statically drawn at `stats/page.js:562-564`.

**Where R12/R12b/R13 star-pop animations attach.** The natural integration point is inside `BodyStarChart` at `stats/page.js:570` (right after the filled-XP star path renders, so star pips paint *over* the polygon). Each region's anchor is already computable: outer-point coords come from `REGION_ANGLES[i]` + the current `levelToR(level)`, and `RegionBadge`'s mounting point gives a parallel CSS-coord anchor (`badgeCSS(i)`, `stats/page.js:409-426`). A new prop `regionStars: number[5]` would feed the badge or a new `RegionStarPips` overlay rendered inside the same tilted wrapper at `stats/page.js:551-587`.

For per-set "pop" choreography on the active page, the existing transmutation chart isn't mounted there — it's stats-only. The plan likely needs either (a) a lightweight `<RegionStarPip>` overlay reused on `/fitness/active` near the XP bar (positioned at `xpBarRef`, `active/page.js:2738`), or (b) a deferred-pop model where stars accumulate silently per set and animate on next stats-page mount.

## Q5. Per-set XP-fly animation

**File / component.** `app/fitness/active/page.js`. The brainstorm refers to this as "per-set" but the code is **per-cycle / per-day** today — the choreography lives in `triggerXPAnimation` (`active/page.js:3028-3104`) and the JSX overlay at `active/page.js:3380-3483`. Per-set saving in `app/fitness/active/[iso]/[muscleId]/page.js` (`saveReps` `1525-1536`, `saveWeight` `1538-1549`) currently fires no XP cinematic at all.

**Animation timing model (existing).** Driven by an `xpAnim` state with `phase ∈ {expand, converge, combine, fly, fill}` (`active/page.js:2736`). Sequence:

| Phase | t (ms) | Source |
|---|---:|---|
| `expand` | 0 | `setXpAnim(...)` `active/page.js:3068` |
| `converge` | 700 | `active/page.js:3069` |
| `combine` | 1500 | `active/page.js:3070` |
| `fly` | 2400 | `active/page.js:3071` |
| `fill` | 3100 | `active/page.js:3073` (also commits `setBarXP(newXP)`) |
| level-up sub-cascade | +1900ms after fill | `active/page.js:3078-3100` |
| cleanup | 5000 | `active/page.js:3103` |

Keyframes: `xp-p-${i}` per particle (`active/page.js:3396-3402`), `xp-combine-in` (`3403-3409`), `xp-fly` 700ms cubic-bezier (`3410-3414`), `xp-bar-pulse`, `xp-bar-wobble` (`3415-3431`). The level-up sub-cascade has `lvlup-cone-in / lvlup-stream / lvlup-flood-in / lvlup-sparkle-in / lvlup-label / lvlup-num` (`active/page.js:3498-3537`).

**State trigger.** `triggerXPAnimation(closingDay)` (`active/page.js:3028`). It walks `cycle.days`, computes per-day volume from localStorage (`done-${cycleId}-${iso}` flag at `active/page.js:3035`, plus `ex-`/`wt-` per muscle at `active/page.js:3041-3057`), and emits one particle per completed day. **It is currently defined but never invoked from any handler in the file** — there's a stranded wire (the closing-day completion path that would have called it was refactored out when DayFocus moved to a separate route at `app/fitness/active/[iso]/page.js`). So as of `dev` HEAD, the visible per-day XP fly does not actually run; the bar updates without animation via the `setBarXP(newXP)` path on mount (`active/page.js:2803-2804`).

**Can it extend to R18's sequential cinematic?** **Recommendation: build a parallel new component**, don't extend `triggerXPAnimation`.

Reasons:
1. The existing keyframes are spatial (particles converge from card positions to screen center, then fly to the XP bar). R18 is **sequential text reveal** stacked vertically — base → HEAVY LIFT → consistency → class → prestige — running total accumulates downward. Different geometry, different choreography axis.
2. Trigger location is wrong: R18 fires on every set log (inside `[muscleId]/page.js`'s `saveReps`/`saveWeight` save path), not on day-close on the cycle-overview screen. The `xpAnim` overlay is also gated on the cycle-overview JSX tree (`active/page.js:3380`) — it has no mount on `[muscleId]/page.js`.
3. R18a's HEAVY LIFT line is conditional (`combined_factor > 1`); inactive multipliers skip-render. That's a row-list state machine, not a phase machine.
4. Reusing `xp-fly` as the *terminal* phase of the new cinematic (after the multi-line reveal completes, the running total flies to the bar) gives visual continuity with the existing level-up cascade. Recommend: build `<SetXPCinematic>` as a new component mounted in `[muscleId]/page.js` after `saveReps`/`saveWeight` commit, then on its `onComplete` either (a) bubble the total up via storage event so the cycle-overview's XP bar repaints, or (b) inline a mini bar on the `[muscleId]` screen.

The level-up sub-cascade (`active/page.js:3486-3640`) is the right reference for R7 tier-up flourish (kanji/color/animation per crossing) — pattern of `phase` machine + multi-keyframe cascade is reusable, but again as a **sibling** component, not as more states bolted onto `xpAnim`.

**iOS PWA gotchas already documented in the file:**

- Hard scroll lock during active page mount: `position:fixed + inset:0 + touch-action:none` on body (`active/page.js:2758-2789`); without this, WKWebView pans the viewport. Cinematic must use `position:fixed` particles (existing pattern at `active/page.js:3393`) so it isn't affected.
- iOS-leaked-click eat (150ms post-mount grace, `active/page.js:2727-2731`, `mountTimeRef`) — relevant if R18 cinematic dismissal accepts taps; first 150ms must be ignored.
- `scrollTop` direct assignment, not `scrollBy({behavior:'instant'})` (`active/page.js:2891-2894`) — known WebKit bug (see memory `feedback_ios_pwa_scrollby_unreliable.md`).
- Predictive-tap chain hits during animation: `setInAnimation('activate', true)` (`active/page.js:2754`) — cinematic should call `setInAnimation` on its phase boundaries to keep the chain coherent, or the next-set tap will mis-stage.
- Safe-area-inset on overlay z-stacks: existing overlays at `zIndex: 9999` (`active/page.js:3393`) and 10000 for level-up (`active/page.js:3496`) — R18 cinematic should sit between, ~9995, so a tier-up flourish (R7) can still paint over it.

## Q9. Profile page layout

**Current state: there is no dedicated profile page.** What exists:

- `app/fitness/page.js` — the **profile *selector*** (identity gate). Renders "WHO ARE YOU" headline (`fitness/page.js:392-395`), a name input (`fitness/page.js:402-469`), and a list of `ProfileChip`s for known warriors (`fitness/page.js:472-493`). On select it writes `gtl-active-profile` (`fitness/page.js:276`) and routes to `/fitness/hub`. This is mount-once, gate-style — not an identity surface to attach a tier tag/ribbons.
- `app/fitness/hub/page.js` — does **not** render the active profile name; headline reads "CHOOSE YOUR CYCLE" (`hub/page.js:518-524`).
- `app/settings/page.js` — has the closest-existing identity slot. After the "SETT INGS" headline, a small line reads `ACTIVE WARRIOR — {activeProfile}` at `settings/page.js:378-382`. Sourced from `localStorage.getItem('gtl-active-profile')` at `settings/page.js:141`. No display-name concept — the profile name *is* the display name.
- `app/fitness/stats/page.js` — "WAR RECORD" headline (`stats/page.js:681-687`) followed by level/XP bar, key stats, transmutation chart, cycle log. No profile name surfaced.

**Where R20 identity tag + Galaxy-Spiral ribbon row attach.** Two viable slots; recommend a new dedicated page rather than overloading existing ones:

**Recommended: new `app/fitness/profile/page.js` route.** Hub already has a precedent for "WAR RECORD" as a hub option (`hub/page.js:574-582`, `GhostOption` linking `/fitness/stats`); add a parallel "WARRIOR PROFILE" entry. The new page mirrors the stats-page layout shell (kanji watermark + RetreatButton + `useProfileGuard()` + headline block, `stats/page.js:629-668`). Headline becomes `{activeProfile}` rendered in the matisse display type used elsewhere (`stats/page.js:681`); directly under the display name, two new slots:

1. **Tier identity tag** — chip styled like `RegionBadge` (`stats/page.js:428-448`) — gold parallelogram with kanji + tier name + R5c color treatment (R7).
2. **Galaxy-Spiral ribbon row** — horizontal flex row of icons; earned ribbons fill left-to-right; unearned slots hidden until first ribbon (per R20).

**Fallback / quick-launch slot if a new route is too much scope:** extend `app/settings/page.js`. Replace the small "ACTIVE WARRIOR — {activeProfile}" line at `settings/page.js:378-382` with a structured identity block:

```
<div>WARRIOR</div>
<h2>{activeProfile}</h2>           ← display name (existing data, just promoted)
<TierTag tier={...} />              ← R20 identity tag
<RibbonRow ribbons={...} />         ← R20 ribbon row
```

Either way: the data plumbing is the same — read tier and ribbon counts from new profile-scoped keys (`pk('tier-counter')`, `pk('ribbons')`, etc., per the runtime/storage research dispatch). Per `KING_HANDOFF` rule 10, surface to Jordan whether a new `/fitness/profile` route is in scope before implementing.
