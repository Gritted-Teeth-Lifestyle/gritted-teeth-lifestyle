---
title: "feat: GTL Curated Exercise Library (wger-seeded)"
type: feat
status: active
date: 2026-05-02
origin: dispatches/2026-05-02-gtl-exercise-library-requirements.md
---

# feat: GTL Curated Exercise Library (wger-seeded)

**Target repo:** `gritted-teeth-lifestyle`. Workers should mirror the conventions used by sibling features (e.g., `lib/storage.js`, `lib/bgmTracks.js`, `lib/attunement.js`) rather than treat the file paths in this plan as absolute.

## Overview

Expand `lib/exerciseLibrary.js` from a 44-exercise placeholder to a comprehensive, wger-seeded catalog (~400 exercises) covering every common strength movement for GTL's 11 muscles. Each exercise is multi-muscle attributed, equipment-tagged, and search-aliased. The Attune Movements picker (`components/attune/PickerSheet.jsx`) renders the data as an alphabetized scrollable list with a small equipment glyph next to each label. The library's public API surface (`exercisesByMuscle`, `canonicalExerciseFor`, `searchExercises`) stays backward-compatible so the existing Attune feature, the in-the-moment picker on `/fitness/active`, and any log-set screen consumers continue working without migration.

## Problem Frame

GTL's Attune feature picker currently shows ~4 placeholder exercises per muscle. Real users will perceive that as a stub, not a tool. The library needs reference-grade coverage so opening the picker on any muscle day produces a long, browsable list of every common variant. The same library powers (1) the Attune picker, (2) the `/fitness/active` in-the-moment picker for empty days, (3) the cross-muscle drag confirm flow, and (4) the Replace cascade scope. This plan builds the seed-once-and-curate path and ships the import + data + UI glyph in one feature.

(See origin: `dispatches/2026-05-02-gtl-exercise-library-requirements.md`)

## Requirements Trace

Carries forward all 10 requirements from the origin document:

- **R1** Comprehensive coverage of every common strength exercise per muscle
- **R2** Cross-listed under primary + secondary muscles only (not tertiary stabilizers)
- **R3** Alphabetized within each muscle's list
- **R4** Equipment tagged: `barbell` / `dumbbell` / `cable` / `machine` / `bodyweight` / `band` / `kettlebell` / `other`
- **R5** Small equipment glyph next to each picker row label
- **R6** Aliases array for lifting shorthand (DL, RDL, OHP, BBR, CGBP, etc.); search matches label OR alias
- **R7** Seeded from wger.de (CC-BY-SA 4.0), strength catalog only (no cardio / stretch / mobility)
- **R8** Public API surface unchanged: `exercisesByMuscle(muscleId)` / `canonicalExerciseFor(muscleId)` / `searchExercises(muscleId, query)`
- **R9** Exercise shape extends to `{ id, label, muscles: string[], equipment: string, aliases: string[] }`; `muscle` singular kept as alias for `muscles[0]` for backward compat
- **R10** `canonicalExerciseFor(muscle)` returns a hand-picked stable canonical compound per muscle, deterministic

## Scope Boundaries

- **Out**: User-add-custom-exercise flow (locked — curated only).
- **Out**: Equipment FILTER toggle on the picker (metadata stored + glyph shown, but no toggle yet).
- **Out**: Cardio, stretches, plyometrics, mobility (filter out at import).
- **Out**: Per-exercise instructional content, video links, form cues, recommended rep ranges.
- **Out**: Internationalization. English labels only.
- **Out**: User-customizable aliases. Curated only.
- **Out**: Difficulty / experience level / compound vs isolation tags. Just labels + muscles + equipment + aliases.
- **Out**: Wger API live polling at runtime. One-time import committed to repo.

## Context & Research

### Relevant Code and Patterns

