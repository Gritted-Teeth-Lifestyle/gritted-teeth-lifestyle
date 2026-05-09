# Blocker: Profile schema UI — validation, copy, NumberRow shape, DOB on iOS

**Worker:** gtl1
**Affects:** R1a (BW prerequisite), R16 (DOB → birthday), Wave 1 commit 2 (profile schema). Plan Unit 1 explicitly defers these to "King to spec exact validation rules and unit handling" + "King to supply one short brand-voice line."

**Question:** Four sub-decisions are needed to build the WARRIOR DATA settings section + onboarding step + BW modal gate without making discretionary calls:

### 4a. Bodyweight input validation bounds + unit handling

The plan suggests `integer 60-500 lb`. Confirm or adjust:

- **Lower bound** — 60 lb? 80 lb? Reject below as nonsense.
- **Upper bound** — 500 lb? 700 lb?
- **Step / decimals** — integer-only, or 0.5 lb / 1 decimal allowed?
- **Unit** — lb only, or also kg with a toggle? (Brainstorm + dispatch use lb everywhere; sticking with lb-only is simplest.)

### 4b. NumberRow component shape

No existing text/number input form-row component exists in `app/settings/page.js` (only `Toggle`, `VolumeSlider`, `DangerButton` per gtl3 research findings Q7). New component needed. Two viable shapes:

1. **New shared `components/settings/NumberRow.jsx`** — matches existing clip-path/typography (`bg-gtl-surface border-gtl-edge px-5 py-4`, polygon clip-path, font-mono uppercase label). Props `{label, value, unit, onChange, min, max, step}`. Used 1× initially for BW; future-proof for any other numeric setting.
2. **Inline within `app/settings/page.js`** — paste the markup directly, mirroring the inlined BGM slider at `:394-412`. Less abstraction, no future reuse.

### 4c. SexToggle component shape

Binary M/F default M. Two options:

1. **`components/settings/SexToggle.jsx`** — new pill toggle (two side-by-side buttons, selected one highlighted) matching existing `DangerButton` aesthetic.
2. **Reuse existing `Toggle` (`app/settings/page.js:42-63`)** with label "MALE / FEMALE" — boolean with M=false / F=true. Cheap but semantically odd.

### 4d. DOB input — `<input type="date">` on iOS PWA standalone

Memory `project_gtl_ios_pwa_keyboard.md` documents iOS PWA standalone keyboard quirks. Native `<input type="date">` opens the iOS date wheel, which generally works in standalone but with caveats. Three options:

1. **Native `<input type="date">`** — simplest. iOS native picker. May need same `inputMode/enterKeyHint` recipe as the keyboard fix.
2. **Custom 3-spinner picker (year / month / day)** — heavy. Matches the rest of GTL's bespoke aesthetic but is hours of UI work for an optional field.
3. **Defer DOB entirely from Wave 1** — birthday holiday (R16) is in gtl2's `holidays.js`, which can default to "no birthday" until DOB capture lands later.

### 4e. BodyweightStep + BodyweightModal copy

Plan: "King to supply one short brand-voice line." Need:

- **Onboarding BodyweightStep** — headline + sub-line + button text + placeholder.
- **BW Modal gate** — headline + body line + input placeholder + submit button text + (no dismiss button, modal is non-skippable).

Tone: GTL voice is brutal-poetic, all caps, brand-anchored ("FORGED WITH GRITTED TEETH"). Examples elsewhere: "WHO ARE YOU", "PRESS START", "WAR RECORD".

**Candidate answers (consolidated):**

1. **Tight defaults** — 60-500 lb integer, NumberRow + SexToggle (new components), native date input, copy I draft in GTL voice. Fastest forward path; King overrides anything wrong on review.
2. **Conservative defaults** — same UI components but defer DOB entirely (option 4d.3); skip birthday holiday until a follow-up.
3. **King supplies all five answers** — I implement to spec verbatim. Slowest but safest, matches no-discretion protocol literally.

**Recommendation:** Option 3 for 4a + 4e (validation bounds + copy are pure judgment calls Jordan should make). Option 1 for 4b + 4c (NumberRow + SexToggle as new shared components — matches existing repo abstraction style). Option 2 for 4d (defer DOB; gtl2 holidays.js defaults to no-birthday; revisit when Jordan asks for it). **But not committing to any of these without confirmation per protocol.**

**What's blocked:** Wave 1 commit 2 (profile schema). Commits 1, 3, 4, 5, 6 do NOT depend on these answers — I can proceed with them in parallel once the test-framework blocker is resolved. Commit 2 holds.

## Resolution

Jordan: "ok" → accept all worker recommendations.

**4a. BW validation:** integer, **60-500 lb**, **lb-only** (no kg toggle), no decimals.

**4b. NumberRow:** new shared `components/settings/NumberRow.jsx` matching existing clip-path/typography vocabulary. Props `{label, value, unit, onChange, min, max, step}`.

**4c. SexToggle:** new shared `components/settings/SexToggle.jsx` — two-button pill toggle (M / F), selected one highlighted, default M. Don't reuse `Toggle` (semantically odd to encode sex as boolean).

**4d. DOB:** **DEFER**. No DOB input in Wave 1. gtl2's `holidays.js` handles `userDOB === null/undefined` by skipping the birthday check (already in their dispatch). Revisit when Jordan asks.

**4e. Copy** (GTL voice — caps, brutal-poetic, brand-anchored):

**Onboarding BodyweightStep** (inline in profile creation flow):
- Headline: `DECLARE YOUR WEIGHT`
- Sub-line: `STRENGTH IS RELATIVE TO YOUR FRAME`
- Input placeholder: `LBS`
- Button: `FORGE ON`

**BW Modal gate** (blocks first BW-coefficient set save until BW captured):
- Headline: `STATE YOUR FRAME`
- Body line: `THE FORGE WEIGHS THE LIFT. THE LIFT WEIGHS THE LIFTER.`
- Input placeholder: `LBS`
- Submit button: `CONFIRM`
- Modal is non-dismissible without entering a valid value (60-500 lb integer).

If Jordan dislikes any copy on review, ship it as-is — easy single-line edit in a follow-up.

Resume Wave 1 commit 2 (profile schema).
