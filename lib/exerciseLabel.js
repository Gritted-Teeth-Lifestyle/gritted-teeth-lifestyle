// Display-time normalization for exercise labels coming out of
// lib/exerciseLibrary.js. The library mixes a few separator styles for
// variants (" - DECLINE", " | INCLINE", "(OVERHAND)"). This helper
// folds them all into a single " - " dash form so the picker reads
// uniform, without touching the auto-generated library file or the
// curation maps in lib/exerciseAliases.js.
//
// Rules:
//   " | <suffix>"            → " - <suffix>"
//   "... (<suffix>)" at end  → " - <suffix>"
//   " - <suffix>"            untouched (already canonical)
//   "PULL-UP" / "CROSS-BODY" / etc.    untouched (compound hyphens
//                                       have no surrounding spaces)

export function prettyExerciseLabel(label) {
  if (!label) return ''
  let out = String(label).trim()
  // Pipe separator → dash.
  out = out.replace(/\s*\|\s*(.+)$/, ' - $1')
  // Trailing parenthesized variant → dash. Anchored to the end so
  // intra-name parens (rare) aren't disturbed; spaces around the
  // opening paren are tolerated.
  out = out.replace(/\s*\(([^()]+)\)\s*$/, ' - $1')
  // Collapse any double-space artifacts.
  out = out.replace(/\s{2,}/g, ' ')
  return out
}
