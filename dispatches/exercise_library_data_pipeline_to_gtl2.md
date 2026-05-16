# Exercise Library — wger import pipeline + library rewrite (Worker A)

## CONTEXT

Implementing the GTL Curated Exercise Library per the plan at
`dispatches/2026-05-02-002-feat-gtl-exercise-library-plan.md`
(originating from `dispatches/2026-05-02-gtl-exercise-library-requirements.md`).

You are **Worker A**. You own the data pipeline: wger import script,
library rewrite, license attribution. Worker B is producing
`lib/exerciseAliases.js` in parallel — your import script READS that
file, so **wait for Worker B's first commit on origin/dev before running
the import** (your auto-pull loop runs every 30s; it'll appear).

You can write Units 1, 6 immediately (no dependencies). Then write the
import script (Unit 2). Run it (and land Unit 3 = the generated library)
once Worker B's `lib/exerciseAliases.js` is on origin/dev.

## TASK 1 — Unit 1: wger ID mapping table + canonical picks

**File:** `scripts/wgerMap.js` (new)

```js
// scripts/wgerMap.js
//
// Hand-mapped lookup tables consumed by scripts/import-wger.js.
// wger uses internal IDs for muscles + equipment; GTL uses string keys.
// These maps fold wger's 15 muscle IDs into GTL's 11 muscle keys (with
// a few legitimate drops) and wger's 8 equipment IDs into GTL's 8-value
// equipment enum. Cable / kettlebell / band exercises wger doesn't
// categorize cleanly are handled by the EQUIPMENT_OVERRIDE map in
// lib/exerciseAliases.js.

// wger muscle ID → GTL muscle key (or null to drop the attribution)
// Reference: https://wger.de/api/v2/muscle/
export const WGER_MUSCLE_MAP = {
  1: 'biceps',       // Biceps brachii
  2: 'shoulders',    // Anterior deltoid
  3: null,           // Serratus anterior — no GTL key, drop
  4: 'chest',        // Pectoralis major
  5: 'triceps',      // Triceps brachii
  6: 'abs',          // Rectus abdominis
  7: 'calves',       // Gastrocnemius
  8: 'glutes',       // Gluteus maximus
  9: 'back',         // Trapezius — folds into back
  10: 'quads',       // Quadriceps femoris
  11: 'hamstrings',  // Biceps femoris
  12: 'back',        // Latissimus dorsi — folds into back
  13: 'biceps',      // Brachialis — folds into biceps
  14: 'abs',         // Obliquus externus abdominis — folds into abs
  15: 'calves',      // Soleus — folds into calves
}

// wger equipment ID → GTL equipment enum
// Reference: https://wger.de/api/v2/equipment/
// Anything unmapped or not in this table → 'other'.
export const WGER_EQUIPMENT_MAP = {
  1:  'barbell',     // Barbell
  3:  'dumbbell',    // Dumbbell
  4:  'bodyweight',  // Gym mat (floor work) ≈ bodyweight
  7:  'machine',     // Bench (used standalone)
  8:  'barbell',     // SZ-Bar (EZ curl bar) ≈ barbell variant
  9:  'bodyweight',  // Pull-up bar
  10: 'bodyweight',  // none
  11: 'bodyweight',  // Bodyweight
}

// Canonical exercise per GTL muscle for canonicalExerciseFor().
// Hand-picked stable defaults — these IDs MUST appear in the imported
// data (or normalize to match) or the function falls back to the first
// alphabetical exercise for the muscle.
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

---

## TASK 2 — Unit 6: License attribution

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

Plus a one-line addition to `README.md` (or wherever third-party attribution is conventionally noted) referencing `LICENSE-thirdparty.md`.

**Land Units 1 + 6 as your first commit.** Push to origin/dev.

Suggested commit message:
```
Exercise library: wger ID mappings + CC-BY-SA attribution

scripts/wgerMap.js: hand-mapped wger muscle ID -> GTL muscle key (15 -> 11
with serratus dropped, traps/lats fold to back, brachialis to biceps,
soleus/gastroc to calves, obliques to abs); equipment ID -> GTL enum;
canonical exercise per muscle.

LICENSE-thirdparty.md: attribution per wger's CC-BY-SA 4.0 license.
```

---

## TASK 3 — Unit 2: wger import script

**File:** `scripts/import-wger.js` (new)

**Wait for Worker B's `lib/exerciseAliases.js` to land on origin/dev before
writing this** (your auto-pull loop will pull it in within 30s of B's
push). The script imports from that file.

```js
// scripts/import-wger.js
//
// One-time importer that fetches the wger.de strength catalog, normalizes
// names, folds muscle IDs to GTL keys, applies hand-curated overlays from
// lib/exerciseAliases.js, and writes lib/exerciseLibrary.js.
//
// Run with:  npm run import:exercises
//
// Re-run any time wger updates or the alias overlay changes.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WGER_MUSCLE_MAP,
  WGER_EQUIPMENT_MAP,
  CANONICAL_EXERCISE,
} from './wgerMap.js'
import {
  EXERCISE_ALIASES,
  FOREARMS_OVERLAY,
  EQUIPMENT_OVERRIDE,
} from '../lib/exerciseAliases.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const REPO_ROOT  = path.resolve(__dirname, '..')

