---
date: 2026-05-03
topic: gtl-combo-exp-multiplier
status: locked (ready for ce:plan)
last-updated: 2026-05-06
---

# GTL Combo EXP Multiplier System

> **Status (2026-05-06)**: All product/algo decisions resolved. Brainstorm is ready for `/ce:plan`. The Outstanding Questions section below is now historical — every entry is struck-through with its resolution date.
>
> **2026-05-03 update**: replaced the earlier "M_high/M_low per-region multipliers" model with a two-track model (continuous total XP via additive multipliers + discrete star awards per region). See R2–R3 and R10–R14.
>
> **2026-05-06 update**: completed full algo lockdown — IPF GL Points normalization (R1a), per-exercise heavy-lift thresholds (R18a), star-earning floor (R12c), and full muscle-curation pass on all 263 exercises. See R1a, R5–R5c, R8, R9, R10–R14, R12c, R16, R17–R20a.

## Problem Frame

GTL has an existing XP system: per-set XP is computed via `weight × repMult(reps) × reps` (with a flat 1.0× plateau between 5 and 15 reps; bell curves outside). XP today allocates to a Total XP counter (player level) and to one of 5 body-region counters (CORE / ARMS / LEGS / FRONT / BACK) via a 1:1 muscle→region map. The stats page already renders a transmutation-circle star chart driven by region XP; the active page already has a per-set XP-fly animation choreography.

The new feature is a **combo-driven multiplier system** that layers on top. It introduces named consistency tiers, prestige loops, holiday windows, wger-seeded multi-region distribution, and **two parallel tracks** for how XP gets credited:

- **Total XP track (continuous)** — additive multipliers, drives the player level.
- **Region star track (discrete)** — wger weight share buckets into 0/1/2-star awards on the transmutation circle, with rules to enforce a "compound = 2 regions × 1 star, isolation = 1 region × 2 stars" ideal.

## Requirements

**Base XP (existing formula, with new bodyweight handling)**
- R1. Base XP per set: `base = effective_load × repMult(reps) × reps`. The `repMult` curve is unchanged (flat 1.0× between r=5 and r=15, bell curves outside). Both new tracks build off this `base`.
- R1a. **`effective_load` calculation (IPF GL Points normalization, locked 2026-05-06)**:

  All loads are normalized by an **IPF GL Points** coefficient so XP scales by relative strength rather than absolute weight. IPF GL is the current powerlifting strength-relative formula (replaced Wilks in 2020). Calibrated against modern strength-sport standards.

  **REFERENCE_BW = 180 lb (≈ 81.65 kg)** — the anchor at which `norm_factor = 1.0`. Lighter users get a boost; heavier users a reduction; the curve matches IPF GL Points.

  **Normalization formula:**
  ```
  ipfGL(bw_kg) = 100 / (a - b × exp(-c × bw_kg))
    where (a, b, c) = (1199.72839, 1025.18162, 0.00921)   for male raw total
                   = (610.32796,  1045.59282, 0.03048)    for female raw total

  norm_factor = ipfGL(user_BW_kg) / ipfGL(REFERENCE_BW_kg)
  ```

  Sample `norm_factor` values (male):

  | user_BW | norm_factor |
  |---|---:|
  | 100 lb (45.4 kg) | 1.299 (29.9% boost) |
  | 145 lb (65.8 kg) | 1.126 (12.6% boost) |
  | 180 lb (81.6 kg) | 1.000 (anchor) |
  | 200 lb (90.7 kg) | 0.952 (4.8% reduction) |
  | 250 lb (113 kg) | 0.892 |
  | 300 lb (136 kg) | 0.853 |

  **External-load exercises:**
  ```
  effective_load = entered_weight × norm_factor
  ```

  **Bodyweight exercises:**
  ```
  effective_load = REFERENCE_BW × bw_coefficient + entered_weight × norm_factor
  ```
  The BW component becomes a constant (`REFERENCE_BW × bw_coefficient`) — every user gets the same load credit for the same exercise's bodyweight portion. The added-weight component (for weighted pull-ups, weighted dips, vest squats) is normalized via the IPF GL `norm_factor`.

  **Why IPF GL over linear:** linear `(REFERENCE_BW / user_BW)` overshoots in both directions — gives 100 lb users an unrealistically high boost (×1.8) and 300 lb users an unrealistically low scaling (×0.6). IPF GL caps these naturally per the strength-sport curve (×1.30 at 100 lb, ×0.85 at 300 lb), aligning with how competitive powerlifting compares lifts across body weights.

  **Required prerequisite**: `user_bodyweight` and `user_sex` must be stored in profile (sex defaults to male if unset; female parameters available for users who specify). Captured at first-time onboarding. If unset when user logs a set, modal forces input before saving.

**Total XP track (continuous, additive multipliers)**
- R2. The Total XP added per set = sum of contributions from each active multiplier:
  ```
  total_visible_XP =
      base × consistency_mult
    + base × class_mult         // class_mult = isolation_mult OR compound_mult OR king_compound_mult
    + base × holiday_mult       // 0 if no holiday active
    + base × prestige_mult      // 0 if no prestige bonus
  ```
  Inactive multipliers (no holiday today, no prestige badges) contribute 0. The classification multiplier scales with category: **`king_compound_mult` > `compound_mult` > `isolation_mult`**. Locked values: `king_compound_mult = 1.75` (locked 2026-05-05), `compound_mult = 1.5` (operating), `isolation_mult = 1.2` (operating). Heavier-category lifts earn more raw total XP per set.
- R3. The user sees a **single visible XP number** in the per-set popup animation — equal to the sum above. That number adds to `totalXP` (the existing player-level driver). The popup briefly reveals the breakdown ("+base × 1.3 consistency + base × 1.5 compound = +visible_XP").

**Region star track (discrete, wger-driven)**
- R10. Each exercise has a region-weight vector derived from a hand-curated `primaryMuscles` / `secondaryMuscles` split (stored in `lib/exerciseAliases.js` `MUSCLE_FIXUP`, written into each library entry). Heuristic: primary muscles get 60% of total weight (split evenly across primary muscles), secondary muscles get 40% (split evenly across secondaries). When a muscle list is single (no secondaries), the primary owns 100%. Tunable.

  Curation (locked 2026-05-06): all 263 library exercises have hand-tuned primary/secondary splits. R10's 60/40 model produces zero region ties under this curation — every exercise has an unambiguous winner for each star slot.
