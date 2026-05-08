# Research dispatch — gtl3 — integration points (library + settings + onboarding)

**This is a READ-ONLY research task.** Do not edit any source files. Your output is a single committed findings file.

## Context

King is writing the implementation plan for the Combo EXP Multiplier System. The locked spec lives at `dispatches/2026-05-03-gtl-combo-exp-multiplier-requirements.md` and the King handoff at `dispatches/KING_HANDOFF_combo_exp.md`. Read both before starting so you know what the new system needs.

I need you to deeply read the **current** code so the plan knows where new fields and flows attach.

## Questions to answer

For each, give specific repo-relative paths (`path/to/file.js:line-or-component`) for every claim. Read the actual source — don't speculate.

### Q6. Exercise library access pattern

- How do consumers read from `lib/exerciseLibrary.js`? Is there a `getExerciseById` (or equivalent) helper?
- Where do per-exercise fields like `primaryMuscles` / `secondaryMuscles` get used today? List call-sites.
- The library entries already have these fields (per the handoff): `primaryMuscles`, `secondaryMuscles`, `equipment`, `bw_coefficient`, `is_king_compound`, `is_isolation_override`, `heavy_lift_threshold`, `heavy_lift_scale`, `aliases`. Confirm they're all present and populated. Run the existing import if needed (`npm run import:exercises`) — but only if it's a no-op rebuild that doesn't change committed files.
- Identify which call-sites will need updating to start consuming `is_king_compound` / `heavy_lift_threshold` / `bw_coefficient` once the new system lands.

### Q7. Settings page structure

- Where does the settings page live (file path, component)?
- What's the pattern for adding a new field (e.g., `user_bodyweight`, `user_sex`, DOB)? Is there an existing form-row component to mirror?
- Is there an existing credits / about / attributions section where a wger attribution line (R15) can land? Or do we need to add one?

### Q8. Onboarding flow

- Is there a first-time-user onboarding component? Where? What's the flow?
- What's the "if profile is incomplete" gate pattern (e.g., redirect, modal, blocking screen)?
- Where would the BW capture step slot in (R1a says BW must be captured before the first set is logged)?

### R15 wger attribution

- Confirm where a single attribution line will live. (Settings credits page is the brainstorm's intent.)

## Output

Write your findings to `dispatches/research/03_integration_findings.md`.

Structure:
```markdown
# 03 — Integration points (gtl3 research)

## Q6. Exercise library access pattern
[findings with file:line refs]

## Q7. Settings page structure
[findings]

## Q8. Onboarding flow
[findings]

## R15 wger attribution
[findings]
```

Then commit and push:

```
git add dispatches/research/03_integration_findings.md
git commit -m "Research: integration points findings (gtl3)"
git push origin dev
```

## DO NOT

- Edit any source files.
- Run `npm run import:exercises` if it would touch committed files. Inspect-only.
- Write more than ~1500 words total. Specificity over volume.
- Skip the file:line refs.

## Done when

The findings file is committed and pushed to `origin/dev`. Reply with the commit hash.