- **`lib/exerciseLibrary.js`** (current placeholder) — the file being replaced. Key invariants to preserve: ID == uppercase label string (matches existing log-set screen storage keys for backward compat), three exported functions, factory `toExercise(label, muscle)` shape.
- **`lib/storage.js`** — `pk()` profile-scoped keys; reference for module organization style.
- **`lib/bgmTracks.js`** — precedent for a static exported array of objects with `id` keys; mirror its export style.
- **`lib/attunement.js`** — precedent for a stable cached snapshot pattern (relevant for the eventual selectors that read from this library).
- **`app/fitness/active/page.js`** lines 31–43 — the inline `EXERCISES` constant currently used by the log-set screen. After this feature lands, the inline constant should DELEGATE to `exercisesByMuscle()` (or be deleted if all callers use the library directly). Out of scope for this plan but flagged as a follow-up.
- **`components/attune/PickerSheet.jsx`** — the consumer rendering exercise rows. Equipment glyph is a small visual addition here.
- **`scripts/`** dir already exists (currently holds `generate_solid_silhouette.py`). New script `scripts/import-wger.js` lives there.

### Institutional Learnings

- **Profile-scoped storage stays `pk()`-based.** This library is read-only at runtime — no `pk()` involvement here, but anything that READS chip exerciseIds from localStorage continues to use `pk()`.
- **GTL's data files use ES module exports**, not CommonJS. The import script generates ESM-compatible output.
- **Mobile-only viewport.** The equipment glyph must be readable at 390×844 — use 11–13px or larger.

### External References

- **wger API**: `https://wger.de/api/v2/exercise/?language=2&status=2&limit=200` (English, accepted-status, paged). Returns `{ id, name, description, category, muscles[], muscles_secondary[], equipment[] }` per exercise. Categories include `Arms`, `Legs`, `Abs`, `Chest`, `Back`, `Shoulders`, `Calves`. Strength-only filter: include only the standard 7 strength categories; exclude `Cardio`.
- **wger muscle IDs**: 15 in total (1=Biceps, 2=Anterior deltoid, 3=Serratus anterior, 4=Pectoralis major, 5=Triceps brachii, 6=Rectus abdominis, 7=Gastrocnemius, 8=Gluteus maximus, 9=Trapezius, 10=Quadriceps femoris, 11=Biceps femoris, 12=Latissimus dorsi, 13=Brachialis, 14=Obliquus externus abdominis, 15=Soleus). Mapping to GTL's 11 keys is hand-built (see Unit 1).
- **wger equipment IDs**: 8 in total (1=Barbell, 3=Dumbbell, 4=Gym mat, 7=Bench, 8=SZ-Bar, 9=Pull-up bar, 10=none [bodyweight], 11=Bodyweight). Map to GTL's 8-value enum (see Unit 2).
- **License**: CC-BY-SA 4.0 — attribution required. Add `LICENSE-thirdparty.md` referencing wger.

## Key Technical Decisions

- **Static one-time import, output committed to repo.** Decision over build-time fetch. Rationale: reproducible builds (no network at build time), auditable changes via git diff, no runtime API dependency, offline development. Cost: requires re-running script when wger updates (manual decision when to refresh, ~once per year).
- **Exercise ID == uppercase label string.** Same convention as existing placeholder. Critical: existing user data in localStorage stores chips with `exerciseId: "BARBELL BENCH PRESS"`. Changing the ID convention would orphan existing chips. Import script normalizes wger names to uppercase; collisions disambiguated with parenthetical suffix (e.g. `BENCH PRESS (DECLINE)`).
- **Multi-muscle attribution via array; backward compat via singular alias.** `muscles: ['back', 'glutes', 'hamstrings']` is canonical; `muscle: 'back'` is computed at object creation as `muscles[0]` for any consumer that still reads the singular field. Filtering by muscle: `exercisesByMuscle(m) = ALL.filter(e => e.muscles.includes(m))`.
- **wger primary + secondary, not all-worked.** The import script reads wger's `muscles[]` (primary) AND `muscles_secondary[]` and folds both into the GTL `muscles[]` array on the Exercise. Excludes anything wger doesn't explicitly tag — keeps tertiary stabilizer noise out (matches origin R2).
- **wger muscle fold-down**: 15 wger IDs → 11 GTL keys. Fold rules:
  - `obliquus externus` → `abs`
  - `serratus anterior` → drop (no GTL key)
  - `gastrocnemius` + `soleus` → `calves`
  - `trapezius` → `back`
  - `anterior deltoid` → `shoulders`
  - `brachialis` → `biceps`
  - `pectoralis major` → `chest`
  - `latissimus dorsi` → `back`
  - `gluteus maximus` → `glutes`
  - `quadriceps femoris` → `quads`
  - `biceps femoris` → `hamstrings`
  - Forearms: wger doesn't have a clean tag — handled via the alias overlay (Unit 4 manually flags exercises like `WRIST CURL`, `REVERSE WRIST CURL`, `FARMER CARRY` to add `forearms`).