- R10a. **wger → region mapping uses DUAL SEMANTICS** — upper-body and lower-body muscles map differently:
  - **Upper-body muscles** use torso-only semantics. FRONT = front of torso (chest / pectorals, serratus). BACK = back of torso (lats, rhomboids, traps, erector spinae). ARMS = all limb muscles in the upper limbs including all three deltoid heads (anterior, medial/lateral, posterior — they sit on the upper arm). CORE = abdominals.
  - **Lower-body muscles** use position-of-leg semantics. FRONT = quads (front of leg). BACK = hamstrings (back of leg). LEGS = catch-all for the rest of the leg muscles: glutes, calves, adductors, abductors.
  - The same region IDs (FRONT, BACK) carry dual meaning depending on the muscle's body half. A bench press grows FRONT via chest; a squat grows FRONT via quads — both are anatomically "front of body" so the dual semantics aligns with what the user feels: FRONT = front of you, BACK = back of you, regardless of upper vs lower half.
  - Practical effect: lower-body lifts no longer dump all their XP into LEGS. Compound lower-body lifts (squat, deadlift, leg press) naturally distribute across FRONT/BACK/LEGS based on which leg muscles they target.
- R11. Star bands (per region, per set) — **legacy / advisory**, no longer drive star awards under the amended R12/R12b/R13 rules. Retained as a quick visual reference for "what % share roughly corresponds to a star tier" when curating new exercises:
  - `< 30%` wger weight → roughly stabilizer / not-a-real-target territory
  - `30–59%` → meaningful secondary
  - `60%+` → primary target
- R12. **Compound exercises (regular)** award 1★ each to the **top 2 wger-weight regions** (subject to the R12c star-floor gate). Band thresholds (R11, retired) do NOT gate this — the top 2 always earn a star regardless of raw region share when the set qualifies under R12c. **Tiebreak (locked 2026-05-06)**: hand-curated primary/secondary splits eliminate ties at the design level (R10 curation produces zero ties across the 263-entry library). For future-added exercises where ties might emerge, default tiebreak is **alphabetical** (deterministic, easy to debug). The Total XP track applies `compound_mult = 1.5` per R2.
- R12b. **King Compound exercises** award 1★ each to the **top 3 wger-weight regions** instead of top 2. Curator-tagged via `is_king_compound: true` on the library entry (driven by `KING_COMPOUNDS` set in `lib/exerciseAliases.js`). Single-leg variants are NOT King — they cut intensity. The Total XP track applies `king_compound_mult = 1.75` (locked) instead of `compound_mult = 1.5`.

  **King list (locked 2026-05-06, 18 entries):** Squats — BARBELL SQUAT, FRONT SQUATS, SUMO SQUATS, BOX SQUAT, BELT SQUAT, HACK SQUATS, TRAP BAR SQUAT, SMITH MACHINE SQUAT, PENDULUM SQUAT. Deadlifts — DEADLIFTS, SUMO DEADLIFT, BARBELL ROMANIAN DEADLIFT (RDL), STIFF-LEGGED DEADLIFTS, DEFICIT DEADLIFT, RACK DEADLIFT. Leg press — LEG PRESS, LEG PRESSES (NARROW), LEG PRESSES (WIDE).

  Each King's `MUSCLE_FIXUP` entry has been deliberately curated so that 3 distinct regions emerge from R10's 60/40 split — e.g., BARBELL SQUAT primary `[quads]` secondary `[glutes, back]` produces FRONT 60% / LEGS 20% / BACK 20% → FRONT 1★ + LEGS 1★ + BACK 1★. Without the third-region curation, most Kings would only span 2 regions and award just 2 stars (defeating the King purpose).
- R13. **Isolation exercises** concentrate on the **single highest-weight region** — that region earns 2★ (subject to R12c star-floor). All other regions earn 0★ regardless of their raw share. The Total XP track applies `isolation_mult = 1.2` (smaller than `compound_mult`) per R2.

- R12c. **Star-earning floor (locked 2026-05-06)** — region stars (R12 / R12b / R13) are awarded only when the set's relative load is at least **0.75 ×** the exercise's `heavy_lift_threshold`. Below the floor, the set logs XP normally but earns **zero stars**. Filters warm-ups and light rep-out work from the region-star track; only genuine working sets contribute.

  ```
  star_floor    = 0.75 × heavy_lift_threshold
  relative_load = bw_coefficient + entered_weight / user_BW
  earn_stars    = (relative_load >= star_floor)
  ```

  XP is unaffected — a sub-floor set still rolls through R2's multiplier stack (consistency, class, prestige, holiday, heavy_lift). Only the region-star award is gated. Constant `STAR_FLOOR_FRACTION = 0.75` lives in `lib/exerciseAliases.js`.

  **Examples (BENCH PRESS, heavy_lift_threshold = 1.5× BW → star_floor = 1.125× BW):**

  | User | Lift | Relative load | Stars? |
  |---|---:|---:|---|
  | 200 lb | 135 lb (warm-up) | 0.68× BW | ❌ |
  | 200 lb | 200 lb | 1.00× BW | ❌ |
  | 200 lb | 225 lb | 1.125× BW | ✅ at floor |
  | 200 lb | 275 lb | 1.375× BW | ✅ |
  | 200 lb | 315 lb | 1.575× BW | ✅ + HEAVY LIFT bonus |
  | 145 lb | 225 lb | 1.55× BW | ✅ + HEAVY LIFT bonus |
- R14. **Classification (compound vs isolation) is a curated per-exercise property**, not auto-derived. Auto-classification rule (used at wger import time, after R10a region mapping): if aggregated wger weight is 100% in one region (e.g., hip thrust, calf raise, leg extension, bicep curl, tricep extension, front raise — anterior delt isolation now lands at ARMS 100%), default to **isolation**. Otherwise default to compound. **Curator pass required after import** — Jordan reviews and hand-overrides exercises that the auto-rule miscategorizes. Known curator-override candidates: lateral raise (medial delt isolation, wger 60/40 ARMS/BACK → defaults compound), reverse fly / rear delt fly (rear delt isolation, wger 60/40 ARMS/BACK), and any other exercise where wger lists a stabilizer as secondary but training intent is single-target.