const WGER_BASE = 'https://wger.de/api/v2'

// wger category IDs for strength training (everything except Cardio).
// Reference: https://wger.de/api/v2/exercisecategory/
const STRENGTH_CATEGORY_IDS = new Set([8, 9, 10, 11, 12, 13, 14])  // Arms, Legs, Abs, Chest, Back, Shoulders, Calves
// (verify these IDs match wger's current taxonomy when you implement)

async function fetchAll() {
  const all = []
  let url = `${WGER_BASE}/exercise/?language=2&status=2&limit=200`
  while (url) {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`wger fetch failed: ${r.status} ${url}`)
    const j = await r.json()
    all.push(...j.results)
    url = j.next
  }
  return all
}

function normalizeName(raw) {
  return raw
    .replace(/<[^>]+>/g, '')        // strip HTML tags
    .replace(/&[a-z]+;/gi, ' ')     // strip HTML entities
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim()
    .toUpperCase()
}

function inferEquipment(wgerEquipmentArr, exerciseId) {
  // Manual override takes precedence (cable / kettlebell / band).
  if (EQUIPMENT_OVERRIDE[exerciseId]) return EQUIPMENT_OVERRIDE[exerciseId]
  // First wger equipment that maps wins.
  for (const eq of wgerEquipmentArr || []) {
    const mapped = WGER_EQUIPMENT_MAP[eq.id ?? eq]
    if (mapped) return mapped
  }
  return 'other'
}

function transform(wgerEntries) {
  const seen = new Map()  // id -> count, for collision disambiguation
  const out = []

  for (const w of wgerEntries) {
    if (!STRENGTH_CATEGORY_IDS.has(w.category)) continue

    let id = normalizeName(w.name)
    if (!id) continue
    const count = seen.get(id) || 0
    seen.set(id, count + 1)
    if (count > 0) id = `${id} (${w.id})`  // disambiguate with wger ID

    const muscles = []
    const wmIds = [
      ...(w.muscles || []),
      ...(w.muscles_secondary || []),
    ].map(m => m.id ?? m)

    for (const wm of wmIds) {
      const gtl = WGER_MUSCLE_MAP[wm]
      if (gtl && !muscles.includes(gtl)) muscles.push(gtl)
    }

    // Forearms overlay: add 'forearms' if this exercise is in the overlay list
    if (FOREARMS_OVERLAY.includes(id) && !muscles.includes('forearms')) {
      muscles.push('forearms')
    }

    if (muscles.length === 0) continue   // no GTL muscles attributed → skip

    const equipment = inferEquipment(w.equipment, id)
    const aliases = EXERCISE_ALIASES[id] || []

    out.push({ id, label: id, muscles, equipment, aliases })
  }

  // Validate: every Exercise has at least one muscle, equipment is in enum, ID is non-empty
  const VALID_EQUIPMENT = new Set(['barbell','dumbbell','cable','machine','bodyweight','kettlebell','band','other'])
  for (const e of out) {
    if (!e.id || !e.label) throw new Error(`Empty id/label: ${JSON.stringify(e)}`)
    if (e.muscles.length === 0) throw new Error(`No muscles: ${e.id}`)
    if (!VALID_EQUIPMENT.has(e.equipment)) throw new Error(`Invalid equipment '${e.equipment}': ${e.id}`)
  }

  return out.sort((a, b) => a.label.localeCompare(b.label))
}

