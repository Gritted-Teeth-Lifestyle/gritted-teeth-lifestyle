# Research dispatch — gtl2 — UI surfaces (stats / active / profile pages)

**This is a READ-ONLY research task.** Do not edit any source files. Your output is a single committed findings file.

## Context

King is writing the implementation plan for the Combo EXP Multiplier System. The locked spec lives at `dispatches/2026-05-03-gtl-combo-exp-multiplier-requirements.md` and the King handoff at `dispatches/KING_HANDOFF_combo_exp.md`. Read both before starting so you know what the new system needs.

I need you to deeply read the **current** code so the plan can extend the right components rather than rebuilding them.

## Questions to answer

For each, give specific repo-relative paths (`path/to/file.js:line-or-component`) for every claim. Read the actual source — don't speculate.

### Q4. Transmutation-circle star chart on the stats page

- Which file renders it? Component name.
- How are the 5-region star awards wired in today (if at all)? Even if just 0★/1★/2★ display, document the data shape it consumes.
- What's the visual treatment for a region earning a star — is there an existing animation, or is it a static state?
- Where would per-set star awards from R12 / R12b / R13 fire visually? Identify the integration point.

### Q5. Per-set XP-fly animation choreography on the active page

- Which file/component handles it? Animation timing model (durations, sequence)?
- What state triggers it (which dispatched action, which prop change)?
- Can it be extended to a sequential cinematic ~1.2-1.5s with the R18 line-by-line reveal (base → HEAVY LIFT → consistency → class → prestige), or would it need a parallel new component? Recommend which.
- Note any iOS PWA gotchas already documented in the file (timers, RAF, mix-blend layers, etc.).

### Q9. Profile page layout

- Where does the user's profile page render? File path.
- What's the current layout (sections, order, styling pattern)?
- Where would the **tier identity tag** + **Galaxy-Spiral ribbon row** attach (R20)? Identify the slot directly under the display name.

## Output

Write your findings to `dispatches/research/02_ui_surfaces_findings.md`.

Structure:
```markdown
# 02 — UI surfaces (gtl2 research)

## Q4. Transmutation-circle star chart
[findings with file:line refs]

## Q5. Per-set XP-fly animation
[findings]

## Q9. Profile page layout
[findings]
```

Then commit and push:

```
git add dispatches/research/02_ui_surfaces_findings.md
git commit -m "Research: UI surfaces findings (gtl2)"
git push origin dev
```

## DO NOT

- Edit any source files.
- Build proof-of-concept components.
- Write more than ~1500 words total. Specificity over volume.
- Skip the file:line refs.

## Done when

The findings file is committed and pushed to `origin/dev`. Reply with the commit hash.
