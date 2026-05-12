// Display-time normalization for exercise labels coming out of
// lib/exerciseLibrary.js. The library's raw labels are messy in three
// ways: equipment sometimes sits as a dash-suffix ("INCLINE BENCH
// PRESS - BARBELL") and sometimes as a prefix ("BARBELL CURL");
// variants use mixed separators (parens, pipes, dashes); and a few
// entries use the verbose "WITH <EQUIPMENT>" form.
//
// One decisive rule: EQUIPMENT IS ALWAYS A PREFIX. Variants stay as a
// trailing " - <variant>" suffix. No parens, no pipes, no "WITH".
//
// Examples:
//   'BARBELL CURL'                          → 'BARBELL CURL'
//   'INCLINE BENCH PRESS - BARBELL'         → 'BARBELL INCLINE BENCH PRESS'
//   'INCLINE BENCH PRESS - DUMBBELL'        → 'DUMBBELL INCLINE BENCH PRESS'
//   'BICEPS CURLS WITH BARBELL'             → 'BARBELL BICEPS CURLS'
//   'BICEPS CURLS WITH SZ-BAR'              → 'SZ-BAR BICEPS CURLS'
//   'BARBELL ROW (OVERHAND)'                → 'BARBELL ROW - OVERHAND'
//   'PUSH-UPS | DECLINE'                    → 'PUSH-UPS - DECLINE'
//   'BENCH PRESS'                           → 'BENCH PRESS'         (no equipment word)
//   'PULL-UP' / 'CROSS-BODY'                 untouched (compound hyphens)

// Equipment tokens recognized for the suffix→prefix move. Longest
// first so multi-word tokens (SMITH MACHINE) match before substrings.
const EQUIPMENT_TOKENS = [
  'SMITH MACHINE',
  'BARBELL',
  'DUMBBELL',
  'KETTLEBELL',
  'CABLE',
  'MACHINE',
  'BODYWEIGHT',
  'SZ-BAR',
  'EZ-BAR',
  'TRAP BAR',
]

function buildEquipmentAlt() {
  // Escape any regex specials in the tokens (SZ-BAR contains '-' which
  // is regex-safe but defensive); join into an alternation.
  return EQUIPMENT_TOKENS.map((t) => t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')
}

const EQUIPMENT_ALT = buildEquipmentAlt()
// " - <EQUIPMENT>" at end.
const SUFFIX_DASH_EQUIP = new RegExp(`\\s+-\\s+(${EQUIPMENT_ALT})$`, 'i')
// " WITH <EQUIPMENT>" at end.
const SUFFIX_WITH_EQUIP = new RegExp(`\\s+WITH\\s+(${EQUIPMENT_ALT})$`, 'i')

export function prettyExerciseLabel(label) {
  if (!label) return ''
  let out = String(label).trim()

  // Step 1: collapse pipe and trailing-parens variant separators to a
  // canonical " - <variant>" form.
  out = out.replace(/\s*\|\s*(.+)$/, ' - $1')
  out = out.replace(/\s*\(([^()]+)\)\s*$/, ' - $1')

  // Step 2: if the label ends in an equipment token (as a dash-suffix
  // or "WITH" suffix), strip it and prepend the equipment word.
  // Don't double-prepend if the label already starts with that token.
  const apply = (re) => {
    const m = out.match(re)
    if (!m) return false
    const token = m[1].toUpperCase()
    out = out.slice(0, m.index).trim()
    if (!new RegExp(`^${token}\\b`, 'i').test(out)) {
      out = `${token} ${out}`
    }
    return true
  }
  // Loop in case both forms appear (rare). Run each at most once.
  apply(SUFFIX_DASH_EQUIP)
  apply(SUFFIX_WITH_EQUIP)

  // Step 3: collapse any double-space artifacts.
  out = out.replace(/\s{2,}/g, ' ').trim()
  return out
}