**Consistency / Combo Identity**
- R4. **Consistency XP** is a new, separate counter (parallel to Total XP). It accumulates from completing planned sessions on planned days. Its level determines the **Consistency multiplier** value (R2).
- R5. The combo identity has a **21-tier teeth-grip ladder** running RELAXED → BRUSHED → BARED → BRANDISHED → PRIMED → PRESSED → SQUEEZED → LOCKED → DUG → DRIVEN → CLASPED → CLENCHED → CLAMPED → WRENCHED → CALLOUSED → HARDENED → HALLOWED → GNAWED → GNASHED → BLOODIED → **GRITTED** (peak). Multiplier values per tier are locked in **R5c** (geometric curve from ×1.00 → ×3.00).
- R5a. **Tier counter mechanic (locked 2026-05-05)**: tier is determined by the **lifetime cumulative count of 100%-completion sessions**. Each fully-completed session ticks the counter +1. Partial sessions (50–99%) do **not** tick. Sub-50% sessions do not tick either. The counter has **no decay** — it never decreases. Once a tier is unlocked, the user keeps it permanently. **Peak tier (GRITTED) is reached at 100 cumulative 100%-sessions**, distributed across 20 tier-up events from RELAXED → GRITTED.
- R5b. **Pacing curve (locked 2026-05-05)** — front-loaded easy / back-loaded hard. Sessions required to advance from each tier to the next:

  | From → To | Sessions | Cumulative |
  |---|---:|---:|
  | RELAXED → BRUSHED | 1 | 1 |
  | BRUSHED → BARED | 1 | 2 |
  | BARED → BRANDISHED | 2 | 4 |
  | BRANDISHED → PRIMED | 2 | 6 |
  | PRIMED → PRESSED | 3 | 9 |
  | PRESSED → SQUEEZED | 3 | 12 |
  | SQUEEZED → LOCKED | 4 | 16 |
  | LOCKED → DUG | 4 | 20 |
  | DUG → DRIVEN | 5 | 25 |
  | DRIVEN → CLASPED | 5 | 30 |
  | CLASPED → CLENCHED | 5 | 35 |
  | CLENCHED → CLAMPED | 6 | 41 |
  | CLAMPED → WRENCHED | 6 | 47 |
  | WRENCHED → CALLOUSED | 6 | 53 |
  | CALLOUSED → HARDENED | 7 | 60 |
  | HARDENED → HALLOWED | 7 | 67 |
  | HALLOWED → GNAWED | 7 | 74 |
  | GNAWED → GNASHED | 8 | 82 |
  | GNASHED → BLOODIED | 8 | 90 |
  | BLOODIED → **GRITTED** | **10** | **100** |

  Rationale: first-week users get a satisfying climb (BRUSHED at session 1, BARED at session 2). Mid-game settles into a steady 4-7 per tier. Capstone GRITTED costs 10 sessions to give it final-boss weight. Total exactly 100 sessions to peak.

- R5c. **Tier multiplier values (locked 2026-05-05)** — moderate exponential, RELAXED ×1.00 → GRITTED ×3.00. Geometric curve with per-step ratio ≈ 1.0565 (i.e., 3^(1/20)). Each tier-up multiplies your consistency credit by ~5.65% over the previous tier:

  | Tier | Mult |
  |---|---:|
  | RELAXED | ×1.00 |
  | BRUSHED | ×1.06 |
  | BARED | ×1.12 |
  | BRANDISHED | ×1.18 |
  | PRIMED | ×1.25 |
  | PRESSED | ×1.32 |
  | SQUEEZED | ×1.39 |
  | LOCKED | ×1.47 |
  | DUG | ×1.55 |
  | DRIVEN | ×1.64 |
  | CLASPED | ×1.73 |
  | CLENCHED | ×1.83 |
  | CLAMPED | ×1.93 |
  | WRENCHED | ×2.04 |
  | CALLOUSED | ×2.16 |
  | HARDENED | ×2.28 |
  | HALLOWED | ×2.41 |
  | GNAWED | ×2.54 |
  | GNASHED | ×2.69 |
  | BLOODIED | ×2.84 |
  | **GRITTED** | **×3.00** |

  Rationale: smooth and predictable. Mid-tiers feel earned (×1.5-2.0). GRITTED at ×3.0 stacks meaningfully with compound (×1.5) and holiday windows for peak moments around ×4.5-6.0 — substantial but not number-inflation territory. Math is clean (true geometric, no clamp).
- R6. Within a tier, the per-session multiplier is constant (the tier value). The "ramp" is the tier-up flourish, not a within-tier crawl.
- R7. Tier crossings get a P5/Gurren rank-up flourish (kanji, color, animation) when the user enters a new named tier.
- R8. **Completion-threshold partial-credit rule** (refined 2026-05-05 to reconcile with R5a no-decay):
  - **<50% of planned sets completed** for a session → consistency multiplier for that day's XP is **0×** (combo "fizzles" for the session). Counter does NOT tick. Tier does NOT drop (R5a no-decay).
  - **≥50% but <100% completed** → consistency multiplier scales **linearly by completion percentage**: at 75% completion, 75% of the consistency contribution applies; at 50%, 50% applies. Other multipliers (compound/isolation, holiday, prestige) apply at **full strength regardless**. Counter does NOT tick. Tier does NOT drop.
  - **100% of planned sets completed** → full consistency multiplier credit, plus counter ticks +1 (advancing toward the next tier per R5a).
  - The completion percentage is computed from `sets_logged_today / sets_planned_today` (where "planned" = the attuned set count from the Attune Movements page).
- R8a. **End-of-day reckoning model**: per-set XP that is logged in real time credits the immediate stack contributions (compound/isolation, holiday, prestige). The **consistency contribution is deferred** and computed at end-of-day once the completion percentage is known — `day_consistency_contribution = (sum_of_day_base_XP) × consistency_mult × completion_pct` (where `completion_pct = 0` if <50%). This avoids per-set-rollback complexity and lets the user see the consistency reward as a clear end-of-session payoff. UX detail (how it appears in the per-set animation vs end-of-day animation) is an open question for planning.

