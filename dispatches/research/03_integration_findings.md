# 03 — Integration points (gtl3 research)

Read-only repo audit at HEAD `c397e26` (origin/dev). All claims grounded
in current source.

## Q6. Exercise library access pattern

**Public API surface (`lib/exerciseLibrary.js`)** — only four exports:

- `ALL_EXERCISES` (raw array) — `lib/exerciseLibrary.js:7`
- `exercisesByMuscle(muscleId)` — `lib/exerciseLibrary.js:4647`
- `canonicalExerciseFor(muscleId)` — `lib/exerciseLibrary.js:4651`
- `searchExercises(muscleId, query)` — `lib/exerciseLibrary.js:4661`

There is **no `getExerciseById` helper.** Internally the file builds
`_ALL = ALL_EXERCISES.map(_withMuscle)` (`:4631`) — this `_ALL` is
**not exported**, only the raw `ALL_EXERCISES` is. `canonicalExerciseFor`
does an inline `_ALL.find(e => e.id === target && …)` (`:4654`) for its
own lookup; that is the only by-id `.find()` in the file.

**Plan implication:** the new XP runtime needs an O(1) by-id lookup
once per logged set. Add `getExerciseById(id)` backed by a memoized
`Map` over `ALL_EXERCISES` — gives `calculateSetXP(set, exercise, …)`
per handoff §3 a stable hook.

**Current consumers in app code (only three call-sites):**

- `components/attune/PickerSheet.jsx:37` — `import { searchExercises }` ;
  used at `:97` to filter the picker list.
- `components/attune/AutoAttuneButton.jsx:3,25` — `import { canonicalExerciseFor }` ;
  passed by reference into `autoAttuneAll(cycleId, dayMuscleMap, canonicalExerciseFor)`.
- `lib/attunement.js:284,291` — `autoAttuneAll` accepts the function via
  DI and calls `canonicalExerciseFor(muscle)` per muscle to pick a
  default chip.

**No app-code consumer reads `primaryMuscles` / `secondaryMuscles`
today.** Verified via grep across `app/**` and `components/**` for
`.primaryMuscles`, `.secondaryMuscles`, `.is_king_compound`,
`.is_isolation_override`, `.heavy_lift_threshold`, `.heavy_lift_scale`,
`.bw_coefficient` — **zero hits in app code**. Only references are in
`lib/exerciseAliases.js` (curation source), `scripts/import-wger.js`
(generator), `scripts/build_heavy_lift_thresholds.py`, and the auto-gen
`lib/exerciseLibrary.js` itself.

**Field presence audit on the committed library:**

| Field | Entries | Expected | Match |
|---|---:|---|---|
| `primaryMuscles` | 263 | all | ✓ |
| `heavy_lift_threshold` | 263 | all (R18a) | ✓ |
| `heavy_lift_scale` | 263 | all (R18a) | ✓ |
| `bw_coefficient` | 38 | only `equipment === 'bodyweight'` (handoff: "38 of 41") | ✓ |
| `is_king_compound` | 18 | handoff: "18 King Compounds" | ✓ |
| `is_isolation_override` | 13 | handoff: "the 13 R14 overrides" | ✓ |
| `aliases`, `equipment` | 263 | all | ✓ |

Auto-generated header `lib/exerciseLibrary.js:1-5` confirms 263
exercises last imported `2026-05-03T07:05:23.744Z`. **No re-import
needed** — and per the dispatch DO NOT, `npm run import:exercises`
would hit the live wger network and risk producing committed-file
drift, so I did not run it.

**Call-sites to update once the new system lands:**

1. **New** — `calculateSetXP` (lib, currently does not exist; closest
   today is the inline `repMult(reps)` and the `weight × mult × reps`
   reduction in `app/fitness/active/[iso]/[muscleId]/page.js:2638-2676`
   inside `computeTotalXP()`). Will need `getExerciseById(id)` to read
   `primaryMuscles`, `secondaryMuscles`, `is_king_compound`,
   `is_isolation_override`, `heavy_lift_threshold`, `heavy_lift_scale`,
   `bw_coefficient`, `equipment`.
2. **New per-set cinematic** (UI) — wherever the existing XP-fly
   animation fires per-set on the active page; reads the same fields
   to render R18 multiplier stack lines + R18a HEAVY LIFT line.