- **Equipment fold-down**: wger 8 IDs → GTL 8 enum:
  - `barbell` ← Barbell, SZ-Bar
  - `dumbbell` ← Dumbbell
  - `bodyweight` ← Bodyweight, none, Pull-up bar (when used as bodyweight), Gym mat
  - `cable` ← (wger has no cable category; manually flagged via override JSON)
  - `machine` ← Bench (when standalone), other gym equipment
  - `kettlebell` ← (wger has no kettlebell category; manually flagged via override JSON)
  - `band` ← (wger has no band category; manually flagged via override JSON)
  - `other` ← anything unmapped
- **Aliases curated as a separate overlay file.** `lib/exerciseAliases.js` exports a `Record<exerciseId, string[]>` mapping. The import script reads it at run time and merges. Decoupled from wger so aliases survive re-imports.
- **Equipment glyph: single uppercase letter pill.** `B` `D` `C` `M` `b` (lowercase = bodyweight) `K` `R` (band) `?` (other). 1-char mono in a small clip-path chip on the right side of each picker row. Avoids SVG icon sprite complexity; matches GTL's existing chip vocabulary (e.g. MuscleChip in `app/fitness/active/page.js`).
- **No bundler-time codegen.** The script writes `lib/exerciseLibrary.js` as a hand-readable file with a "// Auto-generated by scripts/import-wger.js — do not edit by hand" header. Workers can spot-fix by re-running the script.

## Implementation Units

Six dependency-ordered units. Two units (4, 5) can run parallel with the foundation work; Unit 6 is independent.

### Unit 1 — wger ID mapping table + canonical picks

**File:** `scripts/wgerMap.js` (new)

Pure JavaScript module exporting two constants:

```js
// wger muscle ID → GTL muscle key (or null to drop)
export const WGER_MUSCLE_MAP = {
  1: 'biceps',
  2: 'shoulders',
  3: null,         // serratus anterior — drop (no GTL key)
  4: 'chest',
  5: 'triceps',
  6: 'abs',
  7: 'calves',
  8: 'glutes',
  9: 'back',       // trapezius folds into back
  10: 'quads',
  11: 'hamstrings',
  12: 'back',      // lats fold into back
  13: 'biceps',    // brachialis folds into biceps
  14: 'abs',       // obliques fold into abs
  15: 'calves',    // soleus folds into calves
}

// wger equipment ID → GTL equipment enum
export const WGER_EQUIPMENT_MAP = {
  1: 'barbell',
  3: 'dumbbell',
  4: 'bodyweight',  // gym mat ≈ bodyweight floor work
  7: 'machine',     // bench
  8: 'barbell',     // SZ-bar (EZ curl bar) ≈ barbell variant
  9: 'bodyweight',  // pull-up bar
  10: 'bodyweight', // none
  11: 'bodyweight',
}

// Canonical exercise per muscle for canonicalExerciseFor()
// Hand-picked stable defaults — these IDs MUST appear in the imported data
// or the function falls back to the first alphabetical exercise.
export const CANONICAL_EXERCISE = {
  chest:      'BENCH PRESS',
  shoulders:  'OVERHEAD PRESS',
  back:       'BARBELL ROW',
  forearms:   'WRIST CURL',
  quads:      'SQUAT',
  hamstrings: 'ROMANIAN DEADLIFT',
  calves:     'STANDING CALF RAISE',
  biceps:     'BARBELL CURL',
  triceps:    'SKULL CRUSHER',
  glutes:     'HIP THRUST',
  abs:        'PLANK',
}
```

**Acceptance:**
- File exports the three constants exactly as named.
- All 11 GTL muscle keys appear as values in `WGER_MUSCLE_MAP` (except where intentionally null).
- All 11 GTL muscle keys appear as keys in `CANONICAL_EXERCISE`.

**Owner:** Worker A.
**Depends on:** nothing.

---

### Unit 2 — wger import script

**File:** `scripts/import-wger.js` (new)

Node.js script that fetches wger, transforms, and writes `lib/exerciseLibrary.js`. Run via `npm run import:exercises` (added to `package.json` scripts).