**Prestige**
- R9. **Prestige loop (locked 2026-05-05)** — Galaxy-Spiral ribbon ascension:
  - **Trigger:** user must reach **GRITTED** (counter = 100) AND hold it for **20 additional sessions** (counter ≥ 120 cumulative 100%-sessions).
  - **Optional, not automatic:** once unlocked, the user is offered a choice on the prestige UI surface — **Ascend** (claim ribbon, reset counter to 0 / RELAXED, climb the ladder again) or **Hold** (keep GRITTED, ascend later — option remains available indefinitely). The user controls the loop pace.
  - **Ribbon reward:** each ascension grants one permanent **Galaxy-Spiral ribbon**. Ribbons stack visually on the stats / profile surface.
  - **Bonus magnitude:** each ribbon contributes **+0.10×** to `prestige_mult` under R2 (additive). After 5 ribbons (~600 sessions), prestige_mult = 0.5×; after 10 ribbons (~1200 sessions), prestige_mult = 1.0×. The ribbon bonus is permanent and rides on every set regardless of current tier, providing a baseline floor that grows with long-term commitment.
  - **Cycle length:** 100 sessions to GRITTED + 20 held = **120 sessions per ribbon**.

**Holiday Multiplier**
- R16. **Holiday list and tiered values (locked 2026-05-05)** — the `holiday_mult` contribution under R2 fires on these dates with the values shown. User has no control; the bonus auto-applies on the matching date.

  **Tier 1 — major (×1.5):**
  - User's birthday (per profile DOB)
  - New Year's Day (Jan 1)
  - Christmas (Dec 25)

  **Tier 2 — feast (×1.0):**
  - Independence Day (Jul 4)
  - Thanksgiving (4th Thursday in November)

  **Tier 3 — federal (×0.5):**
  - MLK Day (3rd Monday in January)
  - Presidents' Day (3rd Monday in February)
  - Memorial Day (last Monday in May)
  - Juneteenth (Jun 19)
  - Labor Day (1st Monday in September)
  - Columbus Day / Indigenous Peoples' Day (2nd Monday in October)
  - Veterans Day (Nov 11)

  Total: 11 federal holidays + birthday = **12 possible holiday days/yr per user**. If two holidays land on the same day (rare — e.g., birthday on Christmas), apply the higher tier only (no stacking within R2's holiday slot — though the user's higher-tier bonus is already strong).

