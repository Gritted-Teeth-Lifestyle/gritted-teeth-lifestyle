---
date: 2026-05-02
topic: gtl-exercise-library
---

# GTL Curated Exercise Library

## Problem Frame

The Attune Movements feature picker (`components/attune/PickerSheet.jsx`) is muscle-locked and pulls from `lib/exerciseLibrary.js`, which currently holds a placeholder of ~4 exercises per muscle (44 total). For real use, the picker needs to feel like a comprehensive, professional reference — every common exercise for the chosen muscle, alphabetized, with cross-listing under all muscles a movement meaningfully trains. The same library will eventually power the cross-muscle drag confirm flow and the replace cascade. This brainstorm scopes a one-time expansion.

## Requirements

- **R1.** The library is comprehensive — covers every common strength exercise for each of the 11 GTL muscles (chest, shoulders, back, forearms, quads, hamstrings, calves, biceps, triceps, glutes, abs).

- **R2.** Each exercise is **cross-listed under every muscle it trains as a primary OR secondary mover**. (Example: Deadlift appears under back, glutes, and hamstrings; not under forearms even though grip is involved.)

- **R3.** Within each muscle's list, exercises are sorted **alphabetically by label** (no primary/secondary tier in the display).

- **R4.** Each exercise carries an **equipment tag** drawn from the wger taxonomy: `barbell`, `dumbbell`, `cable`, `machine`, `bodyweight`, `band`, `kettlebell`, `other`.

- **R5.** Each row in the picker shows a **small equipment glyph** next to the label (e.g. mini icon or 1-2 char abbreviation). User scans visually for "is this barbell or dumbbell?" without reading.

- **R6.** Each exercise has an **`aliases` array** of lifting-shorthand names (e.g. `['DL']` for Deadlift, `['RDL']` for Romanian Deadlift, `['OHP']` for Overhead Press). The search input matches against label OR any alias, case-insensitive substring.

- **R7.** Library is **seeded from wger** (wger.de, CC-BY-SA open-source workout database). Initial import covers wger's strength catalog mapped to GTL's 11-muscle ontology.

- **R8.** Public surface from `lib/exerciseLibrary.js` continues to expose `exercisesByMuscle(muscleId)`, `canonicalExerciseFor(muscleId)`, `searchExercises(muscleId, query)` — existing Attune callers must not require changes.

- **R9.** Existing `Exercise` shape `{ id, label, muscle }` extends to `{ id, label, muscles: string[], equipment: string, aliases: string[] }`. The `muscle` singular field stays as a backward-compatible alias for `muscles[0]` so existing consumers don't break.

- **R10.** Auto-attune (`canonicalExerciseFor`) returns a stable, deterministic pick per muscle — one canonical compound movement (e.g. SQUAT for quads, BENCH PRESS for chest). Picked at curation time, not derived from data.

## Success Criteria

- Opening the picker on any muscle day shows a long, alphabetized scrollable list of real movements the user would actually consider doing for that muscle. No placeholder shortlist feel.
- Typing a 2-3 character lifting shorthand (DL, RDL, OHP, BBR, CGBP) in search returns the matching exercise immediately.
- Same exercise (e.g. Deadlift) appears under all of its trained muscles. User on glutes day sees Deadlift in the list; user on back day sees it too.
- Equipment glyph is visible next to every label. User can scan for "I want to find the dumbbell options."
- No regression on Attune feature: chip add, drag, replace, auto-attune all continue to work identically.

## Scope Boundaries

- **Out**: User-add-custom-exercise flow (locked from prior brainstorm — curated only).
- **Out**: Equipment FILTER UI on the picker (the metadata is stored + glyph is shown, but no toggle yet — deferred).
- **Out**: Cardio, stretches, plyometrics, mobility work (wger includes these; we import only the strength catalog).
- **Out**: Per-exercise instructional content, video links, form cues, recommended rep ranges, source attribution display in-app.
- **Out**: Internationalization. Labels are English only (wger has translations; we keep English).
- **Out**: User-customizable aliases. Aliases are part of the curated data; user can't add their own.
- **Out**: Difficulty level, compound vs isolation tag, experience level filter. The library is just labels + muscles + equipment + aliases.

## Key Decisions

- **Comprehensive over curated**: Jordan's framing is "every exercise that has ever existed for that muscle" — the goal is reference-grade coverage, not a curated shortlist. Aligns with how serious lifters use exercise libraries (browse for variants when programming).
- **wger over hand-curate or scrape**: CC-BY-SA license, ~400 strength exercises with primary/secondary muscle data and equipment tags already structured. Hand-curating hundreds is impractical; ExRx scrape is gray-area legality. wger is the right balance.
- **Multi-muscle attribution = primary + secondary, not all-worked**: matches Jordan's Deadlift example. Excluding tertiary stabilizers (forearms-from-grip) keeps each muscle's list focused on movements that meaningfully train it.
- **Alphabetical, not primary-first**: simplest mental model. User scans by name. No two-tier ranking inside each muscle's list.
- **Equipment metadata stored AND surfaced visually**: data is cheap to keep; visible glyph adds zero per-row complexity for real benefit. Future-ready for equipment filter without committing to one now.
- **Backward-compatible Exercise shape**: keep `muscle` singular as `muscles[0]` alias so existing Attune consumers (`addChip`, log-set screen) don't need migration — only adds fields.

## Dependencies / Assumptions

- wger's exercise dataset is downloadable via JSON dump or REST API — confirmed via wger.de/api/v2/exercise/ public endpoint.
- wger uses an internal muscle ID system; mapping wger muscle IDs → GTL's 11 muscle keys (chest, shoulders, back, forearms, quads, hamstrings, calves, biceps, triceps, glutes, abs) is a one-time hand-mapped lookup table.
- wger's strength category filter excludes cardio / stretches / mobility cleanly.
- CC-BY-SA attribution requirement: include "Exercise data: wger.de (CC-BY-SA 4.0)" somewhere appropriate in the repo (LICENSE-thirdparty.md or equivalent).

## Outstanding Questions

### Resolve Before Planning

(none — all product decisions resolved.)

### Deferred to Planning

- [Affects R7][Technical] Should the wger import be a one-time script run by a developer (output committed to `lib/exerciseLibrary.js` as a static export), OR a build-time fetch (pulls fresh on every `npm run build`)? Static is simpler and reproducible; build-time fetch keeps in sync with wger updates but adds a network dependency to builds.
- [Affects R7][Technical] Where does the import script live — `scripts/import-wger.js` at repo root? What's its run command (`npm run import:exercises`)?
- [Affects R5][Technical] Equipment glyph rendering: tiny SVG icons inline, single-character abbreviations (`B` / `D` / `C` / `M` / `b` / `K`), or unicode symbols? Match GTL's existing icon vocabulary.
- [Affects R6][Needs research] wger's data — does it already include common aliases, or do aliases need to be hand-added in a post-import step? May need to scan wger output and pattern-match common shortenings vs maintain a separate hand-curated alias overlay.
- [Affects R2][Needs research] wger's primary/secondary muscle distinction — does it cleanly map to GTL's 11 muscles, or are there cases where wger lumps multiple (e.g. "core" includes abs + obliques)? Mapping table will need iteration.
- [Affects R10][Needs research] What's the canonical exercise per muscle? List of 11 picks needed at curation time.

## Next Steps

→ `/ce:plan` for structured implementation planning