3. **`computeTotalXP` rewrite** — `app/fitness/active/[iso]/[muscleId]/page.js:2644-2677`
   currently re-derives lifetime XP at read time from raw reps/weights
   only (no exercise lookup, no `repMult` weight gating beyond reps).
   Under R1a/R2 this needs the per-exercise `bw_coefficient` and
   `heavy_lift_threshold`/`scale`, which means it must go through
   `getExerciseById`. (Worth raising in plan: the recompute-from-raw
   approach won't survive the new algo — needs persisted per-set XP
   snapshots, since multipliers depend on `tier` / `ribbons` / `holiday`
   at the moment of the set.)
4. **Star-track region resolver** (new) — also keyed off `primaryMuscles`
   / `secondaryMuscles` (via the R10a dual-semantics map → 60/40 split →
   top-N regions). Reads `is_king_compound` (top 3) vs
   `is_isolation_override` (top 1, 2★) vs default compound (top 2).

## Q7. Settings page structure

**File:** `app/settings/page.js` (single-component page, 530 lines).
Subpage at `app/settings/music/page.js` for BGM track picker.

**Sections in `SettingsPage()` (top to bottom):**

- Header — `app/settings/page.js:360-383` ("ENTRY POINT / 00", warrior name)
- AUDIO — `:386-415` (SFX volume slider, BGM volume slider, BG music toggle)
- BGM TRACK — `:419-442` (Link to subpage)
- HAPTICS — `:445-452` (vibration toggle)
- DEFAULTS — `:455-468` (preferences-only reset)
- DANGER ZONE — `:471-497` (reset profile data, delete profile)
- **CREDITS — `:499-515`** (currently only mentions Jordan, Alexander Thuku, P5+Gurren)

**Form-row components available:**

- `Toggle({ label, value, onChange })` — `:42-63` (boolean ON/OFF)
- `VolumeSlider({ value, onChange, onPreview })` — `:65-87`
  (label hardcoded to "SFX VOLUME"; the BGM slider at `:394-412` is
  inlined rather than reusing `VolumeSlider` because the label diverges)
- `DangerButton({ label, armedLabel, onConfirm })` — `:89-127`
  (two-tap arm/confirm pattern, used 3× in DANGER + once in DEFAULTS)

**Pattern for adding `user_bodyweight` / `user_sex` / DOB:**

There is **no existing text-input or numeric-input form-row component**
in this file. The only `<input>` elements are the two `type="range"`
sliders. So adding R1a's `user_bodyweight` (lb) is a new component —
either:

- mirror the inline-slider pattern (`:395-411`) but with `type="number"`,
  or
- introduce a new `NumberRow({ label, value, unit, onChange })` matching
  the existing clip-path / typography vocabulary (`bg-gtl-surface
  border-gtl-edge px-5 py-4`, `polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)`,
  `font-mono text-[11px] tracking-[0.3em] uppercase`).

For `user_sex` (binary male/female default male per R1a + handoff §1),
a two-button toggle group fits the existing `DangerButton` /
`Toggle` pill aesthetic. For DOB (R16 birthday holiday), a `<input
type="date">` works but iOS PWA standalone has known keyboard quirks
(see memory `project_gtl_ios_pwa_keyboard.md`); plan should call out
testing the date picker on standalone iOS.

The new fields slot most naturally as a new section between HAPTICS
(`:452`) and DEFAULTS (`:455`) — header e.g. "WARRIOR DATA" or
"PROFILE" — so they stay near the top of the page where editable
warrior state already lives.

**Storage:** profile fields are pk()-scoped via `lib/storage.js:8-15`.
Suggested keys: `pk('user-bodyweight')` → `gtl-{profile}-user-bodyweight`,
`pk('user-sex')`, `pk('user-dob')`. (Note: `gtl-active-profile` and
`gtl-profiles` are intentionally **not** pk()-scoped — they're the
profile registry itself, see `app/settings/page.js:141`.)

**Existing CREDITS section (R15 wger attribution target):**

Currently at `app/settings/page.js:499-515`. The card today reads:

```
GRITTED TEETH LIFESTYLE
BUILT BY JORDAN HILLMAN
WITH ALEXANDER THUKU
INSPIRED BY PERSONA 5 + GURREN LAGANN
FORGED WITH GRITTED TEETH
```

A single new line such as `EXERCISE DATA — WGER (CC-BY-SA 4.0)` (and
optionally a `<Link>` to `https://wger.de/`) lands here. R15 says
"single attribution line in the **settings credits page**" — this is
the page, this is the section. **No separate credits/about/attributions
page exists today** — `app/settings/music/page.js` is the only
sub-route. The attribution does already exist at the repo level in
`LICENSE-thirdparty.md` (root), but that file is not surfaced in the
running app.

