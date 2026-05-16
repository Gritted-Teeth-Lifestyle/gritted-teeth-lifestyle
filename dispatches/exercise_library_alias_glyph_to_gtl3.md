# Exercise Library — alias overlay file + equipment glyph in PickerSheet (Worker B)

## CONTEXT

Implementing the GTL Curated Exercise Library per the plan at
`dispatches/2026-05-02-002-feat-gtl-exercise-library-plan.md`
(originating from `dispatches/2026-05-02-gtl-exercise-library-requirements.md`).

You are **Worker B**. Your work is independent of Worker A's data pipeline
and can run in parallel — but **your Unit 4 (alias overlay) MUST land on
origin/dev FIRST** so Worker A's import script can read it. Push Unit 4
immediately as your first commit, then continue with Unit 5.

## TASK 1 — Unit 4: Alias overlay file

**File:** `lib/exerciseAliases.js` (new)

Create a hand-curated overlay file that the Worker A import script reads
to enrich exercises with abbreviations, forearms attribution, and
equipment overrides for things wger doesn't categorize cleanly.

```js
// lib/exerciseAliases.js
//
// Hand-curated overlays consumed by scripts/import-wger.js to enrich the
// generated lib/exerciseLibrary.js. Three independent maps:
//
//   EXERCISE_ALIASES — exerciseId -> abbreviations the search box should match
//   FOREARMS_OVERLAY — exercise IDs that should have 'forearms' added to muscles[]
//                      (wger doesn't tag forearms cleanly)
//   EQUIPMENT_OVERRIDE — exerciseId -> equipment enum override (for cable /
//                        kettlebell / band exercises wger doesn't categorize)
//
// Grow these freely — re-running `npm run import:exercises` picks up any edits.

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
  'WRIST CURL':                ['WC'],
  'REVERSE WRIST CURL':        ['RWC'],
  'FARMER CARRY':              ['FARMER WALK'],
  'HAMMER CURL':               ['HC'],
}

// Exercise IDs that should have 'forearms' added to muscles[] at import time.
// wger doesn't have a clean forearms muscle tag — these are the exercises
// Jordan would expect to see when picking exercises for forearm day.
export const FOREARMS_OVERLAY = [
  'WRIST CURL',
  'REVERSE WRIST CURL',
  'HAMMER CURL',
  'FARMER CARRY',
]

// wger doesn't categorize cable, kettlebell, or band exercises cleanly.
// These overrides force a specific equipment enum value on import for
// the listed IDs. Equipment enum values: 'barbell', 'dumbbell', 'cable',
// 'machine', 'bodyweight', 'kettlebell', 'band', 'other'.
//
// Grow this list as new wger items appear in the imported data.
export const EQUIPMENT_OVERRIDE = {
  'CABLE CROSSOVER':       'cable',
  'CABLE FLY':             'cable',
  'CABLE ROW':             'cable',
  'TRICEP PUSHDOWN':       'cable',
  'FACE PULL':             'cable',
  'LAT PULLDOWN':          'cable',
}
```

**Acceptance:**
- File exists at `lib/exerciseAliases.js`.
- Three exports: `EXERCISE_ALIASES`, `FOREARMS_OVERLAY`, `EQUIPMENT_OVERRIDE`.
- ~30+ alias entries to start (exact count from the data above).

**Commit + push to origin/dev IMMEDIATELY** so Worker A's auto-pull picks it up.

Suggested commit message:
```
Exercise library: hand-curated alias / forearms / equipment overlays

lib/exerciseAliases.js: three independent maps consumed by Worker A's
import script — EXERCISE_ALIASES (lifting shorthand for search),
FOREARMS_OVERLAY (forearms attribution for exercises wger doesn't tag),
EQUIPMENT_OVERRIDE (cable / kettlebell / band categorization).

Grows over time as new exercises appear in the wger import.
```

---

## TASK 2 — Unit 5: Equipment glyph in PickerSheet

**File:** `components/attune/PickerSheet.jsx`

Add a small monospace pill on the right side of every exercise row in
the picker showing a single-character equipment indicator. Match GTL's
existing chip vocabulary.