const TEMPLATE = `
// Backward-compat layer: every exercise gets a \`muscle\` field === muscles[0]
// so older consumers reading the singular field continue working.
const _withMuscle = (e) => ({ ...e, muscle: e.muscles[0] })
const _ALL = ALL_EXERCISES.map(_withMuscle)

const CANONICAL_EXERCISE = ${JSON.stringify(CANONICAL_EXERCISE, null, 2)}

export function exercisesByMuscle(muscleId) {
  return _ALL.filter(e => e.muscles.includes(muscleId))
}

export function canonicalExerciseFor(muscleId) {
  const target = CANONICAL_EXERCISE[muscleId]
  if (target) {
    const found = _ALL.find(e => e.id === target && e.muscles.includes(muscleId))
    if (found) return found.id
  }
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
`

async function writeLibrary(exercises) {
  const header = `// AUTO-GENERATED by scripts/import-wger.js — do not edit by hand.
// Source: wger.de exercise database (CC-BY-SA 4.0)
// Re-run with: npm run import:exercises
// Last imported: ${new Date().toISOString()}
// Exercise count: ${exercises.length}

`
  const data = `export const ALL_EXERCISES = ${JSON.stringify(exercises, null, 2)}\n`
  await fs.writeFile(
    path.join(REPO_ROOT, 'lib/exerciseLibrary.js'),
    header + data + TEMPLATE,
    'utf8'
  )
}

const data = await fetchAll()
console.log(`Fetched ${data.length} wger exercises`)
const transformed = transform(data)
await writeLibrary(transformed)
console.log(`Wrote ${transformed.length} exercises to lib/exerciseLibrary.js`)
console.log(`Muscles covered: ${[...new Set(transformed.flatMap(e => e.muscles))].sort().join(', ')}`)
```

Add to `package.json` scripts block:
```json
"import:exercises": "node scripts/import-wger.js"
```

---

## TASK 4 — Unit 3: Run the import + commit the generated library

```bash
# Once Worker B's lib/exerciseAliases.js is on origin/dev:
git pull origin dev
npm run import:exercises
# Inspect lib/exerciseLibrary.js — should be ~30-50 KB, alphabetized JSON
git add lib/exerciseLibrary.js
git commit -m "Exercise library: comprehensive wger-seeded catalog with multi-muscle attribution"
git push origin dev
```

**Acceptance:**
- `lib/exerciseLibrary.js` regenerated with ~300-500 exercises (depends on wger's catalog).
- Exercise shape: `{ id, label, muscles: string[], equipment: string, aliases: string[], muscle: string }` (muscle = muscles[0]).
- `exercisesByMuscle('back')` includes Deadlift; `exercisesByMuscle('glutes')` ALSO includes Deadlift; `exercisesByMuscle('hamstrings')` ALSO includes Deadlift.
- `searchExercises('back', 'DL')` returns Deadlift (alias matching).
- `canonicalExerciseFor('chest')` returns 'BENCH PRESS' (or whatever exact ID landed in the data after normalization).
- `e.muscle === e.muscles[0]` for every Exercise (backward-compat preserved).
- Existing /attune feature still works — open the picker on each muscle, see the long list.
- Existing chips in localStorage with `exerciseId: "BARBELL BENCH PRESS"` still display correctly (no migration needed).

---

## DO NOT

- Do NOT run the import script before Worker B's `lib/exerciseAliases.js`
  is on origin/dev. The script imports from it; running early will fail.
- Do NOT touch `components/attune/PickerSheet.jsx` or any UI files —
  Worker B owns the equipment glyph render.
- Do NOT change the `Exercise` shape's `id` field convention — IDs are
  uppercase label strings to preserve compatibility with existing
  localStorage chip data.
- Do NOT change the public function signatures
  (`exercisesByMuscle`, `canonicalExerciseFor`, `searchExercises`) —
  consumers depend on them.
- Do NOT include cardio, stretches, plyometrics in the import (filter via
  `STRENGTH_CATEGORY_IDS`).

## VERIFICATION

After all 4 tasks committed + pushed:

1. `cat lib/exerciseLibrary.js | head -20` — see auto-generated header + ALL_EXERCISES start.
2. `npm run import:exercises` — script runs cleanly, produces same file.
3. Open `/attune` on a real cycle, pick chest day → long alphabetical list with equipment glyphs (after Worker B's Unit 5 lands).
4. Search `DL` on back day → Deadlift appears.
5. `canonicalExerciseFor('chest')` returns 'BENCH PRESS' (or closest match).

## REPORT BACK

After all 4 tasks committed + pushed, report:
1. Commit SHAs for each of (Units 1+6 first commit, Unit 2 second commit, Unit 3 generated-library commit).
2. Number of exercises in the imported library.
3. List of muscles covered (should be all 11).
4. Confirmation `npm run import:exercises` is reproducible (running it twice produces identical output, modulo wger updates).