**wger Licensing**
- R15. wger code is AGPLv3 (does not bind us — we don't use their code), data is CC-BY-SA. Compliance: a single attribution line in the **settings credits page** is sufficient. We don't redistribute the data, so ShareAlike doesn't bind.

**Visibility & UI**
- R17. The active-page nav stays clean — no constant multiplier display. The existing total XP bar is unchanged.
- R18. **Per-set cinematic reveal (locked 2026-05-05, R18a added 2026-05-06)** — when a set is logged, the XP-fly animation reveals the multiplier stack as a **sequential cinematic** (~1.2-1.5s total). Format reflects R2's additive contributions:

  ```
  +1,600 EXP                  ← base = entered_weight × repMult × reps (raw lift)
        ↓ HEAVY LIFT +1,280 EXP  ← R18a: only when REFERENCE_BW/user_BW > 1.0
  +2,880 EXP                  ← normalized base (rolls up before multipliers)
        ↓ BRANDISHED +1.18×
  +5,278 EXP                  ← consistency contribution adds (norm_base × 1.18)
        ↓ KING +1.75×
  +10,318 EXP                 ← class contribution adds (norm_base × 1.75)
        ↓ RIBBONS +0.20×
  +10,894 EXP                 ← prestige contribution adds (norm_base × 0.20)
  ────────────────────────────
  = +10,894 EXP TOTAL  🔥
  ```

  Each line flashes in turn, running total accumulates downward. Inactive multipliers (no holiday today, no prestige badges, RELAXED tier, REFERENCE_BW/user_BW ≤ 1.0) skip rendering — the cinematic shortens automatically. Holiday days insert a holiday line in tier 1/2/3 color.

  Stack is a moment, not a constant. The cinematic completes before the next set's UI accepts input — total time tuned so high-tempo logging never feels gated.

- R18a. **HEAVY LIFT bonus reveal (locked 2026-05-06)** — the cinematic shows a dedicated `🔥 HEAVY LIFT +N EXP` line between the raw base and the multiplier stack when the user's lift is heavy **relative to their bodyweight** AND/OR they benefit from R1a's strength-relative normalization. Combines two effects into one bonus line.

  **Computation:**
  ```
  raw_base        = entered_weight × repMult × reps      (or BW equivalent for bw exercises)
  norm_factor     = REFERENCE_BW / user_BW                (R1a normalization)
  relative_load   = bw_coefficient + entered_weight / user_BW
  heavy_lift_x    = max(0, relative_load - threshold) × scale
  combined_factor = norm_factor × (1 + heavy_lift_x)

  if combined_factor > 1:
    heavy_lift_bonus = raw_base × (combined_factor - 1)
  else:
    bonus = 0  (cinematic line hidden; normalization happens silently)
  ```

  **Per-exercise thresholds and class scales (locked 2026-05-06):**

  Each exercise has a `heavy_lift_threshold` (relative-load above which bonus fires) and a `heavy_lift_scale` (class-level multiplier on bonus magnitude). Calibrated to "advanced" 1RM levels per exercise family from strengthlevel.com / legionathletics.com strength standards. Stored in `lib/exerciseAliases.js` as `HEAVY_LIFT_THRESHOLDS` map (per-exercise) + `HEAVY_LIFT_CLASS_SCALES` (per-class).

  Class scales (multiplier on bonus magnitude): isolation **×1.5**, compound **×1.0**, king_compound **×0.7**. Isolation gets the biggest scale because relatively-heavy isolation lifts are rarer and more notable; King Compounds get the smallest because they already get a heavier `king_compound_mult` (1.75) on the Total XP track.

  Threshold examples: bench press = 1.5× BW; squat = 1.75× BW; deadlift = 2.0× BW; OHP = 1.0× BW; barbell row = 1.2× BW; pull-up (incl BW component) = 1.5× BW; leg press = 2.5× BW; DB curl = 0.45× BW; lateral raise = 0.4× BW; calf raise = 1.5× BW.

  **Symmetric across body weights:** a 200 lb user deadlifting 700 lb (3.5× BW) and a 100 lb user deadlifting 350 lb (3.5× BW) earn the same HEAVY LIFT bonus. Lighter users are not the only ones who can trigger it — what matters is the lift's relative load compared to the user's own bodyweight.

  **UI semantics:** the line displays only when `combined_factor > 1`. For users at/above 180 lb who don't hit their threshold, the line is hidden — their R1a normalization happens silently. Asymmetric UI by design: positive feedback when earned; no "penalty" callout for normalization-down.
- R19. The user infers per-region growth via the existing transmutation-circle star chart on the stats page. The compound/isolation/multiplier dynamics surface visually over time as some star points grow faster than others. Star awards from R11–R13 fire visually on the chart per set.
- R20. **Tier identity surface (locked 2026-05-05)** — the user's current tier name lives on the **profile page** as an identity tag directly under their display name (e.g., "Jordan H. — **BRANDISHED**"). The tag uses the tier's associated kanji + color treatment (per R7 rank-up styling). Galaxy-Spiral ribbons (R9) render as a row of icons immediately below the identity tag — earned ribbons fill in left-to-right; unearned slots are hidden until the first ribbon is claimed. The tier becomes part of the user's identity rather than a transient HUD element.
- R20a. **Tier progress detail** — the precise progress-bar to next tier ("3/7 sessions to HARDENED"), cumulative 100%-session count, and ribbon history live on the **stats page** alongside the existing transmutation-circle chart. Profile is the identity surface; stats is the analytic surface.

## Worked Math Examples

Defaults assumed: Consistency at IRON = 1.3, compound_mult = 1.5, isolation_mult = 1.2, prestige = 0, holiday = 0. wger primary/secondary 60/40 split.

**Example 1 — Bench press 135 × 10 (compound)**
- Base = 135 × repMult(10) × 10 = 135 × 1.0 × 10 = **1350**
- Total XP track: 1350 × 1.3 + 1350 × 1.5 = 1755 + 2025 = **+3780 to totalXP**
- wger weights aggregate (R10a — anterior delt now ARMS): FRONT 73% (chest + serratus) / ARMS 26% (anterior delt + triceps)
- Region star track (compound, cap+overflow): FRONT capped at 1★ (would have been 2★ at 73%); second star overflows to next-highest = ARMS (already at 26% raw, but compound rule limits to 1★ anyway). Result: **FRONT 1★ + ARMS 1★**

**Example 2 — Bicep curl 60 × 5 (isolation)**
- Base = 60 × repMult(5) × 5 = 60 × 1.0 × 5 = **300**
- Total XP track: 300 × 1.3 + 300 × 1.2 = 390 + 360 = **+750 to totalXP**
- wger weights: ARMS 100%
- Region star track (isolation, concentrate): only highest region (ARMS) earns stars. ARMS at 100% → 2★. Result: **ARMS 2★**

**Example 3 — Deadlift 315 × 5 (KING COMPOUND, current curated splits)**
- Base = 315 × repMult(5) × 5 = 315 × 1.0 × 5 = **1575**
- DEADLIFTS muscle split (locked): primary `[back]`, secondary `[glutes, hamstrings, abs]`. Per R10a region map: BACK 0.6 + 0.4/3 (hams) = 0.733 / LEGS 0.4/3 (glutes) = 0.133 / CORE 0.4/3 (abs) = 0.133.
- Region weights: BACK 73% / LEGS 13% / CORE 13%.
- Region star track (KING, top 3 regions × 1★): **BACK 1★ + LEGS 1★ + CORE 1★** (subject to R12c star floor).
- Total XP track at 200 lb user_BW with HARDENED tier (×2.28), 5 ribbons (0.50), no holiday: norm_factor = 0.952 (IPF GL); relative_load = 315/200 = 1.575× BW (above DL threshold 2.0? no — below). heavy_lift_x = 0. combined = 0.952. effective_base = 1500. Apply multipliers: 1500 × (1 + 2.28 + 1.75 + 0.50) = 1500 × 5.53 = **+8,295 EXP**.

**Example 3b — Squat 225 × 8 (KING COMPOUND, dual-semantics distribution)**
- Base = 225 × 1.0 × 8 = **1800**
- Total XP track: 1800 × 1.3 (consistency) + 1800 × **1.75** (king_compound_mult, larger than regular compound_mult) = 2340 + 3150 = **+5490 to totalXP**
- wger weights under R10a dual semantics:
  - Quads (FRONT) 60% (primary)
  - Glutes (LEGS) 8%, Hams (BACK) 8%, Erector (BACK) 8%, Abs (CORE) 8%, Calves (LEGS) 8%
- Aggregate: FRONT 60% / BACK 16% / LEGS 16% / CORE 8%
- Region star track (King Compound — top 3 regions × 1★): FRONT, BACK, LEGS (BACK and LEGS tied for slot 3, both within top 3 anyway)
- Result: **FRONT 1★ + BACK 1★ + LEGS 1★** (3 stars total) — squat grows front-of-body, back-of-body, AND the LEGS catch-all simultaneously. King reward.

**Example 3c — Deadlift 315 × 5 (KING COMPOUND, dual-semantics distribution)**
- Base = 315 × 1.0 × 5 = **1575**
- Total XP track: 1575 × 1.3 + 1575 × 2.0 = 2048 + 3150 = **+5198 to totalXP**
- wger weights under R10a dual semantics:
  - Glutes (LEGS) 20%, Hams (BACK) 20%, Erector (BACK) 20% (primaries — note hams + erector aggregate to BACK)
  - Quads (FRONT) 10%, Traps (BACK) 10%, Forearms (ARMS) 10%, Abs (CORE) 10% (secondaries)
- Aggregate: BACK 50% / LEGS 20% / FRONT 10% / ARMS 10% / CORE 10%
- Region star track (King Compound — top 3 regions × 1★): BACK, LEGS, then a 3-way tie at 10% for slot 3. Alphabetical tiebreak → ARMS.
- Result: **BACK 1★ + LEGS 1★ + ARMS 1★** (3 stars total) — deadlift grows back-of-body (hams/erector dominant), the leg catch-all (glutes), and ARMS (grip via forearms).

**Example 4 — Hip thrust (curated isolation under dual semantics)**
- wger weights under R10a dual semantics: glutes (LEGS) 60% / hams (BACK) 20% / quads (FRONT) 20%
- Auto-classify: not 100% one region → defaults compound. Curator override per R14: hip thrust is a glute isolation; the hams/quads involvement is incidental.
- Curator-override classification: **isolation**.
- Region star track (isolation, concentrate on highest = LEGS at 60%): LEGS 2★. Result: **LEGS 2★**

## "Compound = 2×1 stars, Isolation = 1×2 stars" Rule Audit

The cap-and-overflow rule (R12) + concentrate rule (R13) + 100% reclassification rule (R14) collectively force every exercise to satisfy the 2×1 / 1×2 ideal. Audit of canonical lifts:

| Lift | Class | Raw weights | Stars after rules |
|---|---|---|---|
| Bench press | compound | FRONT 73 / ARMS 26 | FRONT 1★ + ARMS 1★ ✓ |
| Squat | **KING COMPOUND** | FRONT 60 / BACK 16 / LEGS 16 / CORE 8 | FRONT 1★ + BACK 1★ + LEGS 1★ (3 stars, all top 3) |
| Deadlift | **KING COMPOUND** | BACK 50 / LEGS 20 / FRONT 10 / ARMS 10 / CORE 10 | BACK 1★ + LEGS 1★ + ARMS 1★ (3 stars; alphabetical tiebreak for slot 3) |
| Pull-up | compound | BACK 50 / ARMS 50 | BACK 1★ + ARMS 1★ ✓ |
| Overhead press | compound | ARMS 73 / BACK 13 / FRONT 13 | ARMS 1★ + (BACK or FRONT) 1★ ✓ |
| Bent-over row | compound | BACK 84 / ARMS 16 | BACK 1★ + ARMS 1★ ✓ |
| Lunge | compound | FRONT 60 / LEGS 16 / BACK 16 / CORE 8 | FRONT 1★ + (BACK or LEGS) 1★ ✓ |
| Romanian deadlift | **KING COMPOUND** | BACK 60 / LEGS 20 / FRONT 20 | BACK 1★ + LEGS 1★ + FRONT 1★ (3 stars) |
| Leg press | **KING COMPOUND** | FRONT 60 / LEGS 20 / BACK 20 | FRONT 1★ + LEGS 1★ + BACK 1★ (3 stars) |
| Hack squat | **KING COMPOUND** | FRONT 60 / LEGS 20 / BACK 20 | FRONT 1★ + LEGS 1★ + BACK 1★ (3 stars) |
| Hip thrust | compound | LEGS 60 / BACK 20 / FRONT 20 | LEGS 1★ + BACK 1★ (or FRONT) — no longer needs curator override; natural compound result |
| Calf raise | isolation (auto) | LEGS 100 | LEGS 2★ ✓ (calves all map to LEGS catch-all) |
| Glute kickback | isolation (auto) | LEGS 100 | LEGS 2★ ✓ |
| Hip abduction / adduction | isolation (auto) | LEGS 100 | LEGS 2★ ✓ |
| Leg curl | isolation (auto) | BACK 100 (hams) | BACK 2★ ✓ — hams now route to BACK under dual semantics |
| Leg extension | isolation (auto) | FRONT 100 (quads) | FRONT 2★ ✓ — quads now route to FRONT under dual semantics |
| Bicep curl | isolation | ARMS 100 | ARMS 2★ ✓ |
| Front raise | isolation (auto) | ARMS 100 (anterior delt) | ARMS 2★ ✓ |
| Lateral raise | isolation (curated) | ARMS 60 / BACK 40 | ARMS 2★ ✓ (curator override) |
| Reverse fly | isolation (curated) | ARMS 60 / BACK 40 | ARMS 2★ ✓ (curator override) |
| Pec deck | isolation (auto) | FRONT 100 | FRONT 2★ ✓ |
| Cable crossover | isolation (curated) | FRONT 70 / ARMS 30 | FRONT 2★ ✓ (curator override) |
| Hyperextension | compound | BACK 60 / LEGS 40 | BACK 1★ + LEGS 1★ (stay compound per Jordan) |
| DB pullover | compound | BACK 50 / FRONT 50 | BACK 1★ + FRONT 1★ (stay compound per Jordan) |
| Sit-up / crunch / Russian twist / deadbug / wood chopper / ab wheel etc. | isolation (curated) | CORE-dominant w/ stabilizer secondaries | CORE 2★ ✓ (curator override — all CORE-primary moves are isolation) |

## Scope Boundaries

- The existing `repMult(reps)` curve is unchanged. (The r=5 plateau quirk is documented; not for this brainstorm.)
- The Total XP / player-level threshold formula (`15000 + level × 1000`) is unchanged.
- The 5-region map (CORE / ARMS / LEGS / FRONT / BACK) is unchanged in structure.
- Express forge cycle path is untouched.
- The wger seed import process is in flight (`scripts/import-wger.js`, `scripts/wgerMap.js` already on dev as of 2026-05-03).

## Key Decisions

- **Combo trigger = completion consistency** — plan adherence is the engine.
- **Asymmetric breaking** — set-miss is forgiving (within-tier tick drop), day-miss is harsh (full tier drop or reset).
- **Layered build curve** — linear ramp within tiers + named tiers + overall exponential-with-cap shape + prestige loop. All four mechanics coexist.
- **Two parallel tracks** — Total XP is continuous and uses additive multipliers; Region stars are discrete and gated by wger weight bands.
- **Compound mult > isolation mult** in the additive total-XP stack.
- **Cap + overflow for compound** stars; **concentrate on primary** for isolation stars; **100%-one-region exercises curated as isolation**.
- **wger-seeded distribution** — each exercise has a region weight vector derived from wger primary/secondary data.
- **wger attribution in settings credits page — sufficient for license compliance.**
- **Visibility is moment-bound** — per-set popup animation reveals the breakdown briefly. No constant multiplier UI in the nav.

## Resolved Questions (historical record)

> All entries below are struck-through with the date and the resolution.
> No open questions remain as of 2026-05-06.

### Resolve Before Planning

- ~~[Affects R2] Specific multiplier values: consistency_mult / compound_mult / isolation_mult / king_compound_mult / prestige_mult / holiday_mult~~ — **resolved 2026-05-05/06**: consistency_mult is the 21-tier curve in R5c (×1.00 → ×3.00). king_compound_mult = 1.75. compound_mult = 1.5. isolation_mult = 1.2. prestige_mult = 0.10 per ribbon (additive). holiday_mult tiers locked in R16 (1.5 / 1.0 / 0.5).
- [Affects R6][User decision] How many sessions per tier? (How long does it take to climb NOVICE → IRON → STEEL → BLAZE → OVERDRIVE?)
- [Affects R8][User decision] Missed-day rule: full reset for ALL tiers, or full tier drop only (so OVERDRIVE → BLAZE on first miss, not 1.0× on first miss)?
- [Affects R8][User decision] Grace days / streak freezes? (Duolingo-style "1 free pass per month") or strict no-grace?
- [Affects R9][User decision] How many sessions at OVERDRIVE before prestige is available? Auto or opt-in?
- [Affects R12][User decision] Tie-breaking for overflow target when 2+ secondary regions have equal wger weight (squat: BACK 8 / CORE 8 — pick alphabetically? prefer narrow? prefer broad? split a fractional star?).
- [Affects R14][User decision — confirmed] Curator override roster (locked 2026-05-03): lateral raise → ARMS 2★; reverse fly → ARMS 2★; cable crossover → FRONT 2★; all CORE-primary moves (sit-up, crunch, Russian twist, wood chopper, deadbug, ab wheel, hanging leg raise, cable crunch, Pallof press, bird dog) → CORE 2★. Stay compound (no override): hyperextension, pullover, hip thrust. Auto-classify correctly (no override): bicep curl, leg curl, leg extension, calf raise, hip abduction, hip adduction, glute kickback, frog pump, pec deck, front raise, concentration curl, tricep extensions, hammer curl. King Compound tagged: squat / deadlift / leg press / hack squat + major variants per R12b.
- ~~[Affects R12b] `king_compound_mult` value~~ — **resolved 2026-05-05**: locked at **1.75** (modest premium over regular compound 1.5).
- [Affects R12b][User decision] Final list of King-tagged variants. Default proposed: back/front/sumo/paused squat, conventional/sumo/trap-bar/stiff-leg/RDL deadlift, standard/vertical leg press, barbell/machine hack squat. Single-leg variants NOT King.
- ~~[Affects R12] Tiebreak rule for compound second slot~~ — **resolved 2026-05-06**: hand-curated primary/secondary splits in MUSCLE_FIXUP eliminate ties; alphabetical fallback for any future-added exercises that re-introduce ties.
- ~~[Affects R1a] Curator-flagged bodyweight coefficient list~~ — **resolved 2026-05-06**: locked in `lib/exerciseAliases.js` `BW_COEFFICIENT` map across 38 of 41 bodyweight exercises (3 dropped as oddities). Pull-ups/dips = 1.00, standard push-ups = 0.65, decline = 0.75, incline/knee = 0.50, inverted row = 0.55, hanging ab = 0.50, floor ab work = 0.35, walking lunge = 0.85, Nordic curl = 0.90, etc. Default 1.00 for any unmapped BW entry. See R1a.
- ~~[Affects R1a] Where is `user_bodyweight` stored~~ — **resolved 2026-05-06**: capture at first-time onboarding flow; user can edit later in settings page. Field added to profile schema (verify exact field name during planning).
- ~~[Affects R1a] BW unset fallback~~ — **resolved 2026-05-06**: block logging — modal forces user to enter bodyweight before they can save the first BW-coefficient set. Guarantees correct XP from set #1.
- ~~[Affects R16] Which calendar holidays trigger? And what holiday_mult value(s)?~~ — **resolved 2026-05-05**: 11 US federal holidays + user birthday, tiered (1.5 / 1.0 / 0.5). See R16.
- [Affects R18][User decision] Exact format of the per-set popup multiplier breakdown text + any per-region star "pop" animation choreography.
- ~~[Affects all] Where the user views their current tier / ribbons (UI surface)~~ — **resolved 2026-05-05**: profile page hosts identity tag + ribbon row (R20). Stats page hosts progress bar + cumulative count + history (R20a).

### Deferred to Planning

- ~~[Affects R10] wger primary/secondary 60/40 weight split~~ — **resolved 2026-05-06**: 60/40 split is locked. Hand-curated primary/secondary lists per exercise (in `MUSCLE_FIXUP`) ensure the split produces unambiguous region weights. Curation overrode wger's default tagging entirely; the 60/40 ratio is now load-bearing design, not a placeholder.
- [Affects R10][Technical] Does wger expose compound/isolation classification directly, or do we need to compute? (Classification is curated per R14 anyway, but wger may give a useful default.)
- [Affects R13][Technical] Storage shape for per-exercise region weights and classification — bake into `lib/exerciseLibrary.js` at import time, or compute lazily?
- [Affects R12][Technical] When a compound's overflow target is itself <30% — does the overflow STILL fire and award 1 star to that low-weight region, or is the second star forfeited? (Current spec: overflow fires regardless of receiver's raw share. Confirm.)
- [Affects R8][Technical] Detection of "missed planned day" — scheduled day passed without `done-{cycleId}-{iso}` flag. Implementation detail.
- [Affects R16][Technical] Holiday detection — local-machine date check vs server-side?