### Locate the exercise-row render block

In `PickerSheet.jsx`, find where the picker maps over exercises and
renders a row per exercise. You'll see something like:

```jsx
{exercises.map((ex) => (
  <div key={ex.id} onClick={() => ...}>
    <span>{ex.label}</span>
  </div>
))}
```

(exact layout may differ — adapt to whatever the current render shape is)

### Add the glyph map at the top of the component file

```jsx
const EQUIPMENT_GLYPH = {
  barbell:    'B',
  dumbbell:   'D',
  cable:      'C',
  machine:    'M',
  bodyweight: 'b',  // lowercase to differentiate from 'B'
  kettlebell: 'K',
  band:       'R',
  other:      '·',
}
```

### Update the row render

```jsx
{exercises.map((ex) => (
  <div
    key={ex.id}
    onClick={() => ...}
    className="flex items-center justify-between gap-3 ...existing row classes..."
  >
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
))}
```

The `EQUIPMENT_GLYPH[ex.equipment] || '·'` fallback means rows render
fine BEFORE Worker A's data pipeline lands (when `ex.equipment` is
undefined, glyph shows `·`). After Worker A lands, real glyphs appear.

### Why these specific styles

- `font-mono text-[10px]` matches GTL's other label chips (e.g. MuscleChip).
- `bg-gtl-edge text-gtl-ash` keeps the glyph subtle — it's a secondary visual
  signal, not a primary call-to-action.
- `clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)'` is the slight
  parallelogram clip used elsewhere in GTL (matches MuscleChip).
- `aria-hidden="true"` + `title={ex.equipment}` — screen readers ignore the
  single character (label already conveys what the user needs); desktop
  hover surfaces full equipment name.

**Acceptance:**
- Every exercise row in the picker shows the glyph on the right side.
- Glyph renders at 10px monospace, matches GTL chip aesthetic.
- Pre-Worker-A: glyph is `·` for every row (fallback).
- Post-Worker-A: glyph reflects each exercise's equipment.
- No layout regression — existing row click target still works.

Suggested commit message:
```
PickerSheet: equipment glyph next to each exercise label

Small monospace pill (B / D / C / M / b / K / R / ·) on the right side
of every exercise row — visual cue for equipment scanning. Falls back
to '·' when the exercise has no equipment field (pre-Worker-A data
pipeline). After Worker A's library rewrite lands, real glyphs appear.
```

---

## DO NOT

- Do NOT touch `lib/exerciseLibrary.js` itself — that's Worker A's territory.
- Do NOT touch `scripts/import-wger.js` — Worker A writes that.
- Do NOT add equipment metadata to specific exercises in the alias overlay
  — that goes in `EQUIPMENT_OVERRIDE`, not as a side channel.
- Do NOT change the picker's existing search / scroll / muscle-lock behavior.
- Do NOT add UI for the equipment FILTER (only the glyph display) — the
  filter is explicitly out of scope per the plan.
- Do NOT touch `components/attune/CycleCalendar.jsx`, `DayCell.jsx`, or
  any other Attune component besides PickerSheet.

## VERIFICATION

After both commits land + Worker A's pipeline lands:

1. Open `/attune` on a real cycle. Open the picker on chest day.
2. Verify rows show equipment glyph on the right (e.g. `BENCH PRESS  B`).
3. Type `DL` in search on back day — should find `DEADLIFT`.
4. Type `RDL` in search on hamstrings day — should find `ROMANIAN DEADLIFT`.
5. Type `OHP` in search on shoulders day — should find `OVERHEAD PRESS`.
6. Open picker on forearms day — should see `WRIST CURL`, `REVERSE WRIST CURL`,
   `HAMMER CURL`, `FARMER CARRY` (forearms overlay working).

## REPORT BACK

After both commits push, report:
1. Two commit SHAs (Unit 4 first, Unit 5 second).
2. Confirmation `lib/exerciseAliases.js` exists with 3 exports.
3. Confirmation PickerSheet glyph renders (screenshot if possible).
4. Any blockers encountered.