```js
// scripts/import-wger.js
import fs from 'node:fs'
import { WGER_MUSCLE_MAP, WGER_EQUIPMENT_MAP, CANONICAL_EXERCISE } from './wgerMap.js'
import { EXERCISE_ALIASES } from '../lib/exerciseAliases.js'   // produced by Unit 4

const WGER_API = 'https://wger.de/api/v2/exercise/?language=2&status=2&limit=400'

async function fetchAll() { /* paginated GET, returns flat array */ }

function normalizeName(raw) {
  // strip HTML, decode entities, uppercase, collapse whitespace, strip
  // brackets and parentheticals (keep meaningful disambiguators)
  return raw.replace(/<[^>]+>/g, '').toUpperCase().trim()
}

function transform(wgerEntries) {
  const seen = new Set()  // track ID collisions
  const out = []
  for (const w of wgerEntries) {
    if (!isStrengthCategory(w.category)) continue
    const id = normalizeName(w.name)
    const dedupedId = seen.has(id) ? `${id} (${w.id})` : id
    seen.add(dedupedId)

    const muscles = []
    for (const wm of [...w.muscles, ...w.muscles_secondary]) {
      const gtl = WGER_MUSCLE_MAP[wm]
      if (gtl && !muscles.includes(gtl)) muscles.push(gtl)
    }
    if (muscles.length === 0) continue  // unmapped, skip

    const equipment = inferEquipment(w.equipment)  // first match via WGER_EQUIPMENT_MAP, default 'other'
    const aliases = EXERCISE_ALIASES[dedupedId] || []

    out.push({ id: dedupedId, label: dedupedId, muscles, equipment, aliases })
  }

  // Apply forearms overlay (Unit 4) — adds 'forearms' to specific exercise IDs
  // that wger doesn't tag for forearms but Jordan considers forearm work.

  // Apply manual equipment overrides for cable / kettlebell / band exercises
  // wger doesn't categorize.

  return out.sort((a, b) => a.label.localeCompare(b.label))
}

function writeLibrary(exercises) {
  const header = `// AUTO-GENERATED by scripts/import-wger.js — do not edit by hand.\n// Source: wger.de exercise database (CC-BY-SA 4.0)\n// Re-run with: npm run import:exercises\n\n`
  const data = `export const ALL_EXERCISES = ${JSON.stringify(exercises, null, 2)}\n\n`
  const api = fs.readFileSync('./scripts/exerciseLibrary.template.js', 'utf8')
  fs.writeFileSync('./lib/exerciseLibrary.js', header + data + api)
}

const data = await fetchAll()
const transformed = transform(data)
writeLibrary(transformed)
console.log(`Imported ${transformed.length} exercises across ${new Set(transformed.flatMap(e => e.muscles)).size} muscles`)
```

Plus a small template file `scripts/exerciseLibrary.template.js` containing the exported function bodies (`exercisesByMuscle`, `canonicalExerciseFor`, `searchExercises`, plus the `muscle: muscles[0]` backward-compat layer). The generator concatenates `ALL_EXERCISES` data + template functions into the final `lib/exerciseLibrary.js`.

**Acceptance:**
- `npm run import:exercises` runs without error and writes `lib/exerciseLibrary.js`.
- Output file is hand-readable (formatted JSON, sorted alphabetically).
- ~300–500 exercises (depends on wger's current catalog).
- Every exercise has at least one muscle in `muscles[]`.
- No exercise ID collisions in the output.
- Filter excludes wger's `Cardio` category cleanly.

**Owner:** Worker A.
**Depends on:** Unit 1 (mapping table). Unit 4 (alias overlay) is read at script run time but not at code-write time, so Worker B can write Unit 4 in parallel.

---

### Unit 3 — Library API rewrite + backward-compat shape

**File:** `lib/exerciseLibrary.js` (rewritten by Unit 2's script; the FUNCTION BODIES come from `scripts/exerciseLibrary.template.js`)

```js
// scripts/exerciseLibrary.template.js (function-body half of generated file)

import { CANONICAL_EXERCISE } from '../scripts/wgerMap.js'

// Backward-compat layer: every exercise gets a `muscle` field === muscles[0]
// so older consumers reading the singular field continue working.
const _withMuscle = (e) => ({ ...e, muscle: e.muscles[0] })
const _ALL = ALL_EXERCISES.map(_withMuscle)