## Where We Are in the Conversation

- ✅ Existing XP algo confirmed (base XP via `weight × repMult × reps`, 1:1 muscle→region today)
- ✅ Multi-region distribution will be derived from wger primary/secondary data
- ✅ wger licensing understood (settings-credits attribution sufficient)
- ✅ **Two-track model**: continuous Total XP via additive multipliers; discrete Region stars via wger weight bands
- ✅ **Compound mult > isolation mult** in the additive total stack
- ✅ **Star bands**: <30% → 0★, 30–59% → 1★, 60%+ → 2★
- ✅ **Cap + overflow rule** for compound stars, **concentrate rule** for isolation stars
- ✅ **Curated classification**: 100%-one-region → isolation by default; curator can override
- ✅ Math walkthroughs verified (bench, deadlift, bicep curl, hip thrust)
- ✅ **wger → region map uses dual semantics (R10a)**: upper-body uses torso-only (chest=FRONT, lats=BACK, all delts=ARMS); lower-body uses position-of-leg (quads=FRONT, hams=BACK, glutes/calves/adductors/abductors=LEGS). Same region IDs, dual interpretation. Squat now distributes FRONT 60 / BACK 16 / LEGS 16 (was LEGS 84). Deadlift now BACK-dominant (was LEGS-dominant). Leg press auto-classifies compound (was 100% LEGS iso under torso-only mapping). Front raise still auto-iso ARMS 100%.
- ✅ **Curator override roster (final)**: lateral raise + reverse fly → ARMS 2★ isolation; cable crossover → FRONT 2★ isolation; all CORE-primary moves (sit-up, crunch, Russian twist, wood chopper, deadbug, ab wheel, hanging leg raise, cable crunch, Pallof press, bird dog) → CORE 2★ isolation. Hyperextension, pullover, hip thrust stay compound (no override). Hip thrust dropped from override list under dual semantics + amended R12.
- ✅ **King Compound exception (R12b)**: squats / deadlifts / leg press / hack squat (and major variants — see R12b) award **3 stars** (top 3 wger-weight regions × 1★ each) AND use a bigger Total XP multiplier `king_compound_mult = 1.75` > `compound_mult = 1.5` (locked 2026-05-05).
- ✅ **Amended star rules**: drop band-triggered overflow. Compound = top 2 regions × 1★. King Compound = top 3 × 1★. Isolation = top 1 × 2★. R11 bands become advisory only.
- ✅ **Unilateral / bilateral DB rule**: bilateral-simultaneous DB exercises (DB curl, DB press, DB lateral raise) AND truly unilateral exercises (Bulgarian split squat, single-arm row, pistol squat) both get `xpMultiplier = 2` to match barbell-equivalent volume. Unilateral exercises are assumed to have both sides completed before counting one full set.
- ✅ **Neck and rotator cuff exercises**: NOT mapped to any region — those exercises are out of the curated library scope.
- ✅ **Bodyweight exercises (R1a)**: `effective_load = user_bodyweight × bw_coefficient + user_entered_weight`. Default coefficient 1.0 (full BW); curator-flagged exceptions (e.g., push-up ~0.64, dip ~0.85) lower it for exercises where actual moved load is less than full BW. Weighted-BW variants (weighted pull-up, weighted dip, vest squat) naturally work via the `+ user_entered_weight` term.
- ✅ Asymmetric break: missed-set tick drop (forgiving), missed-day tier drop (harsh)
- ✅ Build curve: layered (linear within tiers + named tiers + exponential-cap shape + prestige loop)

