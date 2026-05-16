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
  EXERCISE_DENYLIST_PATTERNS,
  EXERCISE_DENYLIST_EXACT,
  EQUIPMENT_FIXUP,
  MUSCLE_FIXUP,
  BW_COEFFICIENT,
  KING_COMPOUNDS,
  ISOLATION_OVERRIDE,
  HEAVY_LIFT_THRESHOLDS,
  HEAVY_LIFT_CLASS_SCALES,
  HEAVY_LIFT_CLASS_DEFAULTS,
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
  // /exerciseinfo/ embeds translations + muscles + equipment as objects, so we
  // get name + muscle-ids + equipment-ids in a single page. /exercise/ requires
  // separate joins now and isn't always populated with `name` directly.
  let url = `${WGER_BASE}/exerciseinfo/?language=2&limit=200`
  while (url) {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`wger fetch failed: ${r.status} ${url}`)
    const j = await r.json()
    all.push(...j.results)
    url = j.next
  }
  return all
}

// Prefer top-level `name`; fall back to English translation; then any.
function pickName(w) {
  if (w.name) return w.name
  if (Array.isArray(w.translations)) {
    const en = w.translations.find(t => t.language === 2 && t.name)
    if (en?.name) return en.name
    const any = w.translations.find(t => t.name)
    if (any?.name) return any.name
  }
  return ''
}

function normalizeName(raw) {
  if (!raw) return ''
  return raw
    .replace(/<[^>]+>/g, '')        // strip HTML tags
    .replace(/&[a-z]+;/gi, ' ')     // strip HTML entities
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim()
    .toUpperCase()
}

// Name-based equipment fallback for wger entries where the equipment field
// is missing or maps to 'other'. Pattern order matters — earlier patterns
// win. The library is curated so that every exercise lands in one of
// {machine, cable, dumbbell, barbell, bodyweight}; entries that still
// return 'other' after this fallback are dropped by the import filter.
const NAME_EQUIPMENT_PATTERNS = [
  ['cable',     /\b(?:CABLE|PULLEY|PULLDOWN|PULL\sDOWN|FACEPULL|FACE\sPULL|BAYESIAN|ROPE\s|PUSHDOWN|PALLOF|SHOTGUN\sROW|ROWING\sSEATED)\b/i],
  ['machine',   /\b(?:SMITH|LEVERAGE|MACHINE|HACKENSCHMITT|HAMMERSTRENGTH|HAMMER\sSTRENGTH|BUTTERFLY|PEC\s?DECK|GLUTE\sDRIVE|HACK\sSQUAT(?:S)?|LEG\sPRESS(?:ES)?|LEG\sCURL(?:S)?|LEG\sEXTENSION(?:S)?|HYPEREXTENSION(?:S)?|HYPER\b|REVERSE\sHYPER|PULLOVER\sMACHINE|GHR|GLUTE.HAM|REAR\sDELT\sFLY|BACK\sEXTENSION|45.DEGREE|T.BAR|GLUTE\sKICKBACK|BELT\sSQUAT|CHEST\sPRESS|HIGH\sROW|LOW\sROW|MULTIPRESS|MULTI\sPRESS|LEGEND|HIP\sADDUCTION|HIP\sABDUCTION|SEATED\sHIP|CALF\sRAISE(?:S)?|STANDING\sCALF|SITTING\sCALF|SEATED\sCALF|NECK\sEXTENSION)\b/i],
  ['barbell',   /\b(?:BARBELL|EZ[- ]?BAR|SZ[- ]?BAR|TRAP\sBAR|GOOD\sMORNING(?:S)?|FLOOR\sSKULL\sCRUSHER|SKULLCRUSHER|SKULL\sCRUSH|BB|PUSH\sPRESS|RACK\sDEADLIFT|SUMO\sDEADLIFT|REVERSE\sBAR\sCURL|PREACHER\sCURL(?:S)?|REVERSE\sPREACHER)\b/i],
  ['dumbbell',  /\b(?:DUMBBELL|DUMBBELLS|KROC\sROW|FRONT\sPLATE\sRAISE|RAISE(?:S)?\sWITH\sPLATE(?:S)?|PLATE\sRAISE|OVERHEAD\sTRICEPS\sEXTENSION|SEATED\sTRICEPS\sPRESS|ROWING,?\sLYING)\b/i],
  ['bodyweight',/\b(?:BODYWEIGHT|PUSH[- ]?UP(?:S)?|PULL[- ]?UP(?:S)?|CHIN[- ]?UP(?:S)?|DIP(?:S)?|SIT[- ]?UP(?:S)?|CRUNCH(?:ES)?|FLUTTER|GLUTE\sBRIDGE|LEG\sRAISE(?:S)?|KNEE\sRAISE(?:S)?|HANGING\sLEG\sRAISE(?:S)?|COMMANDO|HINDU|COSSACK|REVERSE\sCRUNCH|V.UP|JACKKNIFE|TUCK|MOUNTAIN|BICYCLE\sCRUNCH|TOE\sTOUCH|AIR\sSQUAT|AB\sWHEEL|ROLLOUT|SUPERMAN|BIRD\sDOG|DRAGON\sFLAG|TYPEWRITER|ARCHER|SCAPULAR?|INVERTED|AUSTRALIAN|MUSCLE\sUP|NORDIC|WALL\sANGEL(?:S)?|SCISSORS|BRACED\sSQUAT)\b/i],
]

