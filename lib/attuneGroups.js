// Shared group-title logic for the Attune surface — used by both
// components/attune/DayCell.jsx (day cell label) and
// components/attune/PickerSheet.jsx (picker filter rows).
//
// A "title" collapses a set of muscle ids into a single named group:
//   UPPER (上) — chest + back + shoulders all present
//   LOWER (下) — quads + hamstrings + glutes all present
//   ARMS  (腕) — biceps + triceps both present (also absorbs forearms)
//   FULL BODY (全) — UPPER_MIN AND LOWER_MIN; absorbs EVERY muscle on
//                    the day; suppresses UPPER / LOWER / ARMS titles.
//
// muscleGroupLabel(dayMuscles) returns { titles, covered } where:
//   - titles is an ordered list of {kanji, label, covers} objects.
//     `covers` is the subset of dayMuscles this title absorbs.
//   - covered is the union of every title's `covers` — convenient for
//     computing the "remainder" muscles that didn't fit any title.

export const MUSCLE_KANJI = {
  chest: '胸', shoulders: '肩', back: '背', forearms: '腕',
  quads: '腿', hamstrings: '裏', calves: '脛',
  biceps: '二', triceps: '三', glutes: '尻', abs: '腹',
}

export const MUSCLE_LABEL = {
  chest: 'CHEST', shoulders: 'SHOULDERS', back: 'BACK', forearms: 'FOREARMS',
  quads: 'QUADS', hamstrings: 'HAMSTRINGS', calves: 'CALVES',
  biceps: 'BICEPS', triceps: 'TRICEPS', glutes: 'GLUTES', abs: 'ABS',
}

export const UPPER_MIN = ['chest', 'back', 'shoulders']
export const LOWER_MIN = ['quads', 'hamstrings', 'glutes']
export const ARMS_MIN  = ['biceps', 'triceps']

// Muscles each title absorbs when active. ARMS pulls forearms in so
// biceps+triceps+forearms reads as 腕 once, not 腕 + 腕.
export const UPPER_COVERS = UPPER_MIN
export const LOWER_COVERS = LOWER_MIN
export const ARMS_COVERS  = [...ARMS_MIN, 'forearms']

export function muscleKanji(id) { return MUSCLE_KANJI[id] || '·' }
export function muscleLabel(id) { return MUSCLE_LABEL[id] || '' }

function containsAll(muscles, required) {
  const s = new Set(muscles)
  return required.every((x) => s.has(x))
}

function intersect(muscles, group) {
  const s = new Set(muscles)
  return group.filter((m) => s.has(m))
}

export function muscleGroupLabel(muscles) {
  if (!Array.isArray(muscles) || muscles.length < 2) {
    return { titles: [], covered: [] }
  }
  const upper = containsAll(muscles, UPPER_MIN)
  const lower = containsAll(muscles, LOWER_MIN)
  const arms  = containsAll(muscles, ARMS_MIN)

  if (upper && lower) {
    // FULL BODY absorbs the whole day — no remainder, no other titles.
    return {
      titles: [{ kanji: '全', label: 'FULL BODY', covers: [...muscles] }],
      covered: [...muscles],
    }
  }
  const titles = []
  const covered = []
  if (upper) {
    const covers = intersect(muscles, UPPER_COVERS)
    titles.push({ kanji: '上', label: 'UPPER', covers })
    covered.push(...covers)
  }
  if (lower) {
    const covers = intersect(muscles, LOWER_COVERS)
    titles.push({ kanji: '下', label: 'LOWER', covers })
    covered.push(...covers)
  }
  if (arms) {
    const covers = intersect(muscles, ARMS_COVERS)
    titles.push({ kanji: '腕', label: 'ARMS', covers })
    covered.push(...covers)
  }
  return { titles, covered }
}