**Next session — resume here:**

Newly settled (2026-05-04 session):
- ✅ Completion-threshold rule (R8 refined): <50% = combo reset; 50–99% = combo preserved with consistency mult scaled linearly by completion%; 100% = full credit. Only consistency mult scales — others apply at full strength.
- ✅ End-of-day reckoning model (R8a): per-set XP credits non-consistency contributions immediately; consistency contribution is computed at end-of-day once completion% is known.
- ✅ Bodyweight load rule (R1a): `effective_load = user_BW × bw_coefficient + entered_weight`; default coefficient 1.0; curator-flagged exceptions for push-up/dip etc.
- ✅ Partial-day tier advancement model (Hybrid): 100% advances, 75–99% maintains, 50–74% may drop one tier, <50% resets.

**Tier counter mechanic resolved (2026-05-05):** option 3 (cumulative 100%-sessions, no decay). Peak (GRITTED) at **100 cumulative 100%-sessions**. See R5a above for full rule and R8 for reconciliation with the partial-credit semantics.

**Tier names locked (2026-05-05 session, third pin)** — 21-tier teeth-grip ladder, all past-tense forms, all read as "[verb] teeth":

| Tier | Name | Notes |
|---|---|---|
| 1 | **RELAXED** | baseline — no multiplier (×1.0), combo dormant |
| 2 | **BRUSHED** | barely contact |
| 3 | **BARED** | display / intent |
| 4 | **BRANDISHED** | wielded with menace (medieval weapon vibe) |
| 5 | **PRIMED** | loaded and ready, predator coiled |
| 6 | **PRESSED** | sustained pressure |
| 7 | **SQUEEZED** | compressed |
| 8 | **LOCKED** | held fast |
| 9 | **DUG** | engaged deeply |
| 10 | **DRIVEN** | forced in (active force) |
| 11 | **CLASPED** | firm-gentle hold |
| 12 | **CLENCHED** | committed closure |
| 13 | **CLAMPED** | firm closure |
| 14 | **WRENCHED** | extreme twisting force |
| 15 | **CALLOUSED** | toughened by repeated stress |
| 16 | **HARDENED** | firmed up |
| 17 | **HALLOWED** | sanctified by battle |
| 18 | **GNAWED** | sustained tearing motion |
| 19 | **GNASHED** | struggle / anguish |
| 20 | **BLOODIED** | battle-marked, post-fight |
| 21 | **GRITTED** | peak — won't give |

The tier names match the app's "Gritted Teeth" identity end-to-end — every tier reads naturally as "[verb] teeth." Vocabulary mixes physical-grip mechanics, transformation/state-of-being words (HARDENED-family), and medieval/weapon imagery (BRANDISHED, HALLOWED). Multiplier values per tier are locked in **R5c** (geometric ×1.00 → ×3.00 curve).

**All product/algo decisions resolved as of 2026-05-06.** Brainstorm is ready for `/ce:plan`.

## Next Steps

→ Brainstorm is locked. Run `/ce:plan` to turn this into a step-by-step implementation plan.
