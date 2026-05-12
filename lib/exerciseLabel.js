// Display-time normalization for exercise labels coming out of
// lib/exerciseLibrary.js. The library mixes a few separator styles for
// variants (" - DECLINE", " | INCLINE", "(OVERHAND)"). This helper
// folds them into one consistent form so the picker reads uniform
// without touching the auto-generated library file or the curation
// maps in lib/exerciseAliases.js.
//
// Rules:
//   " | <suffix>"          → " (<suffix>)"
//   " - <suffix>"          → " (<suffix>)"   (spaces on BOTH sides of '-')
//   "PULL-UP" / "CROSS-BODY" / etc.    untouched (compound hyphens
//                                       have no surrounding spaces)
//   "BARBELL ROW (OVERHAND)"   untouched (already parens)

export function prettyExerciseLabel(label) {
  if (!label) return ''
  let out = String(label).trim()
  // Pipe separator → parens. Match optional spaces around the pipe.
  out = out.replace(/\s*\|\s*(.+)$/, ' ($1)')
  // Space-hyphen-space separator → parens. The required whitespace on
  // both sides prevents matching compound-word hyphens (PULL-UP,
  // CHEST-SUPPORTED, CROSS-BODY, 1-ARM, etc.).
  out = out.replace(/\s+-\s+(.+)$/, ' ($1)')
  // Collapse any double-space artifacts from the substitutions.
  out = out.replace(/\s{2,}/g, ' ')
  return out
}
