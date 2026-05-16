// Notoriety / fame ranking for the exercise picker — the most well-known
// lifts every gym has bubble to the top of each muscle's list.
//
// `notoriety(exercise)` returns a number (higher = more famous). The
// picker sorts its match list by this score DESC with label ASC as the
// tiebreak so iconic lifts surface first regardless of alphabetical
// position (BENCH PRESS over BENT-OVER FLY for chest, etc.).
//
// Score lookup is in two passes:
//   1. Exact match on the exercise label / id against FAMOUS_EXACT.
//   2. Substring match against the same map (e.g. "BARBELL BENCH PRESS"
//      inherits BENCH PRESS's score minus a small variant penalty).
// Fallback: class-tier baseline (king compound > compound > isolation).

const FAMOUS_EXACT = {
  // Tier 1: iconic powerlifting & bodyweight
  'BENCH PRESS':              100,
  'SQUAT':                    100,
  'BARBELL SQUAT':            100,
  'DEADLIFT':                 100,
  'DEADLIFTS':                100,
  'OVERHEAD PRESS':            95,
  'MILITARY PRESS':            93,
  'BARBELL ROW':               92,
  'BENT OVER ROW':             92,
  'BENT-OVER ROW':             92,
  'PULL-UP':                   92,
  'PULL UP':                   92,
  'PULL-UPS':                  92,
  'PULLUPS':                   92,
  'CHIN-UP':                   90,
  'CHIN UP':                   90,
  'CHIN-UPS':                  90,
  'DIP':                       90,
  'DIPS':                      90,
  'ROMANIAN DEADLIFT':         88,
  'STIFF-LEGGED DEADLIFT':     85,
  'STIFF-LEGGED DEADLIFTS':    85,
  'FRONT SQUAT':               85,
  'FRONT SQUATS':              85,
  'LEG PRESS':                 85,
  'HIP THRUST':                85,
  'BARBELL CURL':              82,
  'DUMBBELL CURL':             80,
  'INCLINE BENCH PRESS':       82,
  'DUMBBELL BENCH PRESS':      80,
  'LATERAL RAISE':             80,
  'LATERAL RAISES':            80,
  'STANDING CALF RAISE':       78,
  'CALF RAISE':                78,
  'SEATED CALF RAISE':         75,
  'SKULL CRUSHER':             78,
  'SKULL CRUSHERS':            78,
  'TRICEP EXTENSION':          75,
  'TRICEPS EXTENSION':         75,
  'FRONT RAISE':               72,
  'LEG CURL':                  72,
  'LEG EXTENSION':             72,
  'LAT PULLDOWN':              78,
  'CABLE ROW':                 75,
  'SEATED ROW':                75,
  'HAMMER CURL':               72,
  'PREACHER CURL':             70,
  'INCLINE CURL':              68,
  'CABLE FLY':                 68,
  'PEC DECK':                  68,
  'REAR DELT FLY':             68,
  'REVERSE FLY':               68,
  'SHRUG':                     68,
  'SHRUGS':                    68,
  'GOOD MORNING':              65,
  'BULGARIAN SPLIT SQUAT':     65,
  'LUNGE':                     68,
  'LUNGES':                    68,
  'WALKING LUNGE':             65,
}

// Class-tier baselines for exercises that don't appear (or substring-match)
// in FAMOUS_EXACT. Keeps King Compounds above compounds above isolations
// when no specific score applies.
const CLASS_BASELINE = {
  king_compound: 40,
  compound:      25,
  isolation:     15,
}

const VARIANT_PENALTY = 18

// The only bodyweight exercises eligible for famous-list scores. Any
// library entry with `equipment === 'bodyweight'` that doesn't match
// one of these (exact or substring) is forced to the class baseline —
// so a bodyweight LUNGE doesn't inherit dumbbell LUNGE's notoriety,
// PUSH-UP / PLANK / CRUNCH / GLUTE BRIDGE don't get a famous bump, etc.
const BODYWEIGHT_FAMOUS_ALLOWLIST = [
  'PULL-UP', 'PULL UP', 'PULL-UPS', 'PULLUPS',
  'CHIN-UP', 'CHIN UP', 'CHIN-UPS',
  'DIP',     'DIPS',
]

function classify(exercise) {
  if (exercise?.is_king_compound) return 'king_compound'
  if (exercise?.is_isolation_override) return 'isolation'
  return 'compound'  // best-effort fallback for unflagged entries
}

function isBodyweightExempt(name) {
  for (const allowed of BODYWEIGHT_FAMOUS_ALLOWLIST) {
    if (name === allowed || name.includes(allowed)) return true
  }
  return false
}

export function notoriety(exercise) {
  if (!exercise) return 0
  const name = (exercise.label || exercise.id || '').toUpperCase()
  if (!name) return 0

  // Bodyweight gate: only pull-ups, chin-ups, and dips are eligible for
  // famous-list scoring. Everything else with equipment === 'bodyweight'
  // — push-ups, plank, sit-up, crunch, glute bridge, bodyweight squats /
  // lunges / BSS — falls to the class baseline.
  if (exercise.equipment === 'bodyweight' && !isBodyweightExempt(name)) {
    return CLASS_BASELINE[classify(exercise)] ?? 0
  }

  // Pass 1: exact match.
  if (FAMOUS_EXACT[name] != null) return FAMOUS_EXACT[name]

  // Pass 2: substring match — the variant inherits the canonical's score
  // minus a small penalty so the canonical still wins ties.
  let bestPartial = 0
  for (const famous of Object.keys(FAMOUS_EXACT)) {
    if (name.includes(famous) && FAMOUS_EXACT[famous] - VARIANT_PENALTY > bestPartial) {
      bestPartial = FAMOUS_EXACT[famous] - VARIANT_PENALTY
    }
  }
  if (bestPartial > 0) return bestPartial

  // Fallback: classification baseline.
  return CLASS_BASELINE[classify(exercise)] ?? 0
}

// Sort helper: higher notoriety first, then alphabetical by label as a
// stable tiebreak.
export function byNotoriety(a, b) {
  const na = notoriety(a)
  const nb = notoriety(b)
  if (nb !== na) return nb - na
  const la = (a?.label || '').toUpperCase()
  const lb = (b?.label || '').toUpperCase()
  if (la < lb) return -1
  if (la > lb) return 1
  return 0
}