function inferEquipment(wgerEquipmentArr, exerciseId) {
  // Manual override takes precedence (cable / kettlebell / band).
  if (EQUIPMENT_OVERRIDE[exerciseId]) return EQUIPMENT_OVERRIDE[exerciseId]
  // Hand-curated fixup for entries wger tags wrong (e.g., CABLE CURLS as machine).
  if (EQUIPMENT_FIXUP[exerciseId]) return EQUIPMENT_FIXUP[exerciseId]
  // First wger equipment that maps wins.
  for (const eq of wgerEquipmentArr || []) {
    const mapped = WGER_EQUIPMENT_MAP[eq.id ?? eq]
    if (mapped && mapped !== 'other') return mapped
  }
  // Name-based fallback for entries that wger left unclassified.
  for (const [eq, pat] of NAME_EQUIPMENT_PATTERNS) {
    if (pat.test(exerciseId)) return eq
  }
  return 'other'
}

function transform(wgerEntries) {
  const seen = new Map()  // id -> count, for collision disambiguation
  const out = []

  for (const w of wgerEntries) {
    // /exerciseinfo/ returns category as { id, name }; /exercise/ as int.
    const catId = (w.category && typeof w.category === 'object') ? w.category.id : w.category
    if (!STRENGTH_CATEGORY_IDS.has(catId)) continue

    let id = normalizeName(pickName(w))
    if (!id) continue
    if (EXERCISE_DENYLIST_PATTERNS.some(p => p.test(id))) continue  // bands / isos / etc
    if (EXERCISE_DENYLIST_EXACT.has(id)) continue                    // hand-curated exact drops
    const count = seen.get(id) || 0
    seen.set(id, count + 1)
    if (count > 0) id = `${id} (${w.id})`  // disambiguate with wger ID

    let primaryMuscles = []
    let secondaryMuscles = []
    if (MUSCLE_FIXUP[id]) {
      // Hand-curated split — use as-is, ignore wger.
      primaryMuscles = [...MUSCLE_FIXUP[id].primary]
      secondaryMuscles = [...MUSCLE_FIXUP[id].secondary]
    } else {
      // Fall back to wger primary/secondary distinction.
      const primaryWger = (w.muscles || []).map(m => m.id ?? m)
      const secondaryWger = (w.muscles_secondary || []).map(m => m.id ?? m)
      for (const wm of primaryWger) {
        const gtl = WGER_MUSCLE_MAP[wm]
        if (gtl && !primaryMuscles.includes(gtl)) primaryMuscles.push(gtl)
      }
      for (const wm of secondaryWger) {
        const gtl = WGER_MUSCLE_MAP[wm]
        if (gtl && !primaryMuscles.includes(gtl) && !secondaryMuscles.includes(gtl)) {
          secondaryMuscles.push(gtl)
        }
      }
    }

    // Forearms overlay: add 'forearms' to secondary if any FOREARMS_OVERLAY
    // substring appears in the exercise ID. Catches all wrist-curl /
    // hammer-curl / farmer-carry variants regardless of specific wger naming.
    const needsForearms = FOREARMS_OVERLAY.some(s => id.includes(s))
    if (needsForearms && !primaryMuscles.includes('forearms') && !secondaryMuscles.includes('forearms')) {
      secondaryMuscles.push('forearms')
    }

    // Flat muscles[] = union of primary + secondary (backward compat).
    const muscles = [...primaryMuscles, ...secondaryMuscles.filter(m => !primaryMuscles.includes(m))]

    if (muscles.length === 0) continue   // no GTL muscles attributed → skip

    const equipment = inferEquipment(w.equipment, id)
    if (equipment === 'other') continue   // drop entries that resist classification
    const aliases = EXERCISE_ALIASES[id] || []

    const entry = { id, label: id, muscles, primaryMuscles, secondaryMuscles, equipment, aliases }
    // Bodyweight coefficient (R1a): only attached for equipment === 'bodyweight'.
    // Defaults to 1.00 (full BW load) when not in BW_COEFFICIENT.
    if (equipment === 'bodyweight') {
      entry.bw_coefficient = BW_COEFFICIENT[id] ?? 1.00
    }
    // King Compound flag (R12b) — read by the algo to apply top-3 region star
    // rule and king_compound_mult on the Total XP track.
    if (KING_COMPOUNDS.has(id)) {
      entry.is_king_compound = true
    }
    // Isolation override flag (R14) — read by the algo to force isolation
    // classification regardless of region distribution.
    if (ISOLATION_OVERRIDE.has(id)) {
      entry.is_isolation_override = true
    }
    // Heavy-lift threshold + scale (R18a) — used by the cinematic to compute
    // the HEAVY LIFT bonus when entered_weight / user_BW exceeds threshold.
    let cls
    if (KING_COMPOUNDS.has(id)) cls = 'king_compound'
    else if (ISOLATION_OVERRIDE.has(id)) cls = 'isolation'
    else {
      // auto-classify: 100% one region -> isolation, else compound
      const allMuscles = [...primaryMuscles, ...secondaryMuscles]
      const REGION = { chest:'FRONT', quads:'FRONT', back:'BACK', hamstrings:'BACK',
        shoulders:'ARMS', biceps:'ARMS', triceps:'ARMS', forearms:'ARMS',
        abs:'CORE', glutes:'LEGS', calves:'LEGS' }
      const regions = new Set(allMuscles.map(m => REGION[m]).filter(Boolean))
      cls = regions.size === 1 ? 'isolation' : 'compound'
    }
    entry.heavy_lift_threshold = HEAVY_LIFT_THRESHOLDS[id] ?? HEAVY_LIFT_CLASS_DEFAULTS[cls]
    entry.heavy_lift_scale = HEAVY_LIFT_CLASS_SCALES[cls]
    out.push(entry)
  }

  // Validate: every Exercise has at least one muscle, equipment is in enum, ID is non-empty
  const VALID_EQUIPMENT = new Set(['barbell','dumbbell','cable','machine','bodyweight','kettlebell','band','other'])
  for (const e of out) {
    if (!e.id || !e.label) throw new Error(`Empty id/label: ${JSON.stringify(e)}`)
    if (e.muscles.length === 0) throw new Error(`No muscles: ${e.id}`)
    if (!Array.isArray(e.primaryMuscles)) throw new Error(`Missing primaryMuscles: ${e.id}`)
    if (!Array.isArray(e.secondaryMuscles)) throw new Error(`Missing secondaryMuscles: ${e.id}`)
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