export function exercisesByMuscle(muscleId) {
  return _ALL.filter(e => e.muscles.includes(muscleId))
}

export function canonicalExerciseFor(muscleId) {
  const target = CANONICAL_EXERCISE[muscleId]
  if (target) {
    const found = _ALL.find(e => e.id === target && e.muscles.includes(muscleId))
    if (found) return found.id
  }
  // fallback: first alphabetical exercise for the muscle
  const list = exercisesByMuscle(muscleId)
  return list[0]?.id || null
}

export function searchExercises(muscleId, query) {
  const list = exercisesByMuscle(muscleId)
  if (!query) return list
  const q = query.trim().toLowerCase()
  return list.filter(e =>
    e.label.toLowerCase().includes(q) ||
    e.aliases.some(a => a.toLowerCase().includes(q))
  )
}
```

The template file is the SOURCE OF TRUTH for the function bodies. The script concatenates `ALL_EXERCISES` data + this template into `lib/exerciseLibrary.js` on import.

**Acceptance:**
- All three public functions return the same SHAPES as before (Exercise objects with `id`, `label`, `muscle` plus new fields `muscles`, `equipment`, `aliases`).
- `e.muscle === e.muscles[0]` for every Exercise — backward-compat verified.
- `exercisesByMuscle('back')` returns Deadlift (after import).
- `exercisesByMuscle('glutes')` ALSO returns Deadlift — multi-muscle attribution working.
- `searchExercises('chest', 'DB')` returns dumbbell-tagged chest exercises if any have 'DB' in alias; doesn't crash on empty query.
- `canonicalExerciseFor('chest')` returns `'BENCH PRESS'` (or whatever exact string ended up in the data after normalization).

**Owner:** Worker A.
**Depends on:** Unit 2.

---

### Unit 4 — Alias overlay file (parallel)

**File:** `lib/exerciseAliases.js` (new)

Hand-curated map exercise ID → array of common abbreviations. Starter set ~30–50 of the most common lifting shorthand. Workers can grow over time.

```js
// lib/exerciseAliases.js
// Hand-curated abbreviations for the search box.
// Search input matches label OR any alias substring (case-insensitive).
// Add entries freely as you learn what users type.

export const EXERCISE_ALIASES = {
  'DEADLIFT':                  ['DL'],
  'ROMANIAN DEADLIFT':         ['RDL'],
  'STIFF-LEG DEADLIFT':        ['SLDL'],
  'OVERHEAD PRESS':            ['OHP', 'STRICT PRESS'],
  'BARBELL ROW':               ['BBR', 'BENT-OVER ROW'],
  'CLOSE-GRIP BENCH PRESS':    ['CGBP'],
  'BENCH PRESS':               ['BP', 'BENCH'],
  'INCLINE BENCH PRESS':       ['INCLINE BP'],
  'INCLINE DUMBBELL PRESS':    ['IDP'],
  'BARBELL CURL':              ['BBC'],
  'DUMBBELL CURL':             ['DBC'],
  'TRICEP PUSHDOWN':           ['PUSHDOWN'],
  'PULL-UP':                   ['PU', 'CHIN-UP'],
  'CHIN-UP':                   ['CU', 'PULL-UP'],
  'LAT PULLDOWN':              ['LPD', 'PULLDOWN'],
  'BULGARIAN SPLIT SQUAT':     ['BSS'],
  'GLUTE-HAM RAISE':           ['GHR'],
  'NORDIC CURL':               ['NORDIC'],
  'STANDING CALF RAISE':       ['SCR'],
  'SEATED CALF RAISE':         ['SCR-SEATED'],
  'HIP THRUST':                ['HT', 'BARBELL HIP THRUST'],
  'HACK SQUAT':                ['HS'],
  'LEG PRESS':                 ['LP'],
  'LEG EXTENSION':             ['LE'],
  'LEG CURL':                  ['LC', 'HAMSTRING CURL'],
  'AB WHEEL ROLLOUT':          ['ABWR', 'AB WHEEL'],
  'HANGING LEG RAISE':         ['HLR'],
  'CABLE CROSSOVER':           ['CC'],
  'CABLE FLY':                 ['CF'],
  'PLANK':                     ['FRONT PLANK'],
  'SIDE PLANK':                ['SP'],
  'LATERAL RAISE':             ['LR', 'SIDE RAISE'],
  'FACE PULL':                 ['FP'],
  // FORE-ARM SECTION — also adds these IDs to the forearms muscle list at import time
  'WRIST CURL':                ['WC'],
  'REVERSE WRIST CURL':        ['RWC'],
  'FARMER CARRY':              ['FARMER WALK'],
  'HAMMER CURL':               ['HC'],
}