## Q8. Onboarding flow

**There is no profile-level first-time-onboarding component.** Profile
creation is a single-screen form at `app/fitness/page.js` ("IDENTITY /
01" / "WHO ARE YOU"). New profiles are created by typing a name into the
input at `app/fitness/page.js:402-469` and submitting — `handleSubmit`
(`:307-321`) writes the name to `gtl-profiles`, sets `gtl-active-profile`,
and calls `selectProfile(name)`, which routes to `/fitness/hub` via
HeistTransition.

There is no profile object schema today — just a string in the
`gtl-profiles` array plus profile-scoped localStorage keys via `pk()`
(`lib/storage.js:8-15`). Adding `user_bodyweight` / `user_sex` / DOB
means three new pk()-scoped keys, not a profile-object refactor.

**Profile-incomplete gate pattern:** `lib/useProfileGuard.js:5-14`. Every
fitness sub-page calls `useProfileGuard()` (verified in
`app/fitness/active/page.js`, `app/fitness/active/[iso]/page.js`,
`app/fitness/active/[iso]/[muscleId]/page.js`, `app/fitness/edit/page.js`,
`app/fitness/ghost/page.js`, `app/fitness/ghost/active/page.js`,
`app/fitness/hub/page.js`, `app/fitness/load/page.js`,
`app/fitness/new/*` and `app/fitness/stats/page.js`). The guard's only
check today is `if (!localStorage.getItem('gtl-active-profile'))
router.replace('/fitness')` — i.e., "no active profile → bounce to
identity page." It does **not** currently check whether bodyweight/sex
are set.

**Closest precedent for a one-shot blocking onboarding modal:**
`components/attune/FirstTimeInstructionPopup.jsx` (lines 1-90). Persists
its dismissal on `localStorage.gtl-attune-onboarding-seen` (note:
intentionally **not** pk()-scoped per the comment at `:5-7`, "global per
device, not per profile"). Mounted from `app/attune/page.js` (referenced
at `app/attune/page.js:12`). Pattern: full-screen `position: fixed,
inset: 0`, dimmed backdrop, centered card with one CTA, dismiss by tap
or button.

**Where the BW capture step slots in (R1a says "captured at first-time
onboarding"; "BW unset fallback: block logging — modal forces user to
enter bodyweight before they can save the first BW-coefficient set",
KING_HANDOFF_combo_exp.md §1-2):**

Two complementary slots — both probably wanted:

1. **Inline at profile creation** — `app/fitness/page.js` `handleSubmit`
   (`:307-321`), in the `isNew` branch (`:312-316` — first time the
   trimmed name is added to `gtl-profiles`). After
   `localStorage.setItem('gtl-profiles', …)` and before
   `selectProfile(name)`, push the user into a BW capture step
   (could be a new sub-route `/fitness/onboarding` or an inline modal).
   This is the happy-path R1a "captured at first-time onboarding."

2. **Modal blocking gate at first BW-coefficient set** — backstop for
   imported / pre-existing profiles that never had BW captured
   (everyone today). Easiest hook: extend `useProfileGuard()`
   (`lib/useProfileGuard.js:5-14`) into `useProfileGuard({ requireBW: true })`,
   or add a sibling `useBodyweightGuard()` that fires on routes where
   sets get logged (the active page tree: `app/fitness/active/**`).
   The modal itself can mirror `FirstTimeInstructionPopup`'s
   `position:fixed, inset:0` shape but with a number input + submit
   instead of a dismiss button. R1a says specifically "block logging
   — modal forces user to enter bodyweight before they can save the
   first BW-coefficient set," so the gate fires lazily at the first
   BW-coefficient exercise's set-save (`app/fitness/active/[iso]/[muscleId]/page.js`),
   not on every active-page mount — open question for plan to decide
   whether this granularity is worth the complexity vs. eager gate on
   first active-page mount.

**Note:** the BW modal is **non-dismissible without entering a value**
(R1a). Use `gtl-{profile}-user-bodyweight` presence itself as the
"captured" signal — no separate `*-onboarding-seen` flag needed, and
each profile is gated independently for free.

## R15 wger attribution

Confirmed slot: existing `app/settings/page.js:499-515` CREDITS section.
Add one line. No new page or section needed; mirror the existing
typography (`font-matisse text-[10px] tracking-[0.25em] uppercase
text-gtl-ash leading-relaxed`). The data-level attribution already
lives at repo root (`LICENSE-thirdparty.md`); R15 specifies the
in-app surface.
