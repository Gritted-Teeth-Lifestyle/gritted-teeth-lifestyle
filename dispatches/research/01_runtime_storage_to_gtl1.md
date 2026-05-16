# Research dispatch — gtl1 — XP runtime + storage layer

**This is a READ-ONLY research task.** Do not edit any source files. Your output is a single committed findings file.

## Context

King is writing the implementation plan for the Combo EXP Multiplier System. The locked spec lives at `dispatches/2026-05-03-gtl-combo-exp-multiplier-requirements.md` and the King handoff at `dispatches/KING_HANDOFF_combo_exp.md`. Read both before starting so you know what the new system needs.

I need you to deeply read the **current** code (not the new spec) so the plan can wire new behavior on top of real call-sites.

## Questions to answer

For each, give specific repo-relative paths (`path/to/file.js:line-or-component`) for every claim. Read the actual source — don't speculate.

### Q1. Current XP calculation path

- Where is per-set XP computed today? Function name + file + line.
- Where is `repMult(reps)` (or its equivalent) defined?
- How does the result propagate: → Total XP counter? → per-region counters?
- Trace the call chain end-to-end from "user logs a set on the active page" → "XP credited to state."
- Note: the brainstorm calls out the formula `weight × repMult(reps) × reps` and a 5-region map (CORE/ARMS/LEGS/FRONT/BACK). Confirm both still match reality.

### Q2. Profile schema + persistence

- Where is profile data stored? localStorage key names? IndexedDB? Server?
- What fields exist today on the profile?
- How is profile read/written? Show the exact API of `lib/storage.js` `pk()` profile-key helper (referenced in the project CLAUDE.md).
- Is there a `useProfileGuard()` hook (referenced in CLAUDE.md)? Where does it live, what does it do?

### Q3. Session / cycle / completion model

- How is a "planned session" represented? Where do "planned sets" live (Attune Movements page output)?
- What is the `done-{cycleId}-{iso}` flag pattern? Where does it get written and read?
- How is daily completion currently detectable: i.e., what state confirms "all planned sets for today are logged"?
- Is there a notion of "session start / session end" or only set-level events?

### Q10. Existing combo / multiplier stubs

- Search the codebase for: `combo`, `multiplier`, `consistency`, `tier`, `GRITTED`, `prestige`, `ribbon`, `streak`. Report any partial work or stubs already on dev. (We need to know what's net-new vs already started.)
- If nothing exists yet, say so explicitly.

## Output

Write your findings to `dispatches/research/01_runtime_storage_findings.md`.

Structure:
```markdown
# 01 — XP runtime + storage layer (gtl1 research)

## Q1. Current XP calculation path
[findings with file:line refs]

## Q2. Profile schema + persistence
[findings]

## Q3. Session / cycle / completion model
[findings]

## Q10. Existing combo / multiplier stubs
[findings]
```

Then commit and push:

```
git add dispatches/research/01_runtime_storage_findings.md
git commit -m "Research: XP runtime + storage layer findings (gtl1)"
git push origin dev
```

## DO NOT

- Edit any source files (`app/`, `components/`, `lib/`).
- Speculate beyond what's in the code — if a question can't be answered from current code, say "not present in code as of HEAD."
- Write more than ~1500 words total. Specificity over volume.
- Skip the file:line refs.

## Done when

The findings file is committed and pushed to `origin/dev`. Reply with the commit hash.