// Forearms overlay — exercises that train forearms but wger doesn't tag.
// Import script adds 'forearms' to muscles[] for each ID listed here.
export const FOREARMS_OVERLAY = [
  'WRIST CURL',
  'REVERSE WRIST CURL',
  'HAMMER CURL',
  'FARMER CARRY',
]

// Equipment overrides — wger doesn't categorize cable / kettlebell / band.
// Import script overrides equipment for IDs in these maps.
export const EQUIPMENT_OVERRIDE = {
  'CABLE CROSSOVER':       'cable',
  'CABLE FLY':             'cable',
  'CABLE ROW':             'cable',
  'TRICEP PUSHDOWN':       'cable',
  'FACE PULL':             'cable',
  'LAT PULLDOWN':          'cable',
  // Workers grow this list as wger items appear in the imported data.
}
```

**Acceptance:**
- File exports `EXERCISE_ALIASES`, `FOREARMS_OVERLAY`, `EQUIPMENT_OVERRIDE`.
- ~30+ alias entries to start.
- Consumed by Unit 2's import script via direct import.

**Owner:** Worker B.
**Depends on:** nothing (parallel with Worker A).

---

### Unit 5 — Equipment glyph in PickerSheet

**File:** `components/attune/PickerSheet.jsx` (modified — locate the exercise-row render block, add glyph)

Add a small monospace pill on the right side of each exercise row showing a single-character equipment indicator.

```jsx
const EQUIPMENT_GLYPH = {
  barbell:    'B',
  dumbbell:   'D',
  cable:      'C',
  machine:    'M',
  bodyweight: 'b',
  kettlebell: 'K',
  band:       'R',
  other:      '·',
}

// Inside the exercise-row JSX:
<div className="flex items-center justify-between gap-3 ...existing...">
  <span className="...existing label classes...">{ex.label}</span>
  <span
    className="font-mono text-[10px] tracking-wide px-1.5 py-0.5 bg-gtl-edge text-gtl-ash leading-none shrink-0"
    style={{ clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)' }}
    aria-hidden="true"
    title={ex.equipment}
  >
    {EQUIPMENT_GLYPH[ex.equipment] || '·'}
  </span>
</div>
```

**Acceptance:**
- Each exercise row in the picker shows the glyph on the right side.
- Glyph renders at 10–12px monospace, matches surrounding GTL chip aesthetic.
- `title` attribute exposes the full equipment name on hover (desktop).
- `aria-hidden="true"` keeps screen readers from announcing the single character (the picker label already has full info).

**Owner:** Worker B.
**Depends on:** Unit 3 (needs `equipment` field in the Exercise shape; until Unit 3 lands, picker shows `·` fallback for every row, which is fine).

---

### Unit 6 — License attribution

**File:** `LICENSE-thirdparty.md` (new at repo root)

```markdown
# Third-party content attribution

## Exercise data

The exercise library in `lib/exerciseLibrary.js` is derived from the
[wger Workout Manager](https://wger.de/) exercise database, which is
licensed under [Creative Commons Attribution-ShareAlike 4.0
International (CC-BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).

Modifications: muscle attribution mapped to the GTL 11-muscle ontology;
equipment tags normalized; exercise names uppercased and sorted; aliases
hand-curated.

The derived data in this repository is also distributed under CC-BY-SA 4.0.

Source: <https://wger.de/api/v2/exercise/>
Import script: `scripts/import-wger.js`
```

Plus a one-line addition to `README.md` (or wherever third-party attribution is conventionally noted) pointing to `LICENSE-thirdparty.md`.

**Acceptance:**
- File exists at repo root.
- README references it.

**Owner:** Worker A (or Worker C if 3-way split kept; tiny enough to roll into Worker A).
**Depends on:** nothing.

---

## System-Wide Impact

### Interaction Graph

`exercisesByMuscle()` is called from:
- `components/attune/PickerSheet.jsx` (Attune picker — primary consumer)
- `components/attune/PickerSheet.jsx` in `mode='in-the-moment'` from `app/fitness/active/page.js` (Worker C's earlier work on the empty-day picker)
- `lib/attunement.js` `autoAttuneAll()` calls `canonicalExerciseFor()` for each muscle (via the `canonicalExerciseFor` parameter passed in)

After this feature lands, the `EXERCISES` constant in `app/fitness/active/page.js` (lines 31–43) becomes redundant — flagged as a follow-up cleanup, not part of this plan.

### Error & Failure Propagation

- **Import script failure** (network down, wger 500): script exits with non-zero, doesn't write the file. Existing `lib/exerciseLibrary.js` unchanged. No runtime impact.
- **wger schema change** (a column renamed, an ID added): import script's transform may produce malformed data. Mitigation: import script validates output (every exercise has at least one muscle, equipment is in enum, ID is non-empty) before writing; throws on validation failure.
- **Runtime missing exercise** (`canonicalExerciseFor('something')` returns null because the canonical pick wasn't in the imported data): falls back to first alphabetical for the muscle. autoAttuneAll handles `null` already.
- **Backward-compat break** (existing chip in localStorage references an `exerciseId` not in the new library): chip still renders (label = exerciseId string), but the picker won't autocomplete it. Acceptable — no data loss.

### State Lifecycle Risks

None. This library is a static read-only export. No mutation, no cleanup, no orphans.

### API Surface Parity

- Public surface: `exercisesByMuscle`, `canonicalExerciseFor`, `searchExercises` — preserved exactly.
- Exercise shape: `{ id, label, muscle }` becomes `{ id, label, muscle, muscles, equipment, aliases }` — all old fields still present.
- No other modules expose equivalent functionality.

### Integration Test Scenarios

1. **Open Attune picker on chest day** → verify list includes `BENCH PRESS`, `INCLINE BENCH PRESS`, `DUMBBELL FLY`, etc., alphabetized; equipment glyphs visible.
2. **Open Attune picker on glutes day** → verify `DEADLIFT`, `HIP THRUST`, `SQUAT`, `ROMANIAN DEADLIFT` all present (multi-muscle attribution working).
3. **Type "DL" in chest picker search** → returns nothing (DL alias is for Deadlift, which is back/glutes/hams, not chest). Confirms muscle-lock + alias matching.
4. **Type "DL" in back picker search** → returns Deadlift. Confirms alias matching works.
5. **autoAttuneAll on a fresh cycle** → every muscle day gets its canonical exercise (BENCH PRESS for chest, SQUAT for quads, etc.) — confirms `canonicalExerciseFor` integration.
6. **Existing chip with `exerciseId: "BARBELL BENCH PRESS"` in localStorage** (from before this feature) → still renders correctly on `/attune` and `/fitness/active`. Backward compat preserved.

## Worker Split

| Worker | Pane | Units | Owns |
|---|---|---|---|
| **Worker A (gtl1)** | BR | Units 1, 2, 3, 6 | Mapping table + import script + library rewrite + license. Critical path. |
| **Worker B (gtl2)** | TR | Units 4, 5 | Alias overlay file + equipment glyph in PickerSheet. Parallel with A. |
| (Worker C unused for this feature.) | | | |

**Critical sequencing:** Worker B's Unit 4 file (`lib/exerciseAliases.js`) MUST land on `origin/dev` before Worker A runs the import script — Worker A's import imports the alias overlay. So Worker A:
1. Lands Units 1 + 6 first (no dependencies).
2. Pulls origin/dev periodically (auto-pull loop) to pick up Worker B's Unit 4.
3. Once Unit 4 visible, runs the import (Unit 2) → produces `lib/exerciseLibrary.js`.
4. Lands Unit 3 (the function-body template + the generated library).

Worker B's Unit 5 (PickerSheet glyph) can land any time — the `EQUIPMENT_GLYPH` fallback to `·` covers the pre-Unit-3 state.

## Test Strategy

- **Manual smoke test on iOS PWA**: open `/attune`, open picker on each of the 11 muscles, verify list renders + glyph visible + alphabetized + multi-muscle exercises (Deadlift, Squat, Hip Thrust) appear under all expected muscles.
- **Search regression**: type `DL`, `RDL`, `OHP`, `BBR`, `CGBP` in respective muscle pickers — each finds the matching exercise.
- **Canonical picks**: trigger Auto-attune all on a fresh cycle, verify each muscle day gets the expected canonical exercise.
- **Import rerun reproducibility**: `npm run import:exercises` twice in a row produces an identical file (modulo wger updates between runs).
- **Existing chip preservation**: load a profile with chips already attuned (before this feature) — chips still display correctly with their stored exerciseIds.
- **Bundle size check**: `lib/exerciseLibrary.js` should be < 100 KB minified (estimated ~30–40 KB).
- **Console errors**: zero new console warnings when /attune renders with the full library.

## Open Questions

### Resolved during planning

(All 6 Deferred-to-Planning items from the origin doc are resolved above — see Key Technical Decisions and Implementation Units. Brief recap:)

- **Static script vs build-time fetch** → Static. (Key Decision #1)
- **Where script lives** → `scripts/import-wger.js`, `npm run import:exercises`. (Unit 2)
- **Equipment glyph rendering** → 1-char monospace in clip-path chip; no SVG sprite. (Key Decision + Unit 5)
- **Alias source** → Hand-curated overlay at `lib/exerciseAliases.js`; merged at import time. (Unit 4)
- **wger primary/secondary mapping** → Hand-built fold-down table in `scripts/wgerMap.js`; obliques→abs, soleus+gastroc→calves, traps→back, lats→back, etc. (Unit 1 + Key Decision)
- **Canonical exercise per muscle** → 11 hand-picked stable defaults in `CANONICAL_EXERCISE`. (Unit 1)

### Deferred to implementation / follow-up

- [Affects R7][Needs validation] After running the import, confirm the actual exercise count and spot-check 3–5 random multi-muscle exercises to verify wger's data really has the muscle attributions Jordan expects (e.g. confirm wger tags Deadlift's secondary muscles as glutes + hamstrings, not just "lower body").
- [Affects R10][User decision] Confirm the 11 canonical picks (BENCH PRESS / SQUAT / etc.) match Jordan's mental defaults. Easy to swap in `scripts/wgerMap.js` after a quick visual review.
- [Follow-up cleanup][not in this plan] Delete the inline `EXERCISES` constant in `app/fitness/active/page.js` once all callers use `exercisesByMuscle()` directly. Out of scope here; should land as a separate small dispatch after this feature ships.
- [Follow-up enhancement][not in this plan] Equipment filter toggle on the picker (use the metadata that's now stored). Surfaced as a follow-up if Jordan wants it.
- [Resilience][low priority] Consider adding a fallback `lib/exerciseLibrary.fallback.js` snapshot committed to repo, used if the live import script ever produces broken output. Probably overkill — the script is reproducible.

## Sources & References

### Origin

- **Origin document:** [`dispatches/2026-05-02-gtl-exercise-library-requirements.md`](./2026-05-02-gtl-exercise-library-requirements.md)
  - Carried forward: comprehensive (every common exercise per muscle), wger source, primary+secondary attribution, alphabetized, equipment glyph visible, aliases for shorthand, backward-compat surface, no user-add flow.

### Internal References

- `lib/exerciseLibrary.js` (current placeholder being replaced)
- `lib/storage.js` (`pk()` profile-scoped storage convention)
- `lib/bgmTracks.js` (precedent for static array-of-objects export style)
- `lib/attunement.js` (precedent for module-level cached snapshot pattern)
- `app/fitness/active/page.js:31–43` (inline `EXERCISES` constant — flagged for follow-up cleanup)
- `components/attune/PickerSheet.jsx` (UI consumer — Unit 5 modifies)
- `dispatches/2026-05-02-001-feat-attune-exercises-page-plan.md` (sister plan — set the convention this plan mirrors)

### External References

- wger API docs: <https://wger.de/api/v2/>
- wger exercise endpoint: <https://wger.de/api/v2/exercise/?language=2&status=2>
- wger muscle reference: <https://wger.de/api/v2/muscle/>
- wger equipment reference: <https://wger.de/api/v2/equipment/>
- CC-BY-SA 4.0 license: <https://creativecommons.org/licenses/by-sa/4.0/>

### Related Work

- `dispatches/2026-05-02-gtl-exercise-selection-requirements.md` (Attune brainstorm — locked the picker contract this library serves)
- `dispatches/attune_movements_page.md` (Worker A's spec for the Attune page itself)
